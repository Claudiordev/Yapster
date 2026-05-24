package com.claudiordese.comms.application.port;

public interface MessageProviderGateway {
    ProviderSendResult send(String to, String body);
}
