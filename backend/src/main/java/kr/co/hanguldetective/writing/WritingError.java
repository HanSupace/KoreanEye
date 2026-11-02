package kr.co.hanguldetective.writing;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity @Table(name = "writing_errors")
public class WritingError {
    @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name="writing_id", nullable=false) private WritingEntry writing;
    @Column(nullable=false) private int startIndex;
    @Column(nullable=false) private int endIndex;
    @Column(nullable=false, length=5000) private String original;
    @Column(nullable=false, length=5000) private String correct;
    @Column(nullable=false, length=40) private String category;
    @Column(nullable=false, length=500) private String explanation;
    @Column(nullable=false, length=300) private String hintLevel1;
    @Column(nullable=false, length=300) private String hintLevel2;
    @Column(nullable=false, columnDefinition="text") private String choicesJson;
    @Column(nullable=false) private int attemptCount;
    @Column(nullable=false) private int hintLevelUsed;
    @Column(nullable=false) private boolean solved;
    @Column(nullable=false) private Instant createdAt = Instant.now();
    protected WritingError() {}
    public WritingError(int startIndex,int endIndex,String original,String correct,String category,String explanation,String hintLevel1,String hintLevel2,String choicesJson) {
        if(!WritingCandidateValidator.hasCorrection(original,correct))throw new IllegalArgumentException("복습 문제에는 실제 수정 표현이 필요해요.");
        this.startIndex=startIndex;this.endIndex=endIndex;this.original=original;this.correct=correct;this.category=category;this.explanation=explanation;this.hintLevel1=hintLevel1;this.hintLevel2=hintLevel2;this.choicesJson=choicesJson;
    }
    void setWriting(WritingEntry writing) { this.writing=writing; }
    public UUID getId(){return id;} public WritingEntry getWriting(){return writing;} public int getStartIndex(){return startIndex;} public int getEndIndex(){return endIndex;}
    public String getOriginal(){return original;} public String getCorrect(){return correct;} public String getCategory(){return category;} public String getExplanation(){return explanation;}
    public String getHintLevel1(){return hintLevel1;} public String getHintLevel2(){return hintLevel2;} public String getChoicesJson(){return choicesJson;}
    public int getAttemptCount(){return attemptCount;} public int getHintLevelUsed(){return hintLevelUsed;} public boolean isSolved(){return solved;} public Instant getCreatedAt(){return createdAt;}
    public boolean submit(String answer){if(solved)return true;attemptCount++;solved=answer!=null&&correct.equals(answer.trim());return solved;}
    public int nextHint(){hintLevelUsed=Math.min(3,hintLevelUsed+1);return hintLevelUsed;}
    public void completeReview(){solved=true;}
}
