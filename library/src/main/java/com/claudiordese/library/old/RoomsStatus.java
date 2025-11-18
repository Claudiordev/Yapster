package com.claudiordese.library.old;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.Data;

import java.util.List;

@Data
@Deprecated
public class RoomsStatus {
    private String timestamp;
    private List<Room> rooms;

    @Override
    public String toString() {
        try {
            return new ObjectMapper().writeValueAsString(this);
        } catch (Exception e) {
            return "{}";
        }
    }
}
