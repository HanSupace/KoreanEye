package kr.co.hanguldetective.learning;

import jakarta.persistence.*;
import java.util.UUID;

@Entity @Table(name = "learning_questions")
public class LearningQuestion {
    @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
    @Column(nullable = false, length = 40) private String category;
    @Column(nullable = false) private int grade;
    @Column(nullable = false, length = 30) private String questionType;
    @Column(nullable = false, length = 500) private String prompt;
    @Column(nullable = false, columnDefinition = "text") private String choicesJson;
    @Column(nullable = false, length = 120) private String answer;
    @Column(nullable = false, length = 500) private String explanation;
    @Column(nullable = false, unique = true, length = 100) private String seedKey;
    protected LearningQuestion() {}
    public LearningQuestion(String seedKey, String category, int grade, String type, String prompt, String choicesJson, String answer, String explanation) {
        this.seedKey=seedKey; this.category=category; this.grade=grade; this.questionType=type; this.prompt=prompt; this.choicesJson=choicesJson; this.answer=answer; this.explanation=explanation;
    }
    void updateSeedContent(String category, int grade, String type, String prompt, String choicesJson, String answer, String explanation) {
        this.category=category; this.grade=grade; this.questionType=type; this.prompt=prompt; this.choicesJson=choicesJson; this.answer=answer; this.explanation=explanation;
    }
    public UUID getId() { return id; }
    public String getCategory() { return category; }
    public int getGrade() { return grade; }
    public String getQuestionType() { return questionType; }
    public String getPrompt() { return prompt; }
    public String getChoicesJson() { return choicesJson; }
    public String getAnswer() { return answer; }
    public String getExplanation() { return explanation; }
}
