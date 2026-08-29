package com.claudiordese.session.application.service.commands;

public record RegisterCommand(String username,
                              String email,
                              String confirmEmail,
                              String password,
                              String clientIp) {

    public boolean emailsMatching() {
        return email != null && email.equals(confirmEmail);
    }
}
