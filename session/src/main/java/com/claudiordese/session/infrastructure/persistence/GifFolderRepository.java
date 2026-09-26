package com.claudiordese.session.infrastructure.persistence;

import com.claudiordese.session.infrastructure.entity.GifFolderEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
interface GifFolderRepository extends JpaRepository<GifFolderEntity, UUID> {

    List<GifFolderEntity> findByUserIdOrderByDefaultFolderDescCreatedAtAsc(UUID userId);

    Optional<GifFolderEntity> findByIdAndUserId(UUID id, UUID userId);
}
