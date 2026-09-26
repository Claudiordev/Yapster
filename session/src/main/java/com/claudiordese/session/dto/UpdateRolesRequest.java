package com.claudiordese.session.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

/** Full replacement list of role names for a user. */
public record UpdateRolesRequest(@NotNull @Size(max = 20) List<String> roles) {}
