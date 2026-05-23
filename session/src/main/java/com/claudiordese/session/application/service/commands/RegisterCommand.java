package com.claudiordese.session.application.service.commands;

public record RegisterCommand(String username,
                              String email,
                              String confirmEmail,
                              String password) {

    public boolean emailsMatching() {
        return email != null && email.equals(confirmEmail);
    }
}
