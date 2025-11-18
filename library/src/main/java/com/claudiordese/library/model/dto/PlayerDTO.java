package com.claudiordese.library.model.dto;

import com.claudiordese.library.model.entity.MoveEntity;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.List;
import java.util.UUID;

public record PlayerDTO(UUID id, String username, List<MoveEntity> moveList, int gamePoints, int score) {

    @Override
    public String toString() {
        try {
            return new ObjectMapper().writeValueAsString(this);
        } catch (Exception e) {
            return "{}";
        }
    }
}
