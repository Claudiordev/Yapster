package com.claudiordese.session.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Data;

import java.time.Instant;
import java.util.UUID;

@Data
@Entity
@Table(name="refresh_token", schema = "public")
public class RefreshToken {

    @Id
    @GeneratedValue
    private UUID id;
    private String token;
    private String username;
    private Instant expiryDate;
    private boolean revoked;
}



//TODO Add a scheduler job on SQL to set the revoked to true in the table