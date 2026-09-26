package com.claudiordese.session.infrastructure.controllers.request.user;

import jakarta.validation.constraints.Size;

/** The new "About me" text. Blank or null clears it. */
public record UpdateBioRequest(@Size(max = 500) String bio) {}
