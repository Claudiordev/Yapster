package com.claudiordese.session.application.domain;

/** A verified Google account, as returned by the ID token. */
public record GoogleIdentity(String subject, String email, boolean emailVerified, String name, String picture) {}
