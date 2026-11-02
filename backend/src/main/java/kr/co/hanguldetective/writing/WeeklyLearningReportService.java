package kr.co.hanguldetective.writing;

import java.time.*;
import java.time.temporal.TemporalAdjusters;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import kr.co.hanguldetective.learning.QuestionAttemptRepository;
import kr.co.hanguldetective.student.StudentService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class WeeklyLearningReportService {
    private static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");
    private final StudentService students;
    private final QuestionAttemptRepository attempts;
    private final WritingEntryRepository writings;
    private final WritingErrorRepository errors;
    private final Clock clock;
    private final AdaptiveSpellCheckService ai;
    private final Map<String,WeeklyReportAiInsight> insightCache=new ConcurrentHashMap<>();

    @Autowired
    public WeeklyLearningReportService(StudentService students, QuestionAttemptRepository attempts,
            WritingEntryRepository writings, WritingErrorRepository errors, AdaptiveSpellCheckService ai) {
        this(students, attempts, writings, errors, Clock.systemUTC(), ai);
    }

    WeeklyLearningReportService(StudentService students, QuestionAttemptRepository attempts,
            WritingEntryRepository writings, WritingErrorRepository errors, Clock clock) {
        this(students,attempts,writings,errors,clock,null);
    }

    WeeklyLearningReportService(StudentService students, QuestionAttemptRepository attempts,
            WritingEntryRepository writings, WritingErrorRepository errors, Clock clock, AdaptiveSpellCheckService ai) {
        this.students = students; this.attempts = attempts; this.writings = writings;
        this.errors = errors; this.clock = clock; this.ai=ai;
    }

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
        boolean noRecordedActivity=activeDates.isEmpty();
        int learningDays=activeDates.size();
        int uniqueQuestions=questionIds.size();
        WeeklyReportAiInsight insight=aiInsight(studentId,start,learningDays,uniqueQuestions,previousQuestionIds.size(),true,days,weaknesses,noRecordedActivity);
        return new Report(start, start.plusDays(6), currentWeek, learningDays, uniqueQuestions,
            null, null, false, previousQuestionIds.size(), true, days, weaknesses, noRecordedActivity,
            insight == null ? null : insight.praise(), insight == null ? null : insight.nextGoal(),
            insight == null ? null : insight.weaknessSummary(), insight == null ? null : insight.parentAdvice());
    }

    private WeeklyReportAiInsight aiInsight(UUID studentId,LocalDate weekStart,int learningDays,int uniqueQuestions,
            int previousWeekQuestions,boolean previousWeekAvailable,List<Day> days,List<CategoryCount> weaknesses,boolean noActivity){
        if(ai==null||noActivity)return null;
        String key=studentId+"|"+weekStart+"|"+learningDays+"|"+uniqueQuestions+"|"+previousWeekQuestions+"|"+previousWeekAvailable+"|"+days+"|"+weaknesses;
        WeeklyReportAiInsight cached=insightCache.get(key);
        if(cached!=null)return cached;
        Map<String,Object> metrics=new LinkedHashMap<>();
        metrics.put("learningDays",learningDays);
        metrics.put("uniqueQuestions",uniqueQuestions);
        metrics.put("previousWeekUniqueQuestions",previousWeekAvailable?previousWeekQuestions:null);
        metrics.put("dailyQuestionCounts",days.stream().map(day->Map.of("date",day.date().toString(),"questions",day.questions())).toList());
        metrics.put("weaknessCategories",weaknesses.stream().limit(3).map(item->Map.of("category",item.category(),"count",item.count())).toList());
        metrics.put("evidenceScope","이번 주 학습 문제의 오답 유형과 글쓰기에서 저장된 교정 유형의 집계. 전체 학업 능력을 나타내지 않음.");
        Optional<WeeklyReportAiInsight> generated=ai.generateWeeklyReportInsight(metrics);
        if(generated.isEmpty())return null;
        if(insightCache.size()>=256)insightCache.clear();
        insightCache.putIfAbsent(key,generated.get());
        return insightCache.get(key);
    }

    static LocalDate monday(LocalDate date) { return date.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)); }
    public record Day(LocalDate date, int questions) {}
    public record CategoryCount(String category, int count) {}
    public record Report(LocalDate weekStart, LocalDate weekEnd, LocalDate currentWeekStart,
            int learningDays, int uniqueQuestions, Integer reviewedClues, Integer completedClues,
            boolean reviewActivityAvailable, int previousWeekUniqueQuestions, boolean previousWeekActivityAvailable,
            List<Day> days, List<CategoryCount> weaknesses,
            boolean noRecordedActivity, String aiPraise, String aiNextGoal,
            String aiWeaknessSummary, String aiParentAdvice) {
        public Report(LocalDate weekStart,LocalDate weekEnd,LocalDate currentWeekStart,int learningDays,int uniqueQuestions,
                Integer reviewedClues,Integer completedClues,boolean reviewActivityAvailable,int previousWeekUniqueQuestions,
                boolean previousWeekActivityAvailable,List<Day> days,List<CategoryCount> weaknesses,boolean noRecordedActivity){
            this(weekStart,weekEnd,currentWeekStart,learningDays,uniqueQuestions,reviewedClues,completedClues,
                reviewActivityAvailable,previousWeekUniqueQuestions,previousWeekActivityAvailable,days,weaknesses,noRecordedActivity,null,null,null,null);
        }
    }
}
