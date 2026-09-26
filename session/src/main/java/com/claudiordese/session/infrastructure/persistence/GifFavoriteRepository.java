package com.claudiordese.session.infrastructure.persistence;

import com.claudiordese.session.infrastructure.entity.GifFavoriteEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
interface GifFavoriteRepository extends JpaRepository<GifFavoriteEntity, UUID> {

    /** Newest first; an empty query matches everything. */
    @Query("""
            select g from GifFavoriteEntity g
            where g.folderId = :folderId
              and (:query = '' or lower(g.title) like lower(concat('%', :query, '%')))
            order by g.createdAt desc
            """)
    List<GifFavoriteEntity> search(@Param("folderId") UUID folderId, @Param("query") String query);

    boolean existsByFolderIdAndGifId(UUID folderId, String gifId);

    void deleteByFolderIdAndGifId(UUID folderId, String gifId);

    long countByFolderId(UUID folderId);

    @Query("""
            select g.gifId, g.folderId from GifFavoriteEntity g
            where g.folderId in (select f.id from GifFolderEntity f where f.userId = :userId)
            """)
    List<Object[]> membershipRows(@Param("userId") UUID userId);

    @Query("""
            select count(distinct g.gifId) from GifFavoriteEntity g
            where g.folderId in (select f.id from GifFolderEntity f where f.userId = :userId)
            """)
    long distinctGifCount(@Param("userId") UUID userId);

    @Query("""
            select count(g) > 0 from GifFavoriteEntity g
            where g.gifId = :gifId
              and g.folderId in (select f.id from GifFolderEntity f where f.userId = :userId)
            """)
    boolean userHasGif(@Param("userId") UUID userId, @Param("gifId") String gifId);
}
