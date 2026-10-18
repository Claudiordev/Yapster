package com.claudiordese.chat.support;

import com.claudiordese.chat.infrastructure.adapter.socket.ClusterEnvelope;
import com.claudiordese.chat.infrastructure.adapter.socket.ClusterEventPublisher;
import com.claudiordese.chat.infrastructure.adapter.socket.WebSocketEventGateway;

import java.util.ArrayList;
import java.util.List;

/** Pub/sub in one JVM: everything published reaches every subscribed gateway, the publisher included, like Redis. */
public class LoopbackClusterBus implements ClusterEventPublisher {

    private final List<WebSocketEventGateway> subscribers = new ArrayList<>();
    private final List<ClusterEnvelope> published = new ArrayList<>();
    private boolean failing;

    public void subscribe(WebSocketEventGateway gateway) {
        subscribers.add(gateway);
    }

    public void setFailing(boolean failing) {
        this.failing = failing;
    }

    public List<ClusterEnvelope> published() {
        return published;
    }

    @Override
    public void publish(ClusterEnvelope envelope) {
        if (failing) throw new IllegalStateException("redis down");
        published.add(envelope);
        subscribers.forEach(gateway -> gateway.deliverFromCluster(envelope));
    }
}
