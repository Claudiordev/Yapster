package com.claudiordese.chat.infrastructure.controller.responses;

import com.claudiordese.chat.application.domain.chat.types.UserStatusType;

import java.util.UUID;

public record MemberView(UUID id, UserStatusType statusType) {
}
