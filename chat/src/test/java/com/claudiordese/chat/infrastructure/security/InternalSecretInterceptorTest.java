package com.claudiordese.chat.infrastructure.security;

import com.claudiordese.chat.infrastructure.configuration.InternalProperties;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.web.server.ResponseStatusException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class InternalSecretInterceptorTest {

    private final MockHttpServletResponse response = new MockHttpServletResponse();

    private MockHttpServletRequest requestWith(String secret) {
        MockHttpServletRequest request = new MockHttpServletRequest();

        if (secret != null) request.addHeader("X-Internal-Secret", secret);
        return request;
    }

    @Test
    void theCorrectSecretPasses() {
        InternalSecretInterceptor interceptor = new InternalSecretInterceptor(new InternalProperties("s3cret"));

        assertThat(interceptor.preHandle(requestWith("s3cret"), response, new Object())).isTrue();
    }

    @Test
    void aWrongOrMissingSecretIsForbidden() {
        InternalSecretInterceptor interceptor = new InternalSecretInterceptor(new InternalProperties("s3cret"));

        for (String bad : new String[]{"wrong", "", null}) {
            assertThatThrownBy(() -> interceptor.preHandle(requestWith(bad), response, new Object()))
                    .isInstanceOfSatisfying(ResponseStatusException.class,
                            e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN));
        }
    }

    @Test
    void anUnsetSecretRejectsEverything_evenAnEmptyHeader() {
        for (String configured : new String[]{null, "", "   "}) {
            InternalSecretInterceptor interceptor = new InternalSecretInterceptor(new InternalProperties(configured));

            assertThatThrownBy(() -> interceptor.preHandle(requestWith(""), response, new Object()))
                    .isInstanceOf(ResponseStatusException.class);
            assertThatThrownBy(() -> interceptor.preHandle(requestWith(configured), response, new Object()))
                    .isInstanceOf(ResponseStatusException.class);
        }
    }
}
