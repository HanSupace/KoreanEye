package kr.co.hanguldetective.auth;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity @Table(name = "parent_accounts")
public class ParentAccount {
    @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
    @Column(nullable = false, unique = true, length = 254) private String email;
    @Column(nullable = false) private String passwordHash;
    @Column(nullable = false) private Instant createdAt = Instant.now();
    protected ParentAccount() {}
    public ParentAccount(String email, String passwordHash) { this.email = email.toLowerCase(); this.passwordHash = passwordHash; }
    public UUID getId() { return id; }
    public String getEmail() { return email; }
    public String getPasswordHash() { return passwordHash; }
}
