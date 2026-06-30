package com.claudiordese.comms.infrastructure.provider;

import com.claudiordese.comms.application.port.MessageProviderGateway;
import com.claudiordese.comms.application.service.result.MessageResult;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.UUID;

/**
 * Load-test / local-dev stand-in for Twilio. Activated with
 * {@code comms.provider=stub} (e.g. {@code COMMS_PROVIDER=stub} in Docker) so
 * tools like `hey` can hammer the send endpoint without sending real SMS or
 * incurring Twilio charges. Simulates provider latency so traces and latency
 * percentiles keep a realistic shape.
 */
@Component
@ConditionalOnProperty(name = "comms.provider", havingValue = "stub")
public class StubMessageProviderGateway implements MessageProviderGateway {

    private static final Logger log = LoggerFactory.getLogger(StubMessageProviderGateway.class);

    private final long simulatedLatencyMs;

    public StubMessageProviderGateway(
            @Value("${comms.stub.simulated-latency-ms:50}") long simulatedLatencyMs) {
        this.simulatedLatencyMs = simulatedLatencyMs;
        log.warn("StubMessageProviderGateway active — NO real SMS will be sent (simulated latency {}ms)",
                simulatedLatencyMs);
    }

    @Override
    public MessageResult send(String to, String body) {
        simulateProviderCall();
        return new MessageResult("STUB-" + UUID.randomUUID(), "queued", "-0.0075", "USD");
    }

    @Override
    public MessageResult fetch(String providerId) {
        simulateProviderCall();
        return new MessageResult(providerId, "delivered", "-0.0075", "USD");
    }

    private void simulateProviderCall() {
        if (simulatedLatencyMs <= 0) return;
        try {
            Thread.sleep(simulatedLatencyMs);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
