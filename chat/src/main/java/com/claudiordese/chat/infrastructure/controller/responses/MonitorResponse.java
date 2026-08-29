package com.claudiordese.chat.infrastructure.controller.responses;

public record MonitorResponse(int onlineUsers, int onlineDevices) {

    public static MonitorResponse of(int onlineUsers, int onlineDevices) {
        return new MonitorResponse(onlineUsers, onlineDevices);
    }
}
