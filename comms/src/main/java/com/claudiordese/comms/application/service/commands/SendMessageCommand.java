package com.claudiordese.comms.application.service.commands;

public record SendMessageCommand(String sender, String receiver, String body) {}
