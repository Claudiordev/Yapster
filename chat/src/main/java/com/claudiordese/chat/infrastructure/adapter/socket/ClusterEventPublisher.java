package com.claudiordese.chat.infrastructure.adapter.socket;

/** Hands an event to the other replicas so they can write it to the sockets they hold. */
public interface ClusterEventPublisher {

    void publish(ClusterEnvelope envelope);
}
