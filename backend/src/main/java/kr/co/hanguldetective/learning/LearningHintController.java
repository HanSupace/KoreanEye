package kr.co.hanguldetective.learning;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.security.Principal;
import java.util.*;
import kr.co.hanguldetective.student.StudentService;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
public class LearningHintController {
    private final LearningQuestionRepository questions;
    private final QuestionReviewRepository reviews;
    private final StudentService students;
    private final ObjectMapper mapper;
    public LearningHintController(LearningQuestionRepository questions,QuestionReviewRepository reviews,StudentService students,ObjectMapper mapper) {
        this.questions=questions;this.reviews=reviews;this.students=students;this.mapper=mapper;
    }
    public record QuestionHint(@NotNull UUID studentId,@Min(1) @Max(3) int level) {}
    public record ReviewHint(@Min(1) @Max(3) int level) {}
    @PostMapping("/api/questions/{id}/hint") @Transactional(readOnly=true)
    public HintGuide.Result question(@PathVariable UUID id,@Valid @RequestBody QuestionHint body,Principal principal) {
        students.requireOwned(body.studentId(),principal.getName());
        return guide(questions.findById(id).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND)),body.level());
    }
    @PostMapping("/api/question-reviews/{id}/hint") @Transactional(readOnly=true)
    public HintGuide.Result review(@PathVariable UUID id,@Valid @RequestBody ReviewHint body,Principal principal) {
        var item=reviews.findById(id).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND));
        students.requireOwned(item.getStudent().getId(),principal.getName());
        return guide(item.getQuestion(),body.level());
    }
    private HintGuide.Result guide(LearningQuestion question,int level) {
        List<String> choices;
        if(level==3&&"LISTEN_AND_TYPE".equals(question.getQuestionType())) {
            choices=questions.findAllByGradeInOrderByCategoryAsc(List.of(1,2,3)).stream()
                .filter(q->"LISTEN_AND_TYPE".equals(q.getQuestionType()))
                .map(LearningQuestion::getAnswer).filter(a->!a.equals(question.getAnswer())).distinct().sorted().limit(2).toList();
        } else {
            try { choices=mapper.readValue(question.getChoicesJson(),new TypeReference<List<String>>(){}); }
            catch(Exception ignored) { choices=List.of(); }
        }
        return HintGuide.create(question.getCategory(),question.getAnswer(),question.getExplanation(),choices,level);
    }
}
