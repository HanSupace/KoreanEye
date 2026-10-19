package kr.co.hanguldetective.learning;

import jakarta.persistence.*;
import kr.co.hanguldetective.student.StudentProfile;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "learning_chapters")
public class LearningChapter {
    @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "student_id", nullable = false) private StudentProfile student;
    @Column(name = "chapter_date", nullable = false) private LocalDate chapterDate;
    @Column(name = "chapter_number", nullable = false, columnDefinition = "integer default 1") private int chapterNumber;
    @Column(nullable = false) private Instant createdAt = Instant.now();
    @OneToMany(mappedBy = "chapter", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("position ASC") private List<LearningChapterQuestion> questions = new ArrayList<>();

    protected LearningChapter() {}

    public LearningChapter(StudentProfile student, LocalDate chapterDate, int chapterNumber) {
        this.student = student;
        this.chapterDate = chapterDate;
        this.chapterNumber = chapterNumber;
    }

    public void addQuestion(LearningQuestion question) {
        questions.add(new LearningChapterQuestion(this, question, questions.size()));
    }

    public UUID getId() { return id; }
    public StudentProfile getStudent() { return student; }
    public LocalDate getChapterDate() { return chapterDate; }
    public int getChapterNumber() { return chapterNumber; }
    public Instant getCreatedAt() { return createdAt; }
    public List<LearningChapterQuestion> getQuestions() { return questions; }
    public int getCompletedCount() { return (int) questions.stream().filter(LearningChapterQuestion::isCompleted).count(); }
    public boolean isComplete() { return questions.isEmpty() || getCompletedCount() == questions.size(); }
    public boolean containsQuestion(UUID questionId) {
        return questions.stream().anyMatch(item -> item.getQuestion().getId().equals(questionId));
    }
}
