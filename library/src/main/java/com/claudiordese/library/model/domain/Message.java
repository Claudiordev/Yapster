package com.claudiordese.library.model.domain;

import com.claudiordese.library.global.JSONSerializer;
import com.claudiordese.library.model.dto.PlayerDTO;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = false)
@AllArgsConstructor
public class Message extends JSONSerializer {
    private PlayerDTO player;
    private String message;
}
