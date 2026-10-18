package kr.co.hanguldetective.learning;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import kr.co.hanguldetective.student.StudentProfile;
import kr.co.hanguldetective.student.StudentService;
import kr.co.hanguldetective.writing.WritingEntryRepository;
import kr.co.hanguldetective.writing.WritingError;
import kr.co.hanguldetective.writing.WritingErrorRepository;
import java.time.*;
import java.util.*;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class LearningService implements ApplicationRunner {
    private final LearningQuestionRepository questions; private final QuestionAttemptRepository attempts; private final StudentService students;
    private final WritingEntryRepository writings; private final WritingErrorRepository errors; private final ObjectMapper mapper;
    public LearningService(LearningQuestionRepository questions,QuestionAttemptRepository attempts,StudentService students,WritingEntryRepository writings,WritingErrorRepository errors,ObjectMapper mapper){this.questions=questions;this.attempts=attempts;this.students=students;this.writings=writings;this.errors=errors;this.mapper=mapper;}
    @Override @Transactional public void run(ApplicationArguments args) throws Exception {
        seed("spacing-school","SPACING", "나는 학교에 ___ 친구를 만났어요.", List.of("가서","가 서"),"가서","‘학교에’와 ‘가서’는 자연스럽게 이어 써요.");
        seed("pronunciation-together","PRONUNCIATION_SPELLING", "친구와 ___ 놀았어요.", List.of("가치","같이"),"같이","‘함께’라는 뜻으로 쓸 때는 ‘같이’예요.");
        seed("final-consonant","FINAL_CONSONANT", "비가 오니까 우산을 ___ 가요.", List.of("갖고","갇고"),"갖고","‘가지고’라는 뜻의 ‘갖고’에는 ㅈ 받침이 들어가요.");
        seed("doe-dwae","DOE_DWAE", "오늘은 숙제를 다 해도 ___.", List.of("되요","돼요"),"돼요","‘되어요’로 바꿔 말할 수 있으니 ‘돼요’가 맞아요.");
        seed("spacing-home","SPACING", "집에 ___ 손을 씻었어요.", List.of("와서","와 서"),"와서","‘와서’는 ‘오다’에 ‘-아서’가 붙은 말이라 이어 써요.");
    }
    private void seed(String key,String category,String prompt,List<String> choices,String answer,String explanation)throws Exception{
        String choicesJson=mapper.writeValueAsString(choices);
        Optional<LearningQuestion> existing=questions.findBySeedKey(key);
        if(existing.isPresent()) existing.get().updateSeedContent(category,2,"MULTIPLE_CHOICE",prompt,choicesJson,answer,explanation);
        else questions.save(new LearningQuestion(key,category,2,"MULTIPLE_CHOICE",prompt,choicesJson,answer,explanation));
    }
    @Transactional(readOnly=true) public List<QuestionDto> today(UUID studentId,String email)throws Exception{
        StudentProfile student=students.requireOwned(studentId,email); List<LearningQuestion> all=new ArrayList<>(questions.findAllByGradeInOrderByCategoryAsc(List.of(1,2,3)).stream()
            .filter(q -> "MULTIPLE_CHOICE".equals(q.getQuestionType()) && q.getPrompt().contains("___"))
            .filter(q -> { try { return mapper.readValue(q.getChoicesJson(), new TypeReference<List<String>>(){}).size() >= 2; } catch (Exception ignored) { return false; } })
            .toList());
        if(all.isEmpty()) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"오늘의 빈칸 단어 문제를 준비하고 있어요.");
        Map<String,Long> weak=new HashMap<>(); for(WritingError e:errors.findAllByWritingStudentId(studentId)) if(!e.isSolved()) weak.merge(e.getCategory(),1L,Long::sum);
        all.sort(Comparator.<LearningQuestion>comparingLong(q->-weak.getOrDefault(q.getCategory(),0L)).thenComparing(LearningQuestion::getCategory));
        List<LearningQuestion> picked=new ArrayList<>(); for(int i=0;i<5;i++) picked.add(all.get(i%all.size()));
        List<QuestionAttempt> todays=attempts.findAllByStudentIdAndCreatedAtAfter(studentId,LocalDate.now(ZoneId.of("Asia/Seoul")).atStartOfDay(ZoneId.of("Asia/Seoul")).toInstant());
        Set<UUID> solved=new HashSet<>(); todays.stream().filter(QuestionAttempt::isCorrect).forEach(a->solved.add(a.getQuestionId()));
        return picked.stream().map(q->toDto(q,solved.contains(q.getId()))).toList();
    }
    @Transactional public AttemptResult attempt(UUID questionId,UUID studentId,String email,String answer){
        StudentProfile student=students.requireOwned(studentId,email); LearningQuestion q=questions.findById(questionId).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"문제를 찾을 수 없어요."));
        boolean correct=q.getAnswer().equals(answer.trim()); attempts.save(new QuestionAttempt(student,q,answer.trim(),correct)); return new AttemptResult(correct,correct?"정답이에요! "+q.getExplanation():"거의 맞았어요. 다시 생각해 볼까요?",correct?q.getAnswer():null);
    }
    @Transactional(readOnly=true) public DailyDto daily(UUID studentId,String email){
        students.requireOwned(studentId,email); Instant today=LocalDate.now(ZoneId.of("Asia/Seoul")).atStartOfDay(ZoneId.of("Asia/Seoul")).toInstant();
        List<QuestionAttempt> a=attempts.findAllByStudentIdAndCreatedAtAfter(studentId,today); List<kr.co.hanguldetective.writing.WritingEntry> w=writings.findAllByStudentIdAndCreatedAtAfter(studentId,today);
        boolean questionDone=a.stream().filter(QuestionAttempt::isCorrect).map(QuestionAttempt::getQuestionId).distinct().count()>=5; boolean writeDone=!w.isEmpty(); boolean reviewDone=writeDone&&w.stream().allMatch(entry->entry.getErrors().stream().allMatch(WritingError::isSolved));
        return new DailyDto(questionDone,writeDone,reviewDone,(questionDone?1:0)+(writeDone?1:0)+(reviewDone?1:0));
    }
    private QuestionDto toDto(LearningQuestion q,boolean correct){try{return new QuestionDto(q.getId(),q.getCategory(),q.getPrompt(),mapper.readValue(q.getChoicesJson(),new TypeReference<List<String>>(){}),null,null,correct);}catch(Exception e){return new QuestionDto(q.getId(),q.getCategory(),q.getPrompt(),List.of(),null,null,correct);}}
    public record QuestionDto(UUID id,String category,String prompt,List<String> choices,String answer,String explanation,boolean correct){}
    public record AttemptResult(boolean correct,String message,String answer){}
    public record DailyDto(boolean questionsDone,boolean writingDone,boolean reviewDone,int completedCount){}
    @Transactional(readOnly=true) public List<DayRecord> history(UUID studentId,String email){
        students.requireOwned(studentId,email);
        ZoneId zone=ZoneId.of("Asia/Seoul");
        var allAttempts=attempts.findAllByStudentId(studentId);
        var allWritings=writings.findAllByStudentIdOrderByCreatedAtDesc(studentId);
        Set<LocalDate> dates=new TreeSet<>(Comparator.reverseOrder());
        dates.add(LocalDate.now(zone));
        allAttempts.forEach(a->dates.add(a.getCreatedAt().atZone(zone).toLocalDate()));
        allWritings.forEach(w->dates.add(w.getCreatedAt().atZone(zone).toLocalDate()));
        return dates.stream().map(date->{
            var dayAttempts=allAttempts.stream().filter(a->a.getCreatedAt().atZone(zone).toLocalDate().equals(date)).toList();
            var dayWritings=allWritings.stream().filter(w->w.getCreatedAt().atZone(zone).toLocalDate().equals(date)).toList();
            int solved=(int)dayAttempts.stream().filter(QuestionAttempt::isCorrect).map(QuestionAttempt::getQuestionId).distinct().count();
            int remaining=(int)dayWritings.stream().flatMap(w->w.getErrors().stream()).filter(e->!e.isSolved()).count();
            int completed=(solved>=5?1:0)+(dayWritings.isEmpty()?0:1)+(dayWritings.isEmpty()||remaining>0?0:1);
            return new DayRecord(date,solved,dayAttempts.size(),dayWritings.size(),remaining,completed,dayWritings.stream().map(w->new Note(w.getId(),w.getText(),(int)w.getErrors().stream().filter(e->!e.isSolved()).count())).toList());
        }).toList();
    }
    public record Note(UUID id,String text,int remaining){}
    public record DayRecord(LocalDate date,int questionsSolved,int attempts,int writingCount,int remaining,int completedCount,List<Note> notes){}
}
