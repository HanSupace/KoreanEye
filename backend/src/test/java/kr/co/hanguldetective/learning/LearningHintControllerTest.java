package kr.co.hanguldetective.learning;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.*;
import kr.co.hanguldetective.student.StudentService;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class LearningHintControllerTest {
    final LearningQuestionRepository questions=mock(LearningQuestionRepository.class);
    final StudentService students=mock(StudentService.class);
    final LearningHintController controller=new LearningHintController(questions,mock(QuestionReviewRepository.class),students,new ObjectMapper());
    @Test void rejectsUnownedStudentBeforeReadingAnswer() {
        var id=UUID.randomUUID();
        when(students.requireOwned(id,"other")).thenThrow(new ResponseStatusException(HttpStatus.NOT_FOUND));
        assertThrows(ResponseStatusException.class,()->controller.question(UUID.randomUUID(),new LearningHintController.QuestionHint(id,1),()->"other"));
        verifyNoInteractions(questions);
    }
    @Test void dictationChoicesComeFromStoredQuestions() {
        var id=UUID.randomUUID();
        var question=new LearningQuestion("dog","VOCABULARY",2,"LISTEN_AND_TYPE","듣고 써요","[]","강아지","멍멍 짖는 동물이에요.");
        var other=new LearningQuestion("cat","VOCABULARY",2,"LISTEN_AND_TYPE","듣고 써요","[]","고양이","야옹 우는 동물이에요.");
        when(questions.findById(id)).thenReturn(Optional.of(question));
        when(questions.findAllByGradeInOrderByCategoryAsc(List.of(1,2,3))).thenReturn(List.of(question,other));
        assertEquals(List.of("강아지","고양이"),controller.question(id,new LearningHintController.QuestionHint(UUID.randomUUID(),3),()->"owner").choices());
    }
}
