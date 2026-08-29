package com.claudiordese.chat.infrastructure.controller.request;

import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record AddMemberRequest(@NotNull UUID memberId) {}
