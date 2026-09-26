package com.claudiordese.session.application.domain;

import org.junit.jupiter.api.Test;

import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class UsernameGeneratorTest {

    @Test
    void usesTheLocalPartOfTheEmail() {
        assertThat(UsernameGenerator.fromEmail("user@gmail.com", n -> false)).isEqualTo("user");
        assertThat(UsernameGenerator.fromEmail("John.Doe@Example.com", n -> false)).isEqualTo("john.doe");
    }

    @Test
    void replacesUnsupportedCharacters() {
        assertThat(UsernameGenerator.fromEmail("a+b@x.com", n -> false)).isEqualTo("a_b");
    }

    @Test
    void padsShortNamesToTheMinimumLength() {
        assertThat(UsernameGenerator.fromEmail("ab@x.com", n -> false)).hasSize(3).startsWith("ab");
        assertThat(UsernameGenerator.fromEmail("a@x.com", n -> false)).hasSize(3).startsWith("a");
    }

    @Test
    void cutsLongNamesToTheMaximumLength() {
        assertThat(UsernameGenerator.fromEmail("x".repeat(60) + "@x.com", n -> false)).hasSize(30);
    }

    @Test
    void appendsANumberWhenTheNameIsTaken() {
        Set<String> taken = Set.of("user", "user2");

        assertThat(UsernameGenerator.fromEmail("user@gmail.com", taken::contains)).isEqualTo("user3");
    }

    @Test
    void aTakenMaxLengthNameStillFitsWithItsSuffix() {
        String base = "y".repeat(30);
        String result = UsernameGenerator.fromEmail(base + "@x.com", n -> n.equals(base));

        assertThat(result).hasSize(30).endsWith("2");
    }
}
