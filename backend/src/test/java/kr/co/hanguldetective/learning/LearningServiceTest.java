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
    @Test void startingNewChapterPreservesLegacyCompletedHistory(){
        var yesterday=LocalDate.now(ZoneId.of("Asia/Seoul")).minusDays(1);
        var time=yesterday.atTime(12,0).atZone(ZoneId.of("Asia/Seoul")).toInstant();
        var records=java.util.stream.IntStream.range(0,10)
            .mapToObj(i->attempt(UUID.randomUUID(),true,time)).toList();
        when(attempts.findAllByStudentId(student)).thenReturn(records);
        var chapter=new LearningChapter(null,LocalDate.now(ZoneId.of("Asia/Seoul")),2);
        var question=mock(LearningQuestion.class);
        chapter.addQuestion(question);
        when(chapters.findHistoryByStudentIdOrderByChapterNumberDescCreatedAtDesc(student)).thenReturn(List.of(chapter));
        var history=service.history(student,"owner");
        assertEquals(1,history.stream().filter(day->day.date().equals(yesterday)).findFirst().orElseThrow().chaptersCompleted());
        assertEquals(0,history.stream().filter(day->day.date().equals(chapter.getChapterDate())).findFirst().orElseThrow().chaptersCompleted());
    }
    final QuestionAttemptRepository attempts=mock(QuestionAttemptRepository.class);
    final WritingEntryRepository writings=mock(WritingEntryRepository.class);
    final LearningChapterRepository chapters=mock(LearningChapterRepository.class);
    final LearningService service=new LearningService(mock(LearningQuestionRepository.class),attempts,mock(QuestionReviewRepository.class),chapters,mock(StudentService.class),writings,mock(WritingErrorRepository.class),new ObjectMapper());
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
        when(writings.findHistoryByStudentIdOrderByCreatedAtDesc(student)).thenReturn(List.of(writing));
        var day=service.history(student,"owner").stream().filter(d->d.date().equals(LocalDate.of(2026,1,1))).findFirst().orElseThrow();
        assertEquals(1,day.questionsSolved()); assertEquals(1,day.remaining());
        assertEquals(1,day.completedCount()); assertEquals(writing.getId(),day.notes().get(0).id());
    }

    @Test void emptyHistoryStillHasTodaysNotebook(){
        var history=service.history(student,"owner");
        assertEquals(1,history.size()); assertEquals(0,history.get(0).completedCount());
        assertEquals(LocalDate.now(ZoneId.of("Asia/Seoul")),history.get(0).date());
    }

    @Test void fiveCorrectAnswersDoNotCompleteTenQuestionMission(){
        var records=java.util.stream.IntStream.range(0,5)
            .mapToObj(i->attempt(UUID.randomUUID(),true,Instant.now())).toList();
        when(attempts.findAllByStudentIdAndCreatedAtAfter(eq(student),any())).thenReturn(records);
        assertFalse(service.daily(student,"owner").questionsDone());
    }

    @Test void tenDistinctCorrectAnswersCompleteMission(){
        var records=java.util.stream.IntStream.range(0,10)
            .mapToObj(i->attempt(UUID.randomUUID(),true,Instant.now())).toList();
        when(attempts.findAllByStudentIdAndCreatedAtAfter(eq(student),any())).thenReturn(records);
        assertTrue(service.daily(student,"owner").questionsDone());
    }

    @Test void chapterStartedYesterdayCountsOnCompletionDay(){
        var today=LocalDate.now(ZoneId.of("Asia/Seoul"));
        var chapter=new LearningChapter(null,today.minusDays(1),1);
        var question=mock(LearningQuestion.class);
        var questionId=UUID.randomUUID();
        when(question.getId()).thenReturn(questionId);
        chapter.addQuestion(question);
        assertNull(chapter.getCompletionDate());
        chapter.getQuestions().get(0).complete(questionId);
        var completedAt=chapter.getQuestions().get(0).getCompletedAt();
        chapter.getQuestions().get(0).complete(questionId);
        assertEquals(completedAt,chapter.getQuestions().get(0).getCompletedAt());
        when(chapters.findAllByStudentIdOrderByChapterNumberDescCreatedAtDesc(student)).thenReturn(List.of(chapter));
        assertEquals(today,chapter.getCompletionDate());
        assertTrue(service.daily(student,"owner").questionsDone());
        when(chapters.findHistoryByStudentIdOrderByChapterNumberDescCreatedAtDesc(student)).thenReturn(List.of(chapter));
        var history=service.history(student,"owner");
        assertEquals(1,history.stream().filter(day->day.date().equals(today)).findFirst().orElseThrow().chaptersCompleted());
        assertEquals(1,history.stream().mapToInt(LearningService.DayRecord::chaptersCompleted).sum());
    }
}
