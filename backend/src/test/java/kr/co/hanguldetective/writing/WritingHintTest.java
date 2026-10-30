package kr.co.hanguldetective.writing;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.*;
import kr.co.hanguldetective.learning.QuestionAttemptRepository;
import kr.co.hanguldetective.student.StudentService;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class WritingHintTest {
    @Test void unsolvedWritingDoesNotSendAnswerExplanationOrFutureHints() {
        var studentId=UUID.randomUUID();
        var repository=mock(WritingEntryRepository.class);
        var entry=new WritingEntry(null,"되요");
        entry.addError(new WritingError(0,2,"되요","돼요","DOE_DWAE","정답은 돼요","돼요입니다","돼요로 써요","[\"되요\",\"돼요\"]"));
        when(repository.findAllByStudentIdOrderByCreatedAtDesc(studentId)).thenReturn(List.of(entry));
        var service=new WritingService(mock(StudentService.class),repository,mock(WritingErrorRepository.class),mock(SpellCheckService.class),new ObjectMapper(),mock(QuestionAttemptRepository.class));
        var error=service.list(studentId,"owner").get(0).errors().get(0);
        assertNull(error.correct()); assertNull(error.explanation());
        assertNull(error.hintLevel1()); assertNull(error.hintLevel2());
        assertTrue(error.choices().isEmpty());
        entry.getErrors().get(0).submit("돼요");
        assertEquals("돼요",service.list(studentId,"owner").get(0).errors().get(0).correct());
    }
}
