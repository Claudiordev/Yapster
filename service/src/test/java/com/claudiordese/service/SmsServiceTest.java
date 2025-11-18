package com.claudiordese.service;

import com.claudiordese.dto.MessageRequest;
import com.claudiordese.exceptions.InterdictedException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import static org.hamcrest.Matchers.containsString;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

public class SmsServiceTest {

    private SmsService smsService;
    private MockRestServiceServer server;

    @BeforeEach
    void setup() {
        RestClient.Builder builder = RestClient.builder().baseUrl("https://api.twilio.com");
        server = MockRestServiceServer.bindTo(builder).build();
        RestClient client = builder.build();

        String sender = "+15551234567";
        String sid = "AC123";

        smsService = new SmsService(client,sid,sender);
    }

    @Test
    void sendMessage() {
        server.expect(requestTo("https://api.twilio.com/2010-04-01/Accounts/AC123/Messages.json"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(header("Content-Type", containsString(MediaType.APPLICATION_FORM_URLENCODED_VALUE)))
                .andExpect(content().string(containsString("To=%2B46700000000&From=%2B15551234567&Body=Hello+world")))
                .andRespond(withSuccess("""
                        {
                          "date_sent": "",
                          "body": "Hello world",
                          "to": "+46700000000",
                          "price": "",
                          "price_unit": "USD",
                          "status": "queued"
                          }""", MediaType.APPLICATION_JSON));

        var result = smsService.sendMessage(new MessageRequest("+46700000000", "Hello world"));

        assertEquals("queued", result.status());
        assertEquals("USD", result.price_unit());

        server.verify();
    }

    @Test
    void sendMessage_when401() {
        server.expect(requestTo("https://api.twilio.com/2010-04-01/Accounts/AC123/Messages.json")).andRespond(withStatus(HttpStatus.UNAUTHORIZED));

        assertThrows(InterdictedException.class,
                () -> smsService.sendMessage(new MessageRequest("+46712345600", "Hello world")));

        server.verify();
    }
}
