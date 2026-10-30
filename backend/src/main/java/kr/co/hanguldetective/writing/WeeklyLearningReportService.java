package kr.co.hanguldetective.writing;

import java.time.*;
import java.time.temporal.TemporalAdjusters;
import java.util.*;
import kr.co.hanguldetective.learning.QuestionAttemptRepository;
import kr.co.hanguldetective.student.StudentService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class WeeklyLearningReportService {
    private static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");
    private final StudentService students;
    private final QuestionAttemptRepository attempts;
    private final WritingEntryRepository writings;
    private final WritingErrorRepository errors;
    private final Clock clock;

    @Autowired
    public WeeklyLearningReportService(StudentService students, QuestionAttemptRepository attempts,
            WritingEntryRepository writings, WritingErrorRepository errors) {
        this(students, attempts, writings, errors, Clock.systemUTC());
    }

    WeeklyLearningReportService(StudentService students, QuestionAttemptRepository attempts,
            WritingEntryRepository writings, WritingErrorRepository errors, Clock clock) {
        this.students = students; this.attempts = attempts; this.writings = writings;
        this.errors = errors; this.clock = clock;
    }

    @Transactional(readOnly = true)
    public Report get(UUID studentId, String username, LocalDate requestedStart) {
        students.requireOwned(studentId, username);
        LocalDate currentWeek = monday(LocalDate.now(clock.withZone(SEOUL)));
        LocalDate start = requestedStart == null ? currentWeek : requestedStart;
        if (start.getDayOfWeek() != DayOfWeek.MONDAY || start.isAfter(currentWeek)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "이번 주 또는 지난주의 월요일을 선택해 주세요.");
        }
        Instant from = start.atStartOfDay(SEOUL).toInstant();
        Instant until = start.plusWeeks(1).atStartOfDay(SEOUL).toInstant();
        var submissions = attempts.findWeeklyActivity(studentId, from, until);
        LocalDate previousStart = start.minusWeeks(1);
        Instant previousFrom = previousStart.atStartOfDay(SEOUL).toInstant();
        Instant previousUntil = start.atStartOfDay(SEOUL).toInstant();
        var previousSubmissions = attempts.findWeeklyActivity(studentId, previousFrom, previousUntil);
        var writingDates = writings.findWeeklyActivity(studentId, from, until);
        var clues = errors.findWeeklyClues(studentId, from, until);
        Set<UUID> questionIds = new HashSet<>();
        Set<UUID> previousQuestionIds = new HashSet<>();
        previousSubmissions.forEach(attempt -> previousQuestionIds.add(attempt.getQuestionId()));
        Set<LocalDate> activeDates = new HashSet<>();
        Map<LocalDate, Set<UUID>> dailyIds = new HashMap<>();
        Map<String, Set<UUID>> wrongQuestions = new HashMap<>();
        for (var attempt : submissions) {
            LocalDate date = attempt.getCreatedAt().atZone(SEOUL).toLocalDate();
            questionIds.add(attempt.getQuestionId()); activeDates.add(date);
            dailyIds.computeIfAbsent(date, ignored -> new HashSet<>()).add(attempt.getQuestionId());
            if (!attempt.getCorrect()) wrongQuestions.computeIfAbsent(attempt.getCategory(), ignored -> new HashSet<>()).add(attempt.getQuestionId());
        }
        writingDates.forEach(time -> activeDates.add(time.atZone(SEOUL).toLocalDate()));
        Map<String, Integer> categories = new HashMap<>();
        wrongQuestions.forEach((category, ids) -> categories.put(category, ids.size()));
        for (var clue : clues) {
            if (WritingCandidateValidator.hasCorrection(clue.getOriginal(), clue.getCorrection())) {
                categories.merge(clue.getCategory(), 1, Integer::sum);
            }
        }
        List<CategoryCount> weaknesses = categories.entrySet().stream()
            .map(entry -> new CategoryCount(entry.getKey(), entry.getValue()))
            .sorted(Comparator.comparingInt(CategoryCount::count).reversed().thenComparing(CategoryCount::category)).toList();
        List<Day> days = new ArrayList<>();
        for (int i = 0; i < 7; i++) {
            LocalDate date = start.plusDays(i);
            days.add(new Day(date, dailyIds.getOrDefault(date, Set.of()).size()));
        }
        // Review entities only retain lifetime counters/current state, not event times.
        // Null is intentional: zero would incorrectly claim no reviews occurred.
        return new Report(start, start.plusDays(6), currentWeek, activeDates.size(), questionIds.size(),
            null, null, false, previousQuestionIds.size(), true, days, weaknesses, activeDates.isEmpty());
    }

    static LocalDate monday(LocalDate date) { return date.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)); }
    public record Day(LocalDate date, int questions) {}
    public record CategoryCount(String category, int count) {}
    public record Report(LocalDate weekStart, LocalDate weekEnd, LocalDate currentWeekStart,
            int learningDays, int uniqueQuestions, Integer reviewedClues, Integer completedClues,
            boolean reviewActivityAvailable, int previousWeekUniqueQuestions, boolean previousWeekActivityAvailable,
            List<Day> days, List<CategoryCount> weaknesses,
            boolean noRecordedActivity) {}
}
