package com.claudiordese.comms.infrastructure.provider;

import com.claudiordese.comms.application.port.MessageProviderGateway;
import com.claudiordese.comms.application.port.ProviderSendResult;
import com.claudiordese.exceptions.InvalidAuthorizationException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

@Component
public class RestClientMessageProviderGateway implements MessageProviderGateway {

    private final RestClient commsRestClient;
    private final String sid;
    private final String senderNumber;

    public RestClientMessageProviderGateway(RestClient commsRestClient,
                                            @Value("${comms.provider.sid}") String sid,
                                            @Value("${comms.provider.sender.phone_number}") String senderNumber) {
        this.commsRestClient = commsRestClient;
        this.sid = sid;
        this.senderNumber = senderNumber;
    }

    @Override
    public ProviderSendResult send(String to, String body) {
        TwilioProviderMessage response = commsRestClient.post()
                .uri("/2010-04-01/Accounts/" + sid + "/Messages.json")
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .body(
                        "To=" + encode(to) +
                        "&From=" + encode(senderNumber) +
                        "&Body=" + encode(body))
                .retrieve()
                .onStatus(status -> status.value() == 401, (req, res) -> {
                    throw new InvalidAuthorizationException("401",
                            "No permission to send messages, verify the provider configuration.");
                })
                .body(TwilioProviderMessage.class);

        if (response == null) {
            return new ProviderSendResult(null, null, null, null);
        }
        return new ProviderSendResult(response.sid(), response.price(), response.priceUnit(), response.status());
    }

    private static String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }
}
