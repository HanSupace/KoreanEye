package kr.co.hanguldetective.learning;

import com.fasterxml.jackson.databind.ObjectMapper;
import kr.co.hanguldetective.student.StudentService;
import kr.co.hanguldetective.writing.*;
import org.junit.jupiter.api.Test;
import java.time.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class LearningServiceTest {
    final QuestionAttemptRepository attempts=mock(QuestionAttemptRepository.class);
    final WritingEntryRepository writings=mock(WritingEntryRepository.class);
    final LearningService service = new LearningService(mock(LearningQuestionRepository.class),attempts,    mock(QuestionReviewRepository.class),    mock(LearningChapterRepository.class),    mock(StudentService.class),   writings,    mock(WritingErrorRepository.class), new ObjectMapper());
    final UUID student=UUID.randomUUID();

    QuestionAttempt attempt(UUID question,boolean correct,Instant time){
        var attempt=mock(QuestionAttempt.class);
        when(attempt.getQuestionId()).thenReturn(question);
        when(attempt.isCorrect()).thenReturn(correct);
        when(attempt.getCreatedAt()).thenReturn(time);
        return attempt;
    }

    @Test void repeatedCorrectAnswersAndWrongAnswersDoNotCompleteFiveQuestions(){
        var one=UUID.randomUUID();
        var records=List.of(
            attempt(one,true,Instant.now()),attempt(one,true,Instant.now()),attempt(one,true,Instant.now()),
            attempt(UUID.randomUUID(),false,Instant.now()),attempt(UUID.randomUUID(),false,Instant.now()));
        when(attempts.findAllByStudentIdAndCreatedAtAfter(eq(student),any())).thenReturn(records);
        assertFalse(service.daily(student,"owner").questionsDone());
    }

    @Test void historyUsesKoreanDatesAndIncludesAllUnfinishedWritings(){
        var time=Instant.parse("2025-12-31T15:30:00Z");
        var record=attempt(UUID.randomUUID(),true,time);
        when(attempts.findAllByStudentId(student)).thenReturn(List.of(record));
        var writing=mock(WritingEntry.class); var error=mock(WritingError.class);
        when(writing.getId()).thenReturn(UUID.randomUUID()); when(writing.getText()).thenReturn("나의 글");
        when(writing.getCreatedAt()).thenReturn(time); when(writing.getErrors()).thenReturn(List.of(error));
        when(writings.findAllByStudentIdOrderByCreatedAtDesc(student)).thenReturn(List.of(writing));
        var day=service.history(student,"owner").stream().filter(d->d.date().equals(LocalDate.of(2026,1,1))).findFirst().orElseThrow();
        assertEquals(1,day.questionsSolved()); assertEquals(1,day.remaining());
        assertEquals(1,day.completedCount()); assertEquals(writing.getId(),day.notes().get(0).id());
    }

    @Test void emptyHistoryStillHasTodaysNotebook(){
        var history=service.history(student,"owner");
        assertEquals(1,history.size()); assertEquals(0,history.get(0).completedCount());
        assertEquals(LocalDate.now(ZoneId.of("Asia/Seoul")),history.get(0).date());
    }
}
