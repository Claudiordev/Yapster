package com.claudiordese.chat.infrastructure.controller.request;

import java.util.Set;
import java.util.UUID;

public record CreateGroupRequest(String groupName, Set<UUID> memberIds) {}
