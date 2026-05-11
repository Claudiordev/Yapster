package com.claudiordese.utils;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;

import java.net.URI;

/**
 * Problem Details for HTTP APIs
 */
public final class ProblemDetails {

    private static final String DEFAULT_URL = "http://localhost:8080/error/";

    private ProblemDetails() {}

    public static ProblemDetail of(HttpStatus status, String code, String detail, String instance) {
        ProblemDetail problem = ProblemDetail.forStatus(status);
        problem.setTitle(code);
        problem.setDetail(detail);
        problem.setType(URI.create(DEFAULT_URL + code));
        problem.setInstance(URI.create(instance));
        problem.setProperty("code", code);
        return problem;
    }
}
