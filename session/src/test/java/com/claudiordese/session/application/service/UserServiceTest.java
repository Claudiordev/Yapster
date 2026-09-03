package com.claudiordese.session.application.service;

import com.claudiordese.exceptions.TooManyRequestsException;
import com.claudiordese.session.application.config.FileUploadRateLimitPolicy;
import com.claudiordese.session.application.domain.User;
import com.claudiordese.session.application.port.PasswordHasher;
import com.claudiordese.session.application.port.RateLimitGuard;
import com.claudiordese.session.application.port.UserStore;
import com.claudiordese.session.application.service.commands.UpdateAvatarCommand;
import com.claudiordese.session.dto.UserSummaryDto;
import com.claudiordese.session.support.FakeAvatarStorage;
import com.claudiordese.session.support.InMemoryRateLimitGuard;
import com.claudiordese.session.support.InMemoryUserStore;
import com.claudiordese.session.support.PlainTextPasswordHasher;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

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
                new FileUploadRateLimitPolicy(10, Duration.ofHours(1)));
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
}
