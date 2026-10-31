package com.claudiordese.library.global;

import com.fasterxml.jackson.databind.ObjectMapper;

public abstract class JSONSerializer {
    @Override
    public String toString() {
        try {
            return new ObjectMapper().writeValueAsString(this);
        } catch (Exception e) {
            return "{}";
        }
    }
}
