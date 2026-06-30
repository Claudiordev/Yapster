package com.claudiordese.session.application.service;

import com.claudiordese.exceptions.ConflictException;
import com.claudiordese.exceptions.ForbiddenException;
import com.claudiordese.exceptions.NotFoundException;
import com.claudiordese.session.application.domain.Server;
import com.claudiordese.session.application.port.ServerStore;
import com.claudiordese.session.application.port.UserStore;
import com.claudiordese.session.application.service.commands.AddServerMemberCommand;
import com.claudiordese.session.application.service.commands.CreateServerCommand;
import com.claudiordese.session.application.service.result.ServerResult;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class ServerService {

    private final ServerStore servers;
    private final UserStore users;

    public ServerService(ServerStore servers, UserStore users) {
        this.servers = servers;
        this.users = users;
    }

    public ServerResult create(CreateServerCommand cmd) {
        Server server = servers.create(cmd.name(), cmd.ownerId());
        return ServerResult.from(server);
    }

    /**
     * Only the owner may add members. The target must exist and not already
     * be a member.
     */
    @Transactional
    public ServerResult addMember(AddServerMemberCommand cmd) {
        Server server = servers.findById(cmd.serverId())
                .orElseThrow(() -> new NotFoundException("server_not_found", "Server not found"));

        if (!server.isOwner(cmd.requesterId())) {
            throw new ForbiddenException("not_server_owner",
                    "Only the server owner can add members");
        }
        if (users.findById(cmd.userIdToAdd()).isEmpty()) {
            throw new NotFoundException("user_not_found", "User to add not found");
        }
        if (server.hasMember(cmd.userIdToAdd())) {
            throw new ConflictException("already_member",
                    "User is already a member of this server");
        }

        return ServerResult.from(servers.update(server.withMember(cmd.userIdToAdd())));
    }

    public List<ServerResult> listFor(UUID userId) {
        return servers.listByMember(userId).stream()
                .map(ServerResult::from)
                .toList();
    }
}
