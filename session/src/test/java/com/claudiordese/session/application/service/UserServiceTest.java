package com.claudiordese.session.application.service;

import com.claudiordese.exceptions.BadRequestException;
import com.claudiordese.exceptions.ForbiddenException;
import com.claudiordese.exceptions.TooManyRequestsException;
import com.claudiordese.session.application.config.FileUploadRateLimitPolicy;
import com.claudiordese.session.application.domain.User;
import com.claudiordese.session.application.port.PasswordHasher;
import com.claudiordese.session.application.port.RateLimitGuard;
import com.claudiordese.session.application.port.UserStore;
import com.claudiordese.session.application.service.commands.UpdateAvatarCommand;
import com.claudiordese.session.application.service.commands.UpdateBioCommand;
import com.claudiordese.session.dto.UserSummaryDto;
import com.claudiordese.session.support.FakeAvatarStorage;
import com.claudiordese.session.support.InMemoryRateLimitGuard;
import com.claudiordese.session.support.InMemoryUserStore;
import com.claudiordese.session.support.PlainTextPasswordHasher;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class UserServiceTest {

    private UserStore users;
    private PasswordHasher hasher;
    private RateLimitGuard rateLimitGuard;
    private UserService service;
    private final List<java.util.UUID> notified = new ArrayList<>();
    private final List<java.util.UUID> profileNotified = new ArrayList<>();

    @BeforeEach
    void setUp() {
        users = new InMemoryUserStore();
        hasher = new PlainTextPasswordHasher();
        rateLimitGuard = new InMemoryRateLimitGuard();
        service = new UserService(
                users,
                hasher,
                new FakeAvatarStorage(),
                rateLimitGuard,
                new FileUploadRateLimitPolicy(10, Duration.ofHours(1)),
                List.of(notified::add),
                List.of(profileNotified::add));
        notified.clear();
        profileNotified.clear();
    }

    @Test
    void searchUsers_matchesCaseInsensitively_andExcludesRequester() {
        // Arrange
        User alice = users.create("alice", "alice@example.com", "hash");
        users.create("Alicia", "alicia@example.com", "hash");
        users.create("bob", "bob@example.com", "hash");

        // Act — alice searches for "ali"
        List<UserSummaryDto> results = service.searchUsers(alice.id(), "ali", 0, 20);

        // Assert — finds Alicia, not herself, not bob
        assertThat(results)
                .extracting(UserSummaryDto::username)
                .containsExactly("Alicia");
    }

    @Test
    void searchUsers_returnsPublicProfileAndRoles() {
        User alice = users.create("alice", "alice@example.com", "hash");
        User bob = users.create("bob", "bob@example.com", "hash");
        users.update(bob.withAvatarUrl("https://cdn.example.com/bob.png"));

        List<UserSummaryDto> results = service.searchUsers(alice.id(), "bob", 0, 20);

        assertThat(results).singleElement().satisfies(summary -> {
            assertThat(summary.id()).isEqualTo(bob.id());
            assertThat(summary.username()).isEqualTo("bob");
            assertThat(summary.avatarUrl()).isEqualTo("https://cdn.example.com/bob.png");
            assertThat(summary.roles()).containsExactly("USER");
        });
    }

    @Test
    void updateAvatar_storesImageAndPersistsTheReturnedUrl() {
        // Arrange
        User alice = users.create("alice", "alice@example.com", "hash");

        // Act — upload image bytes; storage returns a URL the service persists
        service.updateAvatar(new UpdateAvatarCommand(
                alice.id(), new byte[]{1, 2, 3}, "image/png"));

        // Assert — the FakeAvatarStorage URL is what got saved + served
        String expected = "https://cdn.test/avatars/" + alice.id() + ".png";
        assertThat(users.findById(alice.id()).orElseThrow().avatarUrl()).contains(expected);
        assertThat(service.getUserById(alice.id()).avatarUrl()).isEqualTo(expected);
    }

    @Test
    void updateAvatar_tellsChatSoOthersSeeTheNewPicture() {
        User alice = users.create("alice", "alice@example.com", "hash");

        service.updateAvatar(new UpdateAvatarCommand(alice.id(), new byte[]{1, 2, 3}, "image/png"));

        assertThat(profileNotified).containsExactly(alice.id());
    }

    @Test
    void updateUsername_tellsChatSoOthersSeeTheNewName() {
        User alice = users.create("alice", "alice@example.com", "hash");

        service.updateUsername(new com.claudiordese.session.application.service.commands.UpdateUsernameCommand(
                alice.id(), "alice2"));

        assertThat(profileNotified).containsExactly(alice.id());
    }

    @Test
    void updateBio_doesNotPushAProfileChange() {
        User alice = users.create("alice", "alice@example.com", "hash");

        service.updateBio(new UpdateBioCommand(alice.id(), "hello"));

        assertThat(profileNotified).isEmpty();
    }

    @Test
    void updateAvatar_throwsTooManyRequests_afterTenUploadsForUser() {
        // Arrange
        User alice = users.create("alice", "alice@example.com", "hash");
        UpdateAvatarCommand command = new UpdateAvatarCommand(
                alice.id(), new byte[]{1, 2, 3}, "image/png");

        for (int upload = 0; upload < 10; upload++) {
            service.updateAvatar(command);
        }

        // Act + Assert
        assertThatThrownBy(() -> service.updateAvatar(command))
                .isInstanceOf(TooManyRequestsException.class)
                .hasMessage("Too many file uploads. Please try again later");

        User bob = users.create("bob", "bob@example.com", "hash");
        assertThatCode(() -> service.updateAvatar(new UpdateAvatarCommand(
                bob.id(), new byte[]{1, 2, 3}, "image/png")))
                .doesNotThrowAnyException();
    }

    @Test
    void updateRoles_replacesRoles_alwaysKeepsUser_andNotifiesTarget() {
        User admin = users.create("admin", "admin@example.com", "hash");
        User bob = users.create("bob", "bob@example.com", "hash");

        var result = service.updateRoles(admin.id(), bob.id(), List.of("moderator", " premium "));

        assertThat(result.roles()).containsExactly("MODERATOR", "PREMIUM", "USER");
        assertThat(users.findById(bob.id()).orElseThrow().roles())
                .extracting(r -> r.name())
                .containsExactlyInAnyOrder("MODERATOR", "PREMIUM", "USER");
        assertThat(notified).containsExactly(bob.id());
    }

    @Test
    void updateRoles_rejectsUnknownRole_withoutChangingOrNotifying() {
        User admin = users.create("admin", "admin@example.com", "hash");
        User bob = users.create("bob", "bob@example.com", "hash");

        assertThatThrownBy(() -> service.updateRoles(admin.id(), bob.id(), List.of("GOD")))
                .isInstanceOf(BadRequestException.class);

        assertThat(users.findById(bob.id()).orElseThrow().roles())
                .extracting(r -> r.name()).containsExactly("USER");
        assertThat(notified).isEmpty();
    }

    @Test
    void updateRoles_refusesToRemoveOwnAdminRole() {
        User admin = users.create("admin", "admin@example.com", "hash");

        assertThatThrownBy(() -> service.updateRoles(admin.id(), admin.id(), List.of("MODERATOR")))
                .isInstanceOf(ForbiddenException.class);
        assertThat(notified).isEmpty();
    }

    @Test
    void listUsers_returnsEveryoneExceptTheRequester() {
        User admin = users.create("admin", "admin@example.com", "hash");
        users.create("bob", "bob@example.com", "hash");
        users.create("carol", "carol@example.com", "hash");

        var list = service.listUsers(admin.id(), 0, 20);

        assertThat(list).extracting(UserSummaryDto::username)
                .containsExactlyInAnyOrder("bob", "carol");
    }

    @Test
    void updateBio_trimsTheText_andABlankValueClearsIt() {
        User alice = users.create("alice", "alice@example.com", "hash");

        service.updateBio(new UpdateBioCommand(alice.id(), "  Loves late-night ranked  "));
        assertThat(users.findById(alice.id()).orElseThrow().bio()).contains("Loves late-night ranked");

        service.updateBio(new UpdateBioCommand(alice.id(), "   "));
        assertThat(users.findById(alice.id()).orElseThrow().bio()).isEmpty();
    }

    @Test
    void updateBio_rejectsAnythingOver500Characters() {
        User alice = users.create("alice", "alice@example.com", "hash");

        assertThatThrownBy(() -> service.updateBio(new UpdateBioCommand(alice.id(), "x".repeat(501))))
                .isInstanceOf(BadRequestException.class);
        assertThat(users.findById(alice.id()).orElseThrow().bio()).isEmpty();
    }
}
