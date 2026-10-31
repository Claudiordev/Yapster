package com.claudiordese.library.exceptions.response;

import lombok.Data;

@Data
public class ErrorResponse {
    private int status;
    private String message;
}
