package com.claudiordese.session.application.port;

import com.claudiordese.session.application.domain.GoogleIdentity;

/** Exchanges a Google authorization code for the signed-in Google account. */
public interface GoogleIdentityClient {

    /**
     * @throws com.claudiordese.exceptions.InvalidAuthorizationException if Google rejects the
     *         code or the ID token fails validation
     */
    GoogleIdentity exchange(String code, String redirectUri, String codeVerifier, String expectedNonce);
}
