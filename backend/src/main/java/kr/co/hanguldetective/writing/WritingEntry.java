package kr.co.hanguldetective.writing;

import jakarta.persistence.*;
import kr.co.hanguldetective.student.StudentProfile;
import java.time.Instant;
import java.util.*;

@Entity @Table(name = "writings")
public class WritingEntry {
    @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) private StudentProfile student;
    @Column(nullable = false, columnDefinition = "text") private String text;
    @Column(nullable = false, length = 20) private String inputType = "KEYBOARD";
    @Column(nullable = false) private Instant createdAt = Instant.now();
    @OneToMany(mappedBy = "writing", cascade = CascadeType.ALL, orphanRemoval = true) private List<WritingError> errors = new ArrayList<>();
    protected WritingEntry() {}
    public WritingEntry(StudentProfile student, String text) { this.student=student; this.text=text; }
    public UUID getId() { return id; }
    public StudentProfile getStudent() { return student; }
    public String getText() { return text; }
    public Instant getCreatedAt() { return createdAt; }
    public List<WritingError> getErrors() { return errors; }
    public void addError(WritingError error) { errors.add(error); error.setWriting(this); }
}
