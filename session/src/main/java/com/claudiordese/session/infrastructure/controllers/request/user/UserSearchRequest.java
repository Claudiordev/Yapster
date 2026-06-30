package com.claudiordese.session.infrastructure.controllers.request.user;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class UserSearchRequest {

    @NotBlank
    @Size(min = 1, max = 50)
    private String query;

    @Min(0)
    private int page = 0;

    @Min(1)
    @Max(50)
    private int size = 20;
}
