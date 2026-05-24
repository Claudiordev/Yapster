package com.claudiordese.comms.service;

import com.claudiordese.comms.client.SessionClient;
import com.claudiordese.comms.dto.SendMessageRequest;
import com.claudiordese.comms.entity.Message;
import com.claudiordese.comms.entity.MessageStatus;
import com.claudiordese.comms.repository.MessageRepository;
import com.claudiordese.exceptions.InterdictedException;
import com.claudiordese.exceptions.InvalidAuthorizationException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.hamcrest.Matchers.containsString;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class CommsServiceTest {

    private CommsService commsService;
    private MockRestServiceServer server;
    private SessionClient sessionClient;
    private MessageRepository messageRepository;

    @BeforeEach
    void setup() {
        RestClient.Builder builder = RestClient.builder().baseUrl("https://api.twilio.com");
        server = MockRestServiceServer.bindTo(builder).build();
        RestClient client = builder.build();

        sessionClient = mock(SessionClient.class);
        messageRepository = mock(MessageRepository.class);

        when(messageRepository.save(any(Message.class))).thenAnswer(invocation -> {
            Message m = invocation.getArgument(0);
            if (m.getId() == null) m.setId(UUID.randomUUID());
            if (m.getCreatedAt() == null) m.setCreatedAt(Instant.now());
            m.setUpdatedAt(Instant.now());
            return m;
        });

        commsService = new CommsService(client, sessionClient, messageRepository, Optional.empty(), "AC123", "+15551234567");

        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("testuser", null, List.of()));
        when(sessionClient.getBalance("testuser")).thenReturn(new BigDecimal("100.00"));
    }

    @Test
    void sendMessage_persistsAndReturnsSent() {
        server.expect(requestTo("https://api.twilio.com/2010-04-01/Accounts/AC123/Messages.json"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(header("Content-Type", containsString(MediaType.APPLICATION_FORM_URLENCODED_VALUE)))
                .andExpect(content().string(containsString("To=%2B46700000000&From=%2B15551234567&Body=Hello+world")))
                .andRespond(withSuccess("""
                        {
                          "sid": "SM-abc-123",
                          "date_sent": "",
                          "body": "Hello world",
                          "to": "+46700000000",
                          "price": "0.0075",
                          "price_unit": "USD",
                          "status": "queued"
                        }""", MediaType.APPLICATION_JSON));

        var result = commsService.sendMessage(new SendMessageRequest("+46700000000", "Hello world"));

        assertNotNull(result.id());
        assertEquals("SM-abc-123", result.providerId());
        assertEquals(MessageStatus.SENT.name(), result.status());
        assertEquals("USD", result.priceUnit());
        verify(messageRepository, times(2)).save(any(Message.class));

        server.verify();
    }

    @Test
    void sendMessage_when401_marksMessageFailed() {
        server.expect(requestTo("https://api.twilio.com/2010-04-01/Accounts/AC123/Messages.json"))
                .andRespond(withStatus(HttpStatus.UNAUTHORIZED));

        assertThrows(InvalidAuthorizationException.class,
                () -> commsService.sendMessage(new SendMessageRequest("+46712345600", "Hello world")));

        verify(messageRepository, times(2)).save(any(Message.class));
        server.verify();
    }

    @Test
    void sendMessage_zeroBalance_throwsInterdicted() {
        when(sessionClient.getBalance("testuser")).thenReturn(BigDecimal.ZERO);

        assertThrows(InterdictedException.class,
                () -> commsService.sendMessage(new SendMessageRequest("+46700000000", "Hello world")));

        verify(messageRepository, times(0)).save(any(Message.class));
    }
}
