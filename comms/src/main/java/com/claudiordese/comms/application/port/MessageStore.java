package com.claudiordese.comms.application.port;

import com.claudiordese.comms.application.domain.Message;

import java.util.List;

public interface  MessageStore {

    void save(Message message);

    List<Message> findAllBySender(String sender);
}
