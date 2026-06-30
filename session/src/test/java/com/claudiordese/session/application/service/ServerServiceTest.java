package com.claudiordese.session.application.service;

import com.claudiordese.exceptions.ConflictException;
import com.claudiordese.exceptions.ForbiddenException;
import com.claudiordese.exceptions.NotFoundException;
import com.claudiordese.session.application.domain.User;
import com.claudiordese.session.application.port.ServerStore;
import com.claudiordese.session.application.port.UserStore;
import com.claudiordese.session.application.service.commands.AddServerMemberCommand;
import com.claudiordese.session.application.service.commands.CreateServerCommand;
import com.claudiordese.session.application.service.result.ServerResult;
import com.claudiordese.session.support.InMemoryServerStore;
import com.claudiordese.session.support.InMemoryUserStore;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ServerServiceTest {

    private ServerStore servers;
    private UserStore users;
    private ServerService service;

    private UUID ownerId;
    private UUID memberId;

    @BeforeEach
    void setUp() {
        servers = new InMemoryServerStore();
        users = new InMemoryUserStore();
        service = new ServerService(servers, users);

        User owner = users.create("alice", "alice@example.com", "hash");
        User other = users.create("bob", "bob@example.com", "hash");
        ownerId = owner.id();
        memberId = other.id();
    }

    @Test
    void create_makesOwnerTheFirstMember() {
        // Act
        ServerResult result = service.create(new CreateServerCommand(ownerId, "Yapster Hangout"));

        // Assert
        assertThat(result.name()).isEqualTo("Yapster Hangout");
        assertThat(result.ownerId()).isEqualTo(ownerId);
        assertThat(result.members()).containsExactly(ownerId);
    }

    @Test
    void addMember_addsExistingUser_whenRequesterIsOwner() {
        // Arrange
        ServerResult server = service.create(new CreateServerCommand(ownerId, "Hangout"));

        // Act
        ServerResult updated = service.addMember(
                new AddServerMemberCommand(server.id(), ownerId, memberId));

        // Assert
        assertThat(updated.members()).containsExactlyInAnyOrder(ownerId, memberId);
    }

    @Test
    void addMember_throwsForbidden_whenRequesterIsNotOwner() {
        // Arrange
        ServerResult server = service.create(new CreateServerCommand(ownerId, "Hangout"));

        // Act + Assert — bob (not owner) tries to add himself
        assertThatThrownBy(() -> service.addMember(
                new AddServerMemberCommand(server.id(), memberId, memberId)))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void addMember_throwsNotFound_whenServerDoesNotExist() {
        assertThatThrownBy(() -> service.addMember(
                new AddServerMemberCommand(UUID.randomUUID(), ownerId, memberId)))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    void addMember_throwsNotFound_whenUserDoesNotExist() {
        ServerResult server = service.create(new CreateServerCommand(ownerId, "Hangout"));

        assertThatThrownBy(() -> service.addMember(
                new AddServerMemberCommand(server.id(), ownerId, UUID.randomUUID())))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    void addMember_throwsConflict_whenUserAlreadyMember() {
        ServerResult server = service.create(new CreateServerCommand(ownerId, "Hangout"));
        service.addMember(new AddServerMemberCommand(server.id(), ownerId, memberId));

        assertThatThrownBy(() -> service.addMember(
                new AddServerMemberCommand(server.id(), ownerId, memberId)))
                .isInstanceOf(ConflictException.class);
    }

    @Test
    void listFor_returnsOnlyServersTheUserBelongsTo() {
        // Arrange — bob is in "Hangout" but not in "Private"
        ServerResult hangout = service.create(new CreateServerCommand(ownerId, "Hangout"));
        service.create(new CreateServerCommand(ownerId, "Private"));
        service.addMember(new AddServerMemberCommand(hangout.id(), ownerId, memberId));

        // Act + Assert
        assertThat(service.listFor(memberId))
                .extracting(ServerResult::name)
                .containsExactly("Hangout");
        assertThat(service.listFor(ownerId))
                .extracting(ServerResult::name)
                .containsExactlyInAnyOrder("Hangout", "Private");
    }
}
