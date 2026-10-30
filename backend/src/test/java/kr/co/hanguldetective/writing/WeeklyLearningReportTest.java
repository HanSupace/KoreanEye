package kr.co.hanguldetective.writing;

import java.time.*;
import java.util.*;
import kr.co.hanguldetective.auth.*;
import kr.co.hanguldetective.learning.*;
import kr.co.hanguldetective.student.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.*;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;
import static org.junit.jupiter.api.Assertions.*;

@DataJpaTest(properties = {"spring.config.import=", "spring.jpa.hibernate.ddl-auto=create-drop", "spring.jpa.show-sql=false"})
class WeeklyLearningReportTest {
    @Autowired TestEntityManager em;
    @Autowired QuestionAttemptRepository attempts;
    @Autowired WritingEntryRepository writings;
    @Autowired WritingErrorRepository errors;
    @Autowired StudentProfileRepository profiles;
    @Autowired ParentAccountRepository accounts;
    WeeklyLearningReportService service;
    StudentProfile student;
    final LocalDate monday = LocalDate.of(2026, 10, 26);
    final Instant start = Instant.parse("2026-10-25T15:00:00Z");

    @BeforeEach void setup() {
        student = em.persist(new StudentProfile(em.persist(new ParentAccount("owner", "unused")), "탐정", 1, null));
        service = new WeeklyLearningReportService(new StudentService(profiles, accounts), attempts, writings, errors,
            Clock.fixed(Instant.parse("2026-10-30T03:00:00Z"), ZoneOffset.UTC));
    }
    LearningQuestion question() {
        return em.persist(new LearningQuestion(UUID.randomUUID().toString(), "SPACING", 1, "CHOICE", "같은 문장", "[]", "답", "설명"));
    }
    void submit(StudentProfile owner, LearningQuestion question, Instant time, boolean correct) {
        var attempt = new QuestionAttempt(owner, question, correct ? "답" : "오답", correct);
        ReflectionTestUtils.setField(attempt, "createdAt", time); em.persist(attempt);
    }
    WeeklyLearningReportService.Report report() { em.flush(); return service.get(student.getId(), "owner", monday); }

