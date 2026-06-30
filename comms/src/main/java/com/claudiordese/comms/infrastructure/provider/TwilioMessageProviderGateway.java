package com.claudiordese.comms.infrastructure.provider;

import com.claudiordese.comms.application.port.MessageProviderGateway;
import com.claudiordese.comms.application.service.result.MessageResult;
import com.claudiordese.comms.infrastructure.configurations.providers.TwilioProperties;
import com.claudiordese.exceptions.ServiceUnavailableException;
import com.twilio.exception.TwilioException;
import com.twilio.rest.api.v2010.account.Message;
import com.twilio.type.PhoneNumber;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name = "comms.provider", havingValue = "twilio", matchIfMissing = true)
public class TwilioMessageProviderGateway implements MessageProviderGateway {

    private static final Logger logger = LoggerFactory.getLogger(TwilioMessageProviderGateway.class);

    private final PhoneNumber sender;

    public TwilioMessageProviderGateway(TwilioProperties properties) {
        this.sender = new PhoneNumber(properties.senderPhoneNumber());
    }

    @Override
    public MessageResult send(String to, String body) {
        try {
            Message message = Message.creator(new PhoneNumber(to), sender, body).create();

            return toResult(message);
        } catch (TwilioException e) {
            logger.error("Twilio send failed", e);
            throw new ServiceUnavailableException("provider_unavailable",
                    "Unable to deliver message right now. Please try again later.");
        }
    }

    @Override
    public MessageResult fetch(String providerId) {
        try {
            Message message = Message.fetcher(providerId).fetch();

            return toResult(message);
        } catch (TwilioException e) {
            logger.error("Twilio fetch failed for {}", providerId, e);
            throw new ServiceUnavailableException("provider_unavailable",
                    "Unable to fetch message status from provider.");
        }
    }

    private static MessageResult toResult(Message message) {
        return new MessageResult(
                message.getSid(),
                message.getStatus() != null ? message.getStatus().toString() : null,
                message.getPrice(),
                message.getPriceUnit() != null ? message.getPriceUnit().getCurrencyCode() : null);
    }
}
