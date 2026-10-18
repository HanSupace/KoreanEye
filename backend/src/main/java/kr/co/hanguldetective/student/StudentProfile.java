package kr.co.hanguldetective.student;

import jakarta.persistence.*;
import kr.co.hanguldetective.auth.ParentAccount;
import java.time.Instant;
import java.util.UUID;

@Entity @Table(name = "student_profiles")
public class StudentProfile {
    @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "parent_id", nullable = false) private ParentAccount parent;
    @Column(nullable = false, length = 40) private String name;
    @Column(nullable = false) private int grade;
    @Column(length = 40) private String nickname;
    @Column(nullable = false) private Instant createdAt = Instant.now();
    protected StudentProfile() {}
    public StudentProfile(ParentAccount parent, String name, int grade, String nickname) { this.parent = parent; this.name = name; this.grade = grade; this.nickname = nickname; }
    public UUID getId() { return id; }
    public ParentAccount getParent() { return parent; }
    public String getName() { return name; }
    public int getGrade() { return grade; }
    public String getNickname() { return nickname; }
}
