package kr.co.hanguldetective.learning;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.security.Principal;
import java.util.*;
import org.springframework.web.bind.annotation.*;

@RestController
public class LearningController {
    private final LearningService learning;
    public LearningController(LearningService learning){this.learning=learning;}
    public record AnswerRequest(@NotNull UUID studentId,@NotBlank String answer){}
    public record SkipRequest(@NotNull UUID studentId){}
    public record ReviewAnswerRequest(@NotBlank String answer){}
    @GetMapping("/api/students/{studentId}/learning-history") public List<LearningService.DayRecord> history(@PathVariable UUID studentId,Principal p){return learning.history(studentId,p.getName());}
    @GetMapping("/api/students/{studentId}/daily-learning") public LearningService.DailyDto daily(@PathVariable UUID studentId,Principal p){return learning.daily(studentId,p.getName());}
    @GetMapping("/api/students/{studentId}/questions/today") public List<LearningService.QuestionDto> questions(@PathVariable UUID studentId,Principal p)throws Exception{return learning.today(studentId,p.getName());}
    @GetMapping("/api/students/{studentId}/learning-progress") public LearningService.LearningProgressDto progress(@PathVariable UUID studentId,Principal p){return learning.progress(studentId,p.getName());}
    @GetMapping("/api/students/{studentId}/question-reviews") public List<LearningService.QuestionReviewChapterDto> questionReviews(@PathVariable UUID studentId,Principal p){return learning.questionReviews(studentId,p.getName());}
    @PostMapping("/api/questions/{questionId}/attempt") public LearningService.AttemptResult attempt(@PathVariable UUID questionId,@Valid @RequestBody AnswerRequest body,Principal p){return learning.attempt(questionId,body.studentId(),p.getName(),body.answer());}
    @PostMapping("/api/questions/{questionId}/skip") public void skip(@PathVariable UUID questionId,@Valid @RequestBody SkipRequest body,Principal p){learning.skip(questionId,body.studentId(),p.getName());}
    @PostMapping("/api/question-reviews/{reviewId}/attempt") public LearningService.AttemptResult attemptReview(@PathVariable UUID reviewId,@Valid @RequestBody ReviewAnswerRequest body,Principal p){return learning.attemptQuestionReview(reviewId,p.getName(),body.answer());}
}
