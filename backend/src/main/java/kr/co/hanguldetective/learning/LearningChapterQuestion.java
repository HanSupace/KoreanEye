package kr.co.hanguldetective.learning;

import jakarta.persistence.*;
import java.util.UUID;

@Entity
@Table(name = "learning_chapter_questions", uniqueConstraints = @UniqueConstraint(
    name = "uk_learning_chapter_question_order",
    columnNames = {"chapter_id", "position"}
))
public class LearningChapterQuestion {
    @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "chapter_id", nullable = false) private LearningChapter chapter;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "question_id", nullable = false) private LearningQuestion question;
    @Column(nullable = false) private int position;
    @Column(nullable = false) private boolean completed;
    private java.time.Instant completedAt;

    protected LearningChapterQuestion() {}

    LearningChapterQuestion(LearningChapter chapter, LearningQuestion question, int position) {
        this.chapter = chapter;
        this.question = question;
        this.position = position;
    }

    public boolean complete(UUID questionId) {
        if (!question.getId().equals(questionId)) return false;
        if (!completed) completedAt = java.time.Instant.now();
        completed = true;
        return true;
    }

    public void completeAfterReview() {
        completed = true;
        completedAt = java.time.Instant.now();
    }

    public UUID getId() { return id; }
    public LearningChapter getChapter() { return chapter; }
    public LearningQuestion getQuestion() { return question; }
    public int getPosition() { return position; }
    public boolean isCompleted() { return completed; }
    public java.time.Instant getCompletedAt() { return completedAt; }
}
