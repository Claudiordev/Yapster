package com.claudiordese.comms.application.port;

import com.claudiordese.comms.application.service.result.MessageResult;

public interface MessageProviderGateway {

    /**
     * Hand a new message to the provider. Returns as soon as the provider has
     * accepted/queued it — actual delivery happens asynchronously on their side.
     */
    MessageResult send(String to, String body);

    /**
     * Re-fetch a previously-sent message by its provider ID to get the
     * provider's current view of the status (queued → sent → delivered, or
     * failed). Used to upgrade our audit row from the initial "queued" snapshot
     * to whatever Twilio's eventual state is.
     */
    MessageResult fetch(String providerId);
}
