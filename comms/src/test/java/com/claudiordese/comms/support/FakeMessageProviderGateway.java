package com.claudiordese.comms.support;

import com.claudiordese.comms.application.port.MessageProviderGateway;
import com.claudiordese.comms.application.port.ProviderSendResult;

import java.util.ArrayList;
import java.util.List;
import java.util.function.BiFunction;

public class FakeMessageProviderGateway implements MessageProviderGateway {

    public record Call(String to, String body) {}

    private final List<Call> calls = new ArrayList<>();
    private BiFunction<String, String, ProviderSendResult> responder =
            (to, body) -> new ProviderSendResult("SM-default", "0.0075", "USD", "queued");

    public FakeMessageProviderGateway respondWith(ProviderSendResult result) {
        this.responder = (to, body) -> result;
        return this;
    }

    public FakeMessageProviderGateway throwOnSend(RuntimeException ex) {
        this.responder = (to, body) -> { throw ex; };
        return this;
    }

    @Override
    public ProviderSendResult send(String to, String body) {
        calls.add(new Call(to, body));
        return responder.apply(to, body);
    }

    public List<Call> calls() {
        return calls;
    }
}
