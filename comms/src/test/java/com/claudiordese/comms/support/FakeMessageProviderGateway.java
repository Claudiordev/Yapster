package com.claudiordese.comms.support;

import com.claudiordese.comms.application.port.MessageProviderGateway;
import com.claudiordese.comms.application.service.result.MessageResult;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.BiFunction;

public class FakeMessageProviderGateway implements MessageProviderGateway {

    public record Call(String to, String body) {}

    private final List<Call> calls = new ArrayList<>();
    private final Map<String, MessageResult> fetched = new HashMap<>();

    private BiFunction<String, String, MessageResult> responder =
            (to, body) -> new MessageResult("SM-default", "queued", "0.0075", "USD");

    public FakeMessageProviderGateway respondWith(MessageResult result) {
        this.responder = (to, body) -> result;

        return this;
    }

    public FakeMessageProviderGateway throwOnSend(RuntimeException ex) {
        this.responder = (to, body) -> { throw ex; };

        return this;
    }

    /** Pre-stage what {@link #fetch} returns for a given providerId. */
    public FakeMessageProviderGateway respondToFetchWith(String providerId, MessageResult result) {
        this.fetched.put(providerId, result);

        return this;
    }

    @Override
    public MessageResult send(String to, String body) {
        calls.add(new Call(to, body));

        return responder.apply(to, body);
    }

    @Override
    public MessageResult fetch(String providerId) {
        MessageResult result = fetched.get(providerId);
        if (result != null) return result;

        // Default: echo back a "delivered" status if nothing was staged.
        return new MessageResult(providerId, "delivered", "0.0075", "USD");
    }

    public List<Call> calls() {
        return calls;
    }
}
