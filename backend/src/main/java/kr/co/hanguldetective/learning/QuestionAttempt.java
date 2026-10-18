package kr.co.hanguldetective.learning;

import jakarta.persistence.*;
import kr.co.hanguldetective.student.StudentProfile;
import java.time.Instant;
import java.util.UUID;

@Entity @Table(name = "question_attempts")
public class QuestionAttempt {
    @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) private StudentProfile student;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) private LearningQuestion question;
    @Column(nullable = false, length = 120) private String answer;
    @Column(nullable = false) private boolean correct;
    @Column(nullable = false) private Instant createdAt = Instant.now();
    protected QuestionAttempt() {}
    public QuestionAttempt(StudentProfile student, LearningQuestion question, String answer, boolean correct) { this.student=student; this.question=question; this.answer=answer; this.correct=correct; }
    public boolean isCorrect() { return correct; }
    public Instant getCreatedAt() { return createdAt; }
    public UUID getQuestionId() { return question.getId(); }
}