    @Test void fiveWrongAttemptsCountOneQuestion() {
        var q = question(); for (int i = 0; i < 5; i++) submit(student, q, start.plusSeconds(i), false);
        var r = report(); assertEquals(1, r.uniqueQuestions()); assertEquals(1, r.days().getFirst().questions());
        assertEquals(1, r.weaknesses().getFirst().count());
    }
    @Test void fourWrongThenCorrectCountOneAndDistinctIdsAreNotMergedByText() {
        var q = question(); for (int i = 0; i < 5; i++) submit(student, q, start.plusSeconds(i), i == 4);
        assertEquals(1, report().uniqueQuestions());
        submit(student, question(), start.plusSeconds(6), true); submit(student, question(), start.plusSeconds(7), false);
        assertEquals(3, report().uniqueQuestions());
    }
    @Test void comparisonUsesDistinctQuestionIdsFromTheImmediatelyPreviousWeek() {
        var repeatedLastWeek = question();
        submit(student, repeatedLastWeek, start.minusSeconds(7 * 86400), false);
        submit(student, repeatedLastWeek, start.minusSeconds(7 * 86400 + 60), true);
        submit(student, question(), start.minusSeconds(7 * 86400 + 120), false);

        var repeatedThisWeek = question();
        submit(student, repeatedThisWeek, start, false);
        submit(student, repeatedThisWeek, start.plusSeconds(60), true);
        submit(student, question(), start.plusSeconds(120), false);
        submit(student, question(), start.plusSeconds(180), true);

        var result = report();
        assertEquals(3, result.uniqueQuestions());
        assertEquals(2, result.previousWeekUniqueQuestions());
        assertTrue(result.previousWeekActivityAvailable());
    }
    @Test void successfulQueryWithNoPreviousAttemptsIsAnAvailableZero() {
        var result = report();
        assertEquals(0, result.previousWeekUniqueQuestions());
        assertTrue(result.previousWeekActivityAvailable());
    }
    @Test void learningAndQuestShareQuestionIdsAcrossDaysAndWeeks() {
        var q = question();
        submit(student, q, start, true); submit(student, q, start.plusSeconds(86400), false);
        submit(student, q, start.minusSeconds(1), false);
        var r = report(); assertEquals(1, r.uniqueQuestions()); assertEquals(2, r.learningDays());
        assertEquals(1, r.days().get(0).questions()); assertEquals(1, r.days().get(1).questions());
        assertEquals(1, service.get(student.getId(), "owner", monday.minusWeeks(1)).uniqueQuestions());
    }
    @Test void openingAndSkippingDoNotCreateSubmissionsOrChangeExistingSkipPolicy() {
        var q = question(); em.persist(new QuestionReviewItem(student, q, monday, 1));
        var r = report(); assertEquals(0, r.uniqueQuestions()); assertEquals(0, r.learningDays());
        assertEquals(7, r.days().size()); assertTrue(r.noRecordedActivity());
        assertEquals(0, attempts.count());
    }
    @Test void koreanWeekIncludesMondayMidnightAndSundayEndButNotNextMonday() {
        submit(student, question(), start.minusMillis(1), true);
        submit(student, question(), start, true);
        submit(student, question(), start.plusSeconds(7 * 86400).minusMillis(1), true);
        submit(student, question(), start.plusSeconds(7 * 86400), true);
        var r = report(); assertEquals(2, r.uniqueQuestions());
        assertEquals(1, r.days().get(0).questions()); assertEquals(1, r.days().get(6).questions());
    }
    @Test void ownershipAndFutureOrNonMondayRequestsAreRejected() {
        assertThrows(ResponseStatusException.class, () -> service.get(student.getId(), "other", monday));
        assertThrows(ResponseStatusException.class, () -> service.get(student.getId(), "owner", monday.plusWeeks(1)));
        assertThrows(ResponseStatusException.class, () -> service.get(student.getId(), "owner", monday.plusDays(1)));
    }
    @Test void recordsAreSeparatedByStudentAndAccountAndReadDoesNotWrite() {
        var sibling = em.persist(new StudentProfile(student.getParent(), "동생", 1, null));
        var other = em.persist(new StudentProfile(em.persist(new ParentAccount("other", "unused")), "다른 탐정", 1, null));
        submit(sibling, question(), start, true); submit(other, question(), start, true);
        assertEquals(0, report().uniqueQuestions()); assertEquals(2, attempts.count());
        assertEquals(0, writings.count()); assertEquals(0, errors.count());
    }
    @Test void writingActivityCountsDaysAndInvalidCorrectionsDoNotCreateWeaknesses() {
        var writing = new WritingEntry(student, "가치 놀았다.");
        ReflectionTestUtils.setField(writing, "createdAt", start.plusSeconds(86400));
        writing.addError(new WritingError(0, 2, "가치", "같이", "PRONUNCIATION_SPELLING", "설명", "힌트", "힌트", "[]"));
        var invalid = new WritingError(0, 2, "가치", "같이", "SPACING", "설명", "힌트", "힌트", "[]");
        ReflectionTestUtils.setField(invalid, "correct", "가치"); writing.addError(invalid); em.persist(writing);
        var r = report(); assertEquals(1, r.learningDays()); assertEquals(0, r.uniqueQuestions());
        assertEquals(1, r.weaknesses().size()); assertEquals("PRONUNCIATION_SPELLING", r.weaknesses().getFirst().category());
    }
    @Test void reviewLifetimeCountersNeverMasqueradeAsWeeklyCounts() {
        var writing = new WritingEntry(student, "가치");
        ReflectionTestUtils.setField(writing, "createdAt", start.minusSeconds(86400));
        for (int i = 0; i < 3; i++) {
            var clue = new WritingError(0, 2, "가치", "같이", "OTHER", "설명", "힌트", "힌트", "[]");
            writing.addError(clue); clue.submit("틀림"); clue.submit("같이");
        }
        em.persist(writing); var r = report();
        assertNull(r.reviewedClues()); assertNull(r.completedClues()); assertFalse(r.reviewActivityAvailable());
        assertEquals(0, r.learningDays()); assertTrue(r.weaknesses().isEmpty());
    }
    @Test void weekDefaultsUseSeoulAndHandleYearBoundary() {
        var atMonday = new WeeklyLearningReportService(new StudentService(profiles, accounts), attempts, writings, errors,
            Clock.fixed(Instant.parse("2026-12-27T15:00:00Z"), ZoneOffset.UTC));
        var r = atMonday.get(student.getId(), "owner", null);
        assertEquals(LocalDate.of(2026, 12, 28), r.weekStart()); assertEquals(LocalDate.of(2027, 1, 3), r.weekEnd());
    }
}
