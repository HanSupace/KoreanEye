package kr.co.hanguldetective.writing;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import kr.co.hanguldetective.learning.QuestionAttemptRepository;
import kr.co.hanguldetective.learning.WritingPracticeQuestionService;
import kr.co.hanguldetective.student.StudentProfile;
import kr.co.hanguldetective.student.StudentService;
import java.time.*;
import java.util.*;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class WritingService {
    private static final Logger log = LoggerFactory.getLogger(WritingService.class);
    private final StudentService students; private final WritingEntryRepository writings; private final WritingErrorRepository errors;
    private final SpellCheckService spellCheck; private final ObjectMapper mapper; private final QuestionAttemptRepository attempts;
    private final WritingPracticeQuestionService practiceQuestions;
    @Autowired
    public WritingService(StudentService students,WritingEntryRepository writings,WritingErrorRepository errors,SpellCheckService spellCheck,ObjectMapper mapper,QuestionAttemptRepository attempts,WritingPracticeQuestionService practiceQuestions){this.students=students;this.writings=writings;this.errors=errors;this.spellCheck=spellCheck;this.mapper=mapper;this.attempts=attempts;this.practiceQuestions=practiceQuestions;}
    public WritingService(StudentService students,WritingEntryRepository writings,WritingErrorRepository errors,SpellCheckService spellCheck,ObjectMapper mapper,QuestionAttemptRepository attempts){this(students,writings,errors,spellCheck,mapper,attempts,null);}
    @Transactional public WritingDto create(UUID studentId,String email,String text){
        if(text==null||text.isBlank())throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"한 문장만 적어도 좋아요.");
        if(text.length()>5000)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"글은 5,000자까지 쓸 수 있어요.");
        StudentProfile student=students.requireOwned(studentId,email);
        ProfanityFilter.validate(text);
        WritingEntry writing=new WritingEntry(student,text);
        SpellCheckService.AnalysisResult analysis=spellCheck.analyze(text);
        int acceptedCandidates=0;
        int droppedCandidates=0;
        Set<String> acceptedKeys=new HashSet<>();
        for(SpellCheckService.DetectedError e:analysis.errors().stream().filter(Objects::nonNull).sorted(Comparator.comparingInt(SpellCheckService.DetectedError::startIndex)).toList()){
            if(!WritingCandidateValidator.hasCorrection(e.original(),e.correct())){
                droppedCandidates++;
                log.info("Writing analysis candidate ignored: provider={}, reason=NO_CORRECTION, startIndex={}, endIndex={}",analysis.provider(),e.startIndex(),e.endIndex());
                continue;
            }
            if("PUNCTUATION".equals(e.category())){
                droppedCandidates++;
                log.info("Writing analysis candidate ignored: provider={}, reason=PUNCTUATION, startIndex={}, endIndex={}",analysis.provider(),e.startIndex(),e.endIndex());
                continue;
            }
            int startIndex=e.startIndex();
            int endIndex=e.endIndex();
            if(startIndex<0||endIndex>text.length()||startIndex>=endIndex||!text.substring(startIndex,endIndex).equals(e.original())){
                int correctedStart=findUniqueOccurrence(text,e.original());
                if(correctedStart>=0){
                    startIndex=correctedStart;
                    endIndex=correctedStart+e.original().length();
                    log.info("Writing analysis candidate range corrected: provider={}, category={}, startIndex={}, endIndex={}",analysis.provider(),e.category(),startIndex,endIndex);
                }
            }
            if(startIndex<0||endIndex>text.length()||startIndex>=endIndex){
                droppedCandidates++;
                log.warn("Writing analysis candidate dropped: provider={}, reason=INVALID_RANGE, category={}, startIndex={}, endIndex={}, sourceLength={}",analysis.provider(),e.category(),e.startIndex(),e.endIndex(),text.length());
                continue;
            }
            if(!text.substring(startIndex,endIndex).equals(e.original())){
                droppedCandidates++;
                log.warn("Writing analysis candidate dropped: provider={}, reason=SOURCE_MISMATCH, category={}, startIndex={}, endIndex={}, sourceLength={}, candidateLength={}",analysis.provider(),e.category(),e.startIndex(),e.endIndex(),text.length(),e.original().length());
                continue;
            }
            if(e.correct().isBlank()){
                droppedCandidates++;
                log.warn("Writing analysis candidate dropped: provider={}, reason=EMPTY_CORRECTION, category={}, startIndex={}, endIndex={}",analysis.provider(),e.category(),e.startIndex(),e.endIndex());
                continue;
            }
            String category=WritingCandidateValidator.spacingOnly(e.original(),e.correct())?"SPACING":e.category();
            if("SPACING".equals(category)&&!WritingCandidateValidator.spacingOnly(e.original(),e.correct())){
                droppedCandidates++;
                continue;
            }
            if(!acceptedKeys.add(startIndex+":"+endIndex+":"+e.correct())){droppedCandidates++;continue;}
            try{
                writing.addError(new WritingError(startIndex,endIndex,e.original(),e.correct(),category,e.explanation(),e.hintLevel1(),e.hintLevel2(),mapper.writeValueAsString(e.choices())));
                acceptedCandidates++;
            }catch(Exception ex){
                droppedCandidates++;
                log.warn("Writing analysis candidate dropped: provider={}, reason=PERSISTENCE_ERROR, category={}, exceptionType={}",analysis.provider(),e.category(),ex.getClass().getSimpleName());
            }
        }
        log.info("Writing analysis completed: provider={}, candidates={}, accepted={}, dropped={}",analysis.provider(),analysis.errors().size(),acceptedCandidates,droppedCandidates);
        WritingEntry saved=writings.save(writing);
        if(practiceQuestions!=null)practiceQuestions.generateFor(saved);
        return toDto(saved,analysis.provider());
    }
    private int findUniqueOccurrence(String text,String original){
        if(original==null||original.isBlank())return -1;
        int index=text.indexOf(original);
        return index>=0&&text.indexOf(original,index+1)<0?index:-1;
    }
    @Transactional public WritingDto get(UUID writingId,String email){WritingEntry w=writings.findById(writingId).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND));owned(w,email);if(practiceQuestions!=null)practiceQuestions.generateFor(w);return toDto(w,"stored");}
    @Transactional public List<WritingDto> list(UUID studentId,String email){students.requireOwned(studentId,email);List<WritingEntry> entries=writings.findAllByStudentIdOrderByCreatedAtDesc(studentId);if(practiceQuestions!=null)entries.forEach(practiceQuestions::generateFor);return entries.stream().map(w->toDto(w,"stored")).toList();}
    @Transactional public AttemptResult attempt(UUID errorId,String email,String answer){WritingError e=errors.findById(errorId).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND));owned(e.getWriting(),email);boolean correct=e.submit(answer);return new AttemptResult(correct,correct?"잘 고쳤어요! 직접 단서를 찾았네요.":"거의 맞았어요. 힌트를 보고 다시 해봐요.",e.getAttemptCount(),correct?e.getCorrect():null);}
    @Transactional public HintResult hint(UUID errorId,String email){WritingError e=errors.findById(errorId).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND));owned(e.getWriting(),email);int level=e.nextHint();String hint=switch(level){case 1->e.getHintLevel1();case 2->e.getHintLevel2();default->"보기: "+String.join(" · ",choices(e));};return new HintResult(level,hint);}
    @Transactional(readOnly=true) public List<WeaknessDto> weaknesses(UUID studentId,String email){students.requireOwned(studentId,email);List<WritingError> list=errors.findAllByWritingStudentId(studentId);Map<String,List<WritingError>> by=list.stream().collect(Collectors.groupingBy(WritingError::getCategory));List<WeaknessDto> result=new ArrayList<>();for(var entry:by.entrySet()){long solved=entry.getValue().stream().filter(WritingError::isSolved).count();int total=entry.getValue().size();int score=Math.min(100,(int)((total-solved)*12+entry.getValue().stream().mapToInt(WritingError::getHintLevelUsed).sum()*2));result.add(new WeaknessDto(entry.getKey(),total,Math.round(solved*100.0/Math.max(1,total)),score));}return result.stream().sorted(Comparator.comparingInt(WeaknessDto::weaknessScore).reversed()).toList();}
    @Transactional(readOnly=true) public WeeklyDto weekly(UUID studentId,String email){
        students.requireOwned(studentId,email);Instant since=LocalDate.now(ZoneId.of("Asia/Seoul")).minusDays(6).atStartOfDay(ZoneId.of("Asia/Seoul")).toInstant();List<WritingEntry> ws=writings.findAllByStudentIdAndCreatedAtAfter(studentId,since);List<WritingError> es=errors.findAllByWritingStudentIdAndCreatedAtAfter(studentId,since);
        long days=ws.stream().map(w->w.getCreatedAt().atZone(ZoneId.of("Asia/Seoul")).toLocalDate()).distinct().count();List<WritingError> spacingErrors=es.stream().filter(e->e.getCategory().equals("SPACING")).toList();List<WritingError> spellingErrors=es.stream().filter(e->!e.getCategory().equals("SPACING")).toList();
        List<WeaknessDto> weak=weaknesses(studentId,email);Map<String,List<WritingError>> repeated=es.stream().collect(Collectors.groupingBy(WritingError::getOriginal));List<RepeatedDto> repeat=repeated.entrySet().stream().filter(e->e.getValue().size()>1).map(e->new RepeatedDto(e.getKey(),e.getValue().get(0).getCorrect(),e.getValue().size())).sorted(Comparator.comparingInt(RepeatedDto::count).reversed()).limit(5).toList();
        String summary=weak.isEmpty()?"이번 주도 꾸준히 한글 탐정 활동을 이어가고 있어요. 글을 쓰면 아이에게 맞는 단서를 찾아볼게요.":"이번 주에는 "+categoryName(weak.get(0).category())+" 단서를 자주 만났어요. 직접 다시 쓰며 연습하고 있고, 다음 문제에도 이 유형을 조금 더 반영할게요.";
        int spacingAccuracy=categoryAccuracy(spacingErrors),spellingAccuracy=categoryAccuracy(spellingErrors);return new WeeklyDto((int)days,ws.size(),spellingAccuracy,spacingAccuracy,weak,repeat,summary);
    }
    private void owned(WritingEntry w,String username){if(!w.getStudent().getParent().getUsername().equals(username))throw new ResponseStatusException(HttpStatus.NOT_FOUND);}
    @Transactional public void completeReview(UUID errorId,String username){
        WritingError error=errors.findById(errorId).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND));
        owned(error.getWriting(),username);
        error.completeReview();
    }
    private List<String> choices(WritingError e){try{return mapper.readValue(e.getChoicesJson(),new TypeReference<>(){});}catch(Exception ignored){return List.of();}}
    private WritingDto toDto(WritingEntry w,String provider){return new WritingDto(w.getId(),w.getText(),w.getCreatedAt(),provider,w.getErrors().stream().map(e->new ErrorDto(e.getId(),e.getOriginal(),e.getCorrect(),e.getStartIndex(),e.getEndIndex(),e.getCategory(),e.getExplanation(),e.getHintLevel1(),e.getHintLevel2(),choices(e),e.getAttemptCount(),e.getHintLevelUsed(),e.isSolved())).toList());}
    private String categoryName(String c){return switch(c){case "SPACING"->"띄어쓰기";case "PRONUNCIATION_SPELLING"->"발음과 표기";case "FINAL_CONSONANT"->"받침";case "DOE_DWAE"->"돼/되";default->c;};}
    private int categoryAccuracy(List<WritingError> items){return items.isEmpty()?100:(int)Math.round(items.stream().filter(WritingError::isSolved).count()*100.0/items.size());}
    public record WritingDto(UUID id,String text,Instant createdAt,String analysisProvider,List<ErrorDto> errors){}
    public record ErrorDto(UUID id,String original,String correct,int startIndex,int endIndex,String category,String explanation,String hintLevel1,String hintLevel2,List<String> choices,int attemptCount,int hintLevelUsed,boolean solved){}
    public record AttemptResult(boolean correct,String message,int attemptCount,String correctExpression){}
    public record HintResult(int level,String hint){}
    public record WeaknessDto(String category,int errorCount,long accuracyRate,int weaknessScore){}
    public record RepeatedDto(String original,String correct,int count){}
    public record WeeklyDto(int learningDays,int writingCount,int spellingAccuracy,int spacingAccuracy,List<WeaknessDto> weaknesses,List<RepeatedDto> repeatedErrors,String summary){}
}
