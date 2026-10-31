package com.claudiordese.library.model.domain;

import com.claudiordese.library.global.JSONSerializer;
import com.claudiordese.library.model.dto.PlayerDTO;
import com.claudiordese.library.model.enums.MoveEventType;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@AllArgsConstructor
@EqualsAndHashCode(callSuper = false)
public class Move extends JSONSerializer {
    private PlayerDTO player;
    private int x;
    private int y;
    private char symbol;
    private MoveEventType moveEventType;

    public Move setEventType(MoveEventType moveEventType) {
        this.moveEventType = moveEventType;
        return this;
    }
}
