package com.claudiordese.library.repository;

import com.claudiordese.library.model.domain.Move;
import com.claudiordese.library.model.entity.MoveEntity;
import com.claudiordese.library.model.enums.MoveEventType;

import java.util.List;
import java.util.UUID;

public interface MoveDAO {

    void save(Move move);

    List<MoveEntity> findAll();

    List<MoveEntity> findAllByPlayer(UUID uuid);

    void updateMoveType(UUID moveId, MoveEventType moveEventType);

    void deleteMove(UUID moveID);
}
