package com.claudiordese.chat.infrastructure.adapter.socket;

/**
 * An already serialized server event travelling between replicas.
 *
 * @param origin  node id of the replica that published it, it has already delivered to its own sockets
 * @param userId  recipient
 * @param payload the JSON frame exactly as the browser receives it
 */
public record ClusterEnvelope(String origin, String userId, String payload) {}
