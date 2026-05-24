package com.claudiordese.comms.infrastructure.kafka;

import com.claudiordese.comms.application.domain.Message;
import com.claudiordese.comms.application.port.CommsEventPublisher;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class NoopCommsEventPublisher {

    @Bean
    @ConditionalOnMissingBean(CommsEventPublisher.class)
    public CommsEventPublisher noopCommsEventPublisher() {
        return new CommsEventPublisher() {
            @Override public void queued(Message message) {}
            @Override public void sent(Message message) {}
            @Override public void failed(Message message, String reason) {}
        };
    }
}
