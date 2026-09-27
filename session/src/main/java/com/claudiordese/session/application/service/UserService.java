package com.claudiordese.session.application.service;

import com.claudiordese.exceptions.BadRequestException;
import com.claudiordese.exceptions.ForbiddenException;
import com.claudiordese.exceptions.InvalidAuthorizationException;
import com.claudiordese.exceptions.NotFound;
import com.claudiordese.exceptions.TooManyRequestsException;
import com.claudiordese.exceptions.UsernameTaken;
import com.claudiordese.session.application.config.FileUploadRateLimitPolicy;
import com.claudiordese.session.application.domain.User;
import com.claudiordese.session.application.port.AvatarStorage;
import com.claudiordese.session.application.port.PasswordHasher;
import com.claudiordese.session.application.port.ProfileChangeNotifier;
import com.claudiordese.session.application.port.RoleChangeNotifier;
import com.claudiordese.session.application.port.RateLimitGuard;
import com.claudiordese.session.application.port.UserStore;
import com.claudiordese.session.application.service.commands.UpdateAvatarCommand;
import com.claudiordese.session.application.service.commands.UpdateBioCommand;
import com.claudiordese.session.application.service.commands.UpdatePasswordCommand;
import com.claudiordese.session.application.service.commands.UpdateUsernameCommand;
import com.claudiordese.session.dto.UserDto;
import com.claudiordese.session.dto.UserProfileDto;
import com.claudiordese.session.dto.UserSummaryDto;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class UserService {

    /** Matches the users.bio column (VARCHAR 500). */
    static final int MAX_BIO_LENGTH = 500;

    private final UserStore users;
    private final PasswordHasher hasher;
    private final AvatarStorage avatarStorage;
    private final RateLimitGuard rateLimitGuard;
    private final FileUploadRateLimitPolicy fileUploadRateLimitPolicy;
    private final List<RoleChangeNotifier> roleChangeNotifiers;
    private final List<ProfileChangeNotifier> profileChangeNotifiers;

    public UserDto getUserById(UUID id) {
        User user = users.findById(id)
                .orElseThrow(() -> new NotFound("not_found", "User not found"));
        return new UserDto(user.id(), user.username(), user.avatarUrl().orElse(null), roleNames(user));
    }

    /** Paged directory of all users (admin role editor), excluding the requester. */
    public List<UserSummaryDto> listUsers(UUID requesterId, int page, int size) {
        return users.searchByUsername("", page, size).stream()
                .filter(user -> !user.id().equals(requesterId))
                .map(user -> new UserSummaryDto(
                        user.id(), user.username(), user.avatarUrl().orElse(null), roleNames(user)))
                .toList();
    }

    /** Every assignable role name — feeds the admin role editor. */
    public List<String> availableRoles() {
        return users.findAllRoleNames();
    }

    /**
     * Admin operation: replaces the target's roles with {@code requested}.
     * USER is the baseline and is always kept; an admin cannot remove their own
     * ADMIN role (lockout guard). Tells chat afterwards so the user's client
     * refreshes immediately.
     */
    @Transactional
    public UserProfileDto updateRoles(UUID actorId, UUID targetId, List<String> requested) {
        User target = users.findById(targetId)
                .orElseThrow(() -> new NotFound("not_found", "User not found"));

        Set<String> known = Set.copyOf(users.findAllRoleNames());
        Set<String> names = new LinkedHashSet<>();
        for (String raw : requested) {
            String name = raw == null ? "" : raw.strip().toUpperCase(Locale.ROOT);
            if (!known.contains(name)) {
                throw new BadRequestException("unknown_role", "Unknown role: " + raw);
            }
            names.add(name);
        }
        names.add("USER");

        if (actorId.equals(targetId) && !names.contains("ADMIN")) {
            throw new ForbiddenException("cannot_remove_own_admin",
                    "You cannot remove your own ADMIN role");
        }

        User saved = users.updateRoles(targetId, names);
        notifyAfterCommit(targetId);
        return new UserProfileDto(saved.id(), saved.username(), saved.avatarUrl().orElse(null),
                roleNames(saved), saved.bio().orElse(null));
    }

    /** Current roles straight from the store (not the JWT), for other services' permission checks. */
    public List<String> rolesOf(UUID id) {
        return roleNames(users.findById(id)
                .orElseThrow(() -> new NotFound("not_found", "User not found")));
    }

    private void notifyAfterCommit(UUID userId) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            roleChangeNotifiers.forEach(notifier -> notifier.rolesChanged(userId));
            return;
        }

        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                roleChangeNotifiers.forEach(notifier -> notifier.rolesChanged(userId));
            }
        });
    }

    /**
     * Return users profile
     * @param id users UUID
     * @return UserProfileDto
     */
    public UserProfileDto getProfile(UUID id) {
        User user = users.findById(id).orElseThrow(() -> new NotFound("not_found", "User not found"));

        return new UserProfileDto(
                user.id(),
                user.username(),
                user.avatarUrl().orElse(null),
                roleNames(user),
                user.bio().orElse(null));
    }

    /**
     * Batch profile lookup by id — used to resolve conversation members to
     * display names/avatars. Unknown ids are simply absent from the result.
     */
    public List<UserSummaryDto> getUsersByIds(List<UUID> ids) {
        return users.findByIds(ids).stream()
                .map(user -> new UserSummaryDto(
                        user.id(), user.username(), user.avatarUrl().orElse(null), roleNames(user)))
                .toList();
    }

    /**
     * Username search for the "find people" feature.
     */
    public List<UserSummaryDto> searchUsers(UUID requesterId, String usernameQuery, int page, int size) {
        return users.searchByUsername(usernameQuery.trim(), page, size).stream()
                .filter(user -> !user.id().equals(requesterId))
                .map(user -> new UserSummaryDto(
                        user.id(), user.username(), user.avatarUrl().orElse(null), roleNames(user)))
                .toList();
    }

    private static List<String> roleNames(User user) {
        return user.roles().stream()
                .map(role -> role.name())
                .sorted()
                .toList();
    }

    @Transactional
    public void updateAvatar(UpdateAvatarCommand command) {
        if (!rateLimitGuard.tryConsume(
                "file-upload:" + command.userId(),
                fileUploadRateLimitPolicy.maxAttempts(),
                fileUploadRateLimitPolicy.window())) {
            throw new TooManyRequestsException(
                    "file_upload_rate_limit_exceeded",
                    "Too many file uploads. Please try again later");
        }

        User user = users.findById(command.userId())
                .orElseThrow(() -> new NotFound("not_found", "User not found"));

        String url = avatarStorage.store(command.userId(), command.content(), command.contentType());
        users.update(user.withAvatarUrl(url));
        notifyProfileChanged(command.userId());
    }

    /** Sets the user's "About me" text: trimmed, and a blank value clears it. */
    @Transactional
    public void updateBio(UpdateBioCommand command) {
        User user = users.findById(command.userId())
                .orElseThrow(() -> new NotFound("not_found", "User not found"));

        String bio = command.bio() == null ? "" : command.bio().strip();

        if (bio.length() > MAX_BIO_LENGTH) {
            throw new BadRequestException("bio_too_long",
                    "Bio must be at most " + MAX_BIO_LENGTH + " characters");
        }

        users.update(user.withBio(bio.isEmpty() ? null : bio));
    }

    @Transactional
    public void updateUsername(UpdateUsernameCommand command) {
        User user = users.findById(command.userId())
                .orElseThrow(() -> new NotFound("not_found", "User not found"));

        if (users.existsByUsername(command.newUsername())) {
            throw new UsernameTaken("username_taken", "Username is already in use");
        }

        users.update(user.withUsername(command.newUsername()));
        notifyProfileChanged(command.userId());
    }

    /**
     * Tells the other services once the change is committed: they answer by reloading, and
     * a reload that ran before the commit would read the old picture or name.
     */
    private void notifyProfileChanged(UUID userId) {
        Runnable push = () -> profileChangeNotifiers.forEach(notifier -> notifier.profileChanged(userId));

        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            push.run();
            return;
        }

        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                push.run();
            }
        });
    }

    @Transactional
    public void updatePassword(UpdatePasswordCommand command) {
        User user = users.findById(command.userId())
                .orElseThrow(() -> new NotFound("not_found", "User not found"));

        if (user.passwordHash() == null || !hasher.matches(command.currentPassword(), user.passwordHash())) {
            throw new InvalidAuthorizationException("invalid_credentials", "Current password is incorrect");
        }

        users.update(user.withPasswordHash(hasher.hash(command.newPassword())));
    }
}
