package com.claudiordese.chat.infrastructure.controller.request;

public record CallStatusRequest(String conversationId, boolean ongoing, int participantCount) {
}
