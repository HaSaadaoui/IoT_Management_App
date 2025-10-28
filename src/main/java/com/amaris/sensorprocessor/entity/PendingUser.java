package com.amaris.sensorprocessor.entity;

import lombok.Data;

import java.time.Instant;

@Data
public class PendingUser {

    private String email;              // unique key
    private String username;
    private String firstname;
    private String lastname;
    private String password;           // already BCrypt-hashed
    private String role;               // default USER
    private String icon;               // optional

    private String tokenHash;          // SHA-256 hex (or plaintext based on config)
    private Instant expiresAt;
    private Integer resendCount;       // per-window counter
    private Instant lastResendAt;      // window anchor
}


