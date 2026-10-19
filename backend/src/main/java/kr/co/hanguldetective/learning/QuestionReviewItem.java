package kr.co.hanguldetective.learning;

import jakarta.persistence.*;
import kr.co.hanguldetective.student.StudentProfile;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "question_review_items", uniqueConstraints = @UniqueConstraint(
    name = "uk_question_review_student_chapter_question_number",
    columnNames = {"student_id", "chapter_date", "chapter_number", "question_id"}
))
public class QuestionReviewItem {
    @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "student_id", nullable = false) private StudentProfile student;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "question_id", nullable = false) private LearningQuestion question;
    @Column(name = "chapter_date", nullable = false) private LocalDate chapterDate;
    @Column(name = "chapter_number", nullable = false, columnDefinition = "integer default 1") private int chapterNumber;
    @Column(nullable = false) private int reviewAttempts;
    @Column(nullable = false) private boolean solved;
    @Column(nullable = false) private Instant createdAt = Instant.now();

    protected QuestionReviewItem() {}

    public QuestionReviewItem(StudentProfile student, LearningQuestion question, LocalDate chapterDate, int chapterNumber) {
        this.student = student;
        this.question = question;
        this.chapterDate = chapterDate;
        this.chapterNumber = chapterNumber;
    }

    public boolean submitReview(String answer) {
        if (!solved) reviewAttempts++;
        solved = java.text.Normalizer.normalize(question.getAnswer(), java.text.Normalizer.Form.NFC)
            .equals(java.text.Normalizer.normalize(answer.trim(), java.text.Normalizer.Form.NFC));
        return solved;
    }

    public UUID getId() { return id; }
    public StudentProfile getStudent() { return student; }
    public LearningQuestion getQuestion() { return question; }
    public LocalDate getChapterDate() { return chapterDate; }
    public int getChapterNumber() { return chapterNumber; }
    public int getReviewAttempts() { return reviewAttempts; }
    public boolean isSolved() { return solved; }
    public Instant getCreatedAt() { return createdAt; }
}
