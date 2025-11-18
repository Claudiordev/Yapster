package com.claudiordese.library.repository;

import com.claudiordese.library.model.entity.Player;
import com.claudiordese.library.model.entity.Role;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;
import java.util.UUID;

public interface PlayerRepository extends JpaRepository<Player, UUID> {

    Optional<Player> findByUsername(String username);

    @Deprecated
    @Transactional
    public default Player addPlayer(Player player) {
        Role role = new Role();
        role.setRole("ROLE_USER");
        role.setPlayer(player);

        player.getRoles().add(role);

        return this.save(player);
    };
}
