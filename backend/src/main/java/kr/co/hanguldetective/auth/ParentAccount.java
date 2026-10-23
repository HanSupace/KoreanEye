package kr.co.hanguldetective.auth;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity @Table(name = "parent_accounts")
public class ParentAccount {
    @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
    // Keep the legacy column name so existing accounts remain usable as usernames.
    @Column(name = "email", nullable = false, unique = true, length = 254) private String username;
    @Column(nullable = false) private String passwordHash;
    @Column(nullable = false) private Instant createdAt = Instant.now();
    @Column(nullable = false, length = 16, columnDefinition = "varchar(16) default 'TYPE'") private String preferredInputMode = "TYPE";
    protected ParentAccount() {}
    public ParentAccount(String username, String passwordHash) { this.username = username; this.passwordHash = passwordHash; }
    public UUID getId() { return id; }
    public Instant getCreatedAt() { return createdAt; }
    public String getUsername() { return username; }
    public String getPasswordHash() { return passwordHash; }
    public String getPreferredInputMode() { return preferredInputMode; }
    public void setPreferredInputMode(String preferredInputMode) { this.preferredInputMode = preferredInputMode; }
}
