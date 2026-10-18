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
    @GetMapping("/api/students/{studentId}/learning-history") public List<LearningService.DayRecord> history(@PathVariable UUID studentId,Principal p){return learning.history(studentId,p.getName());}
    @GetMapping("/api/students/{studentId}/daily-learning") public LearningService.DailyDto daily(@PathVariable UUID studentId,Principal p){return learning.daily(studentId,p.getName());}
    @GetMapping("/api/students/{studentId}/questions/today") public List<LearningService.QuestionDto> questions(@PathVariable UUID studentId,Principal p)throws Exception{return learning.today(studentId,p.getName());}
    @PostMapping("/api/questions/{questionId}/attempt") public LearningService.AttemptResult attempt(@PathVariable UUID questionId,@Valid @RequestBody AnswerRequest body,Principal p){return learning.attempt(questionId,body.studentId(),p.getName(),body.answer());}
}
