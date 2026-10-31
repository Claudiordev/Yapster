package com.claudiordese.library.repository;

import com.claudiordese.library.model.domain.Move;
import com.claudiordese.library.model.entity.MoveEntity;
import com.claudiordese.library.model.enums.MoveEventType;
import jakarta.persistence.EntityManager;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Repository
public class MoveDAOImpl implements MoveDAO {

    private EntityManager entityManager;

    @Autowired
    public MoveDAOImpl(EntityManager entityManager) {
        this.entityManager = entityManager;
    }

    @Override
    @Transactional
    public void save(Move move) {
        entityManager.persist(move);
    }

    @Override
    public List<MoveEntity> findAll() {
        var query = entityManager.createQuery("FROM MoveEntity", MoveEntity.class);

        return query.getResultList();
    }

    @Override
    public List<MoveEntity> findAllByPlayer(UUID uuid) {
        var query = entityManager.createQuery("FROM MoveEntity WHERE player.id = :uuid", MoveEntity.class);
        query.setParameter("uuid", uuid);

        return query.getResultList();
    }

    @Override
    public void updateMoveType(UUID moveId, MoveEventType moveEventType) {
        MoveEntity move = entityManager.find(MoveEntity.class, moveId);

        move.setMoveEventType(moveEventType);

        entityManager.merge(move);
    }

    @Override
    public void deleteMove(UUID moveId) {
        MoveEntity move = entityManager.find(MoveEntity.class, moveId);

        entityManager.remove(move);
    }
}
