package com.claudiordese.library.old;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.Data;

@Data
@Embeddable
public class RoleId {

    @Column(name = "username",length = 50)
    private String username;

    @Column(name = "role",length = 50)
    private String role;
}
