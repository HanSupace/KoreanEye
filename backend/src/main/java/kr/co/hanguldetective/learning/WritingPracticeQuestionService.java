package kr.co.hanguldetective.learning;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import kr.co.hanguldetective.student.StudentProfile;
import kr.co.hanguldetective.writing.AdaptiveSpellCheckService;
import kr.co.hanguldetective.writing.WritingEntry;
import kr.co.hanguldetective.writing.WritingError;

@Service
public class WritingPracticeQuestionService {
    private static final Logger log=LoggerFactory.getLogger(WritingPracticeQuestionService.class);
    private final LearningQuestionRepository questions;
    private final AdaptiveSpellCheckService spellChecks;
    private final ObjectMapper mapper;

    public WritingPracticeQuestionService(LearningQuestionRepository questions,AdaptiveSpellCheckService spellChecks,ObjectMapper mapper){
        this.questions=questions;this.spellChecks=spellChecks;this.mapper=mapper;
    }

    @Transactional
    public void generateFor(WritingEntry writing){
        StudentProfile student=writing.getStudent();
        for(WritingError error:writing.getErrors()){
            if(error.getId()==null||error.isSolved()||questions.findBySourceWritingErrorId(error.getId()).isPresent())continue;
            String correct=error.getCorrect()==null?"":error.getCorrect().trim();
            String incorrect=error.getOriginal()==null?"":error.getOriginal().trim();
            if(correct.isBlank()||incorrect.isBlank()||correct.equals(incorrect)||correct.length()>60||incorrect.length()>60)continue;
            List<String> choices=List.of(correct,incorrect);
            var generated=spellChecks.generatePracticeSentence(error.getCategory(),correct,incorrect);
            if(generated.isEmpty())continue;
            String explanation="글쓰기에서 찾은 표현을 새 문장에서 연습해요. "+error.getExplanation();
            if(explanation.length()>500)explanation=explanation.substring(0,500);
            try{
                LearningQuestion question=new LearningQuestion("writing-error-"+error.getId(),error.getCategory(),student.getGrade(),
                    "MULTIPLE_CHOICE",generated.get(),mapper.writeValueAsString(choices),correct,explanation,student,error.getId());
                question=questions.save(question);
                logQuestion(question,student,error,choices);
            }catch(Exception exception){
                log.warn("글쓰기 맞춤 문제를 저장하지 못했어요: category={}, reason={}",error.getCategory(),exception.getClass().getSimpleName());
            }
        }
    }

    private void logQuestion(LearningQuestion question,StudentProfile student,WritingError error,List<String> choices){
        try{
            Map<String,Object> payload=new LinkedHashMap<>();
            payload.put("event","WRITING_PRACTICE_QUESTION");
            payload.put("action","created");
            payload.put("questionId",question.getId());
            payload.put("studentId",student.getId());
            payload.put("sourceWritingErrorId",error.getId());
            payload.put("category",question.getCategory());
            payload.put("prompt",question.getPrompt());
            payload.put("choices",choices);
            payload.put("answer",question.getAnswer());
            log.info("LEARNING_QUESTION_JSON {}",mapper.writeValueAsString(payload));
        }catch(Exception exception){
            log.warn("맞춤 학습 문제 JSON 로그를 만들지 못했어요: {}",exception.getClass().getSimpleName());
        }
    }
}
