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
    private final LearningQuestionRepository questions; private final QuestionAttemptRepository attempts; private final QuestionReviewRepository questionReviews; private final LearningChapterRepository chapters; private final StudentService students;
    private final WritingEntryRepository writings; private final WritingErrorRepository errors; private final ObjectMapper mapper;
    public LearningService(LearningQuestionRepository questions,QuestionAttemptRepository attempts,QuestionReviewRepository questionReviews,LearningChapterRepository chapters,StudentService students,WritingEntryRepository writings,WritingErrorRepository errors,ObjectMapper mapper){this.questions=questions;this.attempts=attempts;this.questionReviews=questionReviews;this.chapters=chapters;this.students=students;this.writings=writings;this.errors=errors;this.mapper=mapper;}
    @Override @Transactional public void run(ApplicationArguments args) throws Exception {
        seed("spacing-school","SPACING", "나는 학교에 ___ 친구를 만났어요.", List.of("가서","가 서"),"가서","‘학교에’와 ‘가서’는 자연스럽게 이어 써요.");
        seed("pronunciation-together","PRONUNCIATION_SPELLING", "친구와 ___ 놀았어요.", List.of("가치","같이"),"같이","‘함께’라는 뜻으로 쓸 때는 ‘같이’예요.");
        seed("final-consonant","FINAL_CONSONANT", "비가 오니까 우산을 ___ 가요.", List.of("갖고","갇고"),"갖고","‘가지고’라는 뜻의 ‘갖고’에는 ㅈ 받침이 들어가요.");
        seed("doe-dwae","DOE_DWAE", "오늘은 숙제를 다 해도 ___.", List.of("되요","돼요"),"돼요","‘되어요’로 바꿔 말할 수 있으니 ‘돼요’가 맞아요.");
        seed("spacing-home","SPACING", "집에 ___ 손을 씻었어요.", List.of("와서","와 서"),"와서","‘와서’는 ‘오다’에 ‘-아서’가 붙은 말이라 이어 써요.");
        seed("spacing-one-book","SPACING", "이번 주에 책을 ___ 읽었어요.", List.of("한 권","한권"),"한 권","수를 세는 ‘권’은 앞말과 띄어 써요.");
        seed("spacing-a-while","SPACING", "친구를 운동장에서 ___ 기다렸어요.", List.of("한참","한 참"),"한참","‘시간이 꽤 지나는 동안’이라는 뜻의 ‘한참’은 붙여 써요.");
        seed("spacing-all-out","SPACING", "운동장에서는 ___ 뛰어도 돼요.", List.of("마음껏","마음 껏"),"마음껏","‘마음껏’은 한 단어라 붙여 써요.");
        seed("word-shoulder","PRONUNCIATION_SPELLING", "가방을 어깨에 ___ 학교에 갔어요.", List.of("메고","매고"),"메고","가방처럼 어깨에 걸치는 것은 ‘메다’라고 써요.");
        seed("word-letter","PRONUNCIATION_SPELLING", "친구에게 편지를 ___ 우체통에 넣었어요.", List.of("부쳐서","붙여서"),"부쳐서","편지나 소식을 보내는 것은 ‘부치다’라고 써요.");
        seed("final-recover","FINAL_CONSONANT", "감기가 다 ___ 다시 놀러 가요.", List.of("나으면","낳으면"),"나으면","병이 좋아진다는 뜻은 ‘낫다’가 바뀐 ‘나으면’이에요.");
        seed("final-birth","FINAL_CONSONANT", "엄마 고양이가 새끼를 ___ 정성껏 돌봐요.", List.of("낳아","나아"),"낳아","아기를 세상에 나오게 하는 것은 ‘낳다’라고 써요.");
        seed("final-match","FINAL_CONSONANT", "이 모자는 내 머리에 잘 ___.", List.of("맞아요","마자요"),"맞아요","‘맞다’는 받침 ㅈ을 살려 ‘맞아요’라고 써요.");
        seed("doe-window","DOE_DWAE", "창문을 조금 열어도 ___.", List.of("되요","돼요"),"돼요","‘되어요’로 바꿀 수 있으니 ‘돼요’가 맞아요.");
        seed("doe-future","DOE_DWAE", "연습하면 내일은 더 잘 ___ 거예요.", List.of("될","됄"),"될","‘되다’의 관형형은 ‘될’이라고 써요.");
        seed("doe-work","DOE_DWAE", "숙제를 먼저 해야 ___.", List.of("되","돼"),"돼","‘되어’로 바꿀 수 있으니 ‘돼’가 맞아요.");
        seed("an-outside","AN_ANH", "비가 와서 오늘은 밖에 ___ 나가요.", List.of("안","않"),"안","뒤에 동사 ‘나가다’가 바로 오면 ‘안’을 써요.");
        seed("an-breakfast","AN_ANH", "동생은 아침을 먹지 ___.", List.of("않아요","안아요"),"않아요","‘먹지 않다’처럼 ‘-지’ 뒤에는 ‘않다’를 써요.");
        seed("an-promise","AN_ANH", "나는 그 약속을 ___ 잊을 거예요.", List.of("안","않"),"안","뒤에 동사 ‘잊다’가 바로 오면 ‘안’을 써요.");
        seedListening("listen-school", "식사", "밥을 먹는 일을 가리키는 말이에요.");
        seedListening("listen-together", "사장", "가게나 회사를 맡아 운영하는 사람이에요.");
        seedListening("listen-shoulder", "약속", "서로 지키기로 정한 일이에요.");
        seedListening("listen-recover", "시장", "여러 가게가 모여 물건을 파는 곳이에요.");
        seedListening("listen-an", "가족", "한집에서 함께 지내는 사람들을 말해요.");
        seedListening("listen-umbrella", "우산", "비가 올 때 쓰는 물건이에요.");
        seedListening("listen-pencil", "연필", "글씨를 쓸 때 사용하는 도구예요.");
        seedListening("listen-wind", "바람", "공기가 움직이는 것을 가리키는 말이에요.");
        seedListening("listen-tree", "나무", "줄기와 가지가 있는 식물이에요.");
        seedListening("listen-friend", "친구", "함께 놀고 지내는 사람을 말해요.");
        seedListening("listen-picnic", "소풍", "가까운 곳으로 놀러 가는 일이에요.");
        seedListening("listen-exercise", "운동", "몸을 튼튼하게 하려고 움직이는 일이에요.");
        seedListening("listen-food", "음식", "사람이 먹는 것을 가리키는 말이에요.");
        seedListening("listen-classroom", "교실", "학교에서 공부하는 방이에요.");
        seedListening("listen-shoes", "신발", "발에 신고 다니는 물건이에요.");
        seedListening("listen-hospital", "병원", "아픈 사람이 진료받는 곳이에요.");
        seedListening("listen-letter", "편지", "마음을 글로 적어 보내는 종이예요.");
        seedListening("listen-gift", "선물", "고마운 마음으로 다른 사람에게 주는 것이에요.");
        seedListening("listen-cat", "고양이", "야옹 하고 우는 동물이에요.");
        seedListening("listen-dog", "강아지", "멍멍 하고 짖는 동물이에요.");
    }
    private void seed(String key,String category,String prompt,List<String> choices,String answer,String explanation)throws Exception{
        String choicesJson=mapper.writeValueAsString(choices);
        Optional<LearningQuestion> existing=questions.findBySeedKey(key);
        if(existing.isPresent()) existing.get().updateSeedContent(category,2,"MULTIPLE_CHOICE",prompt,choicesJson,answer,explanation);
        else questions.save(new LearningQuestion(key,category,2,"MULTIPLE_CHOICE",prompt,choicesJson,answer,explanation));
    }
    private void seedListening(String key,String answer,String explanation)throws Exception{
        String choicesJson=mapper.writeValueAsString(List.of());
        String prompt="소리를 듣고 들린 단어를 써보세요.";
        Optional<LearningQuestion> existing=questions.findBySeedKey(key);
        if(existing.isPresent()) existing.get().updateSeedContent("VOCABULARY",2,"LISTEN_AND_TYPE",prompt,answer,choicesJson,answer,explanation);
        else questions.save(new LearningQuestion(key,"VOCABULARY",2,"LISTEN_AND_TYPE",prompt,answer,choicesJson,answer,explanation));
    }
    @Transactional public List<QuestionDto> today(UUID studentId,String email)throws Exception{
        StudentProfile student=students.requireOwned(studentId,email); List<LearningQuestion> all=new ArrayList<>(questions.findAllByGradeInOrderByCategoryAsc(List.of(1,2,3)).stream()
            .filter(q -> "MULTIPLE_CHOICE".equals(q.getQuestionType()) ? q.getPrompt().contains("___") : "LISTEN_AND_TYPE".equals(q.getQuestionType()) && q.getAudioText()!=null && !q.getAudioText().isBlank())
            .filter(q -> { if("LISTEN_AND_TYPE".equals(q.getQuestionType())) return true; try { return mapper.readValue(q.getChoicesJson(), new TypeReference<List<String>>(){}).size() >= 2; } catch (Exception ignored) { return false; } })
            .toList());
        if(all.isEmpty()) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"오늘의 빈칸 단어 문제를 준비하고 있어요.");
        ZoneId zone=ZoneId.of("Asia/Seoul");
        LocalDate chapterDate=LocalDate.now(zone);
        List<LearningChapter> studentChapters=chapters.findAllByStudentIdOrderByChapterNumberDescCreatedAtDesc(studentId);
        Optional<LearningChapter> activeChapter=studentChapters.stream().filter(chapter->!chapter.isComplete()).findFirst();
        if(activeChapter.isPresent()){
            completeChapterQuestionMix(activeChapter.get(),all);
            return chapterQuestions(activeChapter.get());
        }
        List<QuestionAttempt> studentAttempts=attempts.findAllByStudentId(studentId);
        Map<UUID,QuestionStats> questionStats=new HashMap<>();
        Map<String,CategoryStats> categoryStats=new HashMap<>();
        Instant now=Instant.now();
        for(QuestionAttempt attempt:studentAttempts){
            questionStats.computeIfAbsent(attempt.getQuestionId(),ignored->new QuestionStats()).add(attempt);
            if(attempt.getCreatedAt().isAfter(now.minus(Duration.ofDays(30)))){
                double decay=decay(attempt.getCreatedAt(),now);
                categoryStats.computeIfAbsent(attempt.getQuestionCategory(),ignored->new CategoryStats()).addAttempt(attempt.isCorrect(),decay);
            }
        }
        for(WritingError item:errors.findAllByWritingStudentId(studentId)){
            if(item.getCreatedAt().isAfter(now.minus(Duration.ofDays(30)))){
                double decay=decay(item.getCreatedAt(),now);
                categoryStats.computeIfAbsent(item.getCategory(),ignored->new CategoryStats()).addWritingError(item.isSolved(),decay);
            }
        }
        List<LearningQuestion> picked=selectDailyQuestions(all,questionStats,categoryStats,now);
        if(picked.size()!=10)throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"오늘의 10문제를 준비하고 있어요.");
        int nextChapterNumber=studentChapters.stream().mapToInt(LearningChapter::getChapterNumber).max().orElse(0)+1;
        LearningChapter chapter=new LearningChapter(student,chapterDate,nextChapterNumber);
        picked.forEach(chapter::addQuestion);
        return chapterQuestions(chapters.save(chapter));
    }

    private List<QuestionDto> chapterQuestions(LearningChapter chapter){
        List<LearningChapterQuestion> listening=chapter.getQuestions().stream().filter(item->"LISTEN_AND_TYPE".equals(item.getQuestion().getQuestionType())).toList();
        List<LearningChapterQuestion> choices=chapter.getQuestions().stream().filter(item->"MULTIPLE_CHOICE".equals(item.getQuestion().getQuestionType())).toList();
        String[][] patterns={
            {"MULTIPLE_CHOICE","LISTEN_AND_TYPE","MULTIPLE_CHOICE","MULTIPLE_CHOICE","LISTEN_AND_TYPE","MULTIPLE_CHOICE","MULTIPLE_CHOICE","LISTEN_AND_TYPE","MULTIPLE_CHOICE","MULTIPLE_CHOICE"},
            {"MULTIPLE_CHOICE","MULTIPLE_CHOICE","LISTEN_AND_TYPE","MULTIPLE_CHOICE","MULTIPLE_CHOICE","LISTEN_AND_TYPE","MULTIPLE_CHOICE","MULTIPLE_CHOICE","LISTEN_AND_TYPE","MULTIPLE_CHOICE"},
            {"LISTEN_AND_TYPE","MULTIPLE_CHOICE","MULTIPLE_CHOICE","LISTEN_AND_TYPE","MULTIPLE_CHOICE","MULTIPLE_CHOICE","LISTEN_AND_TYPE","MULTIPLE_CHOICE","MULTIPLE_CHOICE","MULTIPLE_CHOICE"}
        };
        String[] pattern=patterns[Math.floorMod(chapter.getChapterNumber()-1,patterns.length)];
        List<LearningChapterQuestion> ordered=new ArrayList<>(); int listeningIndex=0; int choiceIndex=0;
        for(String type:pattern){
            if("LISTEN_AND_TYPE".equals(type)&&listeningIndex<listening.size())ordered.add(listening.get(listeningIndex++));
            else if(choiceIndex<choices.size())ordered.add(choices.get(choiceIndex++));
            else if(listeningIndex<listening.size())ordered.add(listening.get(listeningIndex++));
        }
        while(choiceIndex<choices.size())ordered.add(choices.get(choiceIndex++));
        while(listeningIndex<listening.size())ordered.add(listening.get(listeningIndex++));
        return ordered.stream().map(item->toDto(item.getQuestion(),item.isCompleted())).toList();
    }

    private void completeChapterQuestionMix(LearningChapter chapter,List<LearningQuestion> all){
        Set<UUID> included=chapter.getQuestions().stream().map(item->item.getQuestion().getId()).collect(java.util.stream.Collectors.toSet());
        long listeningCount=chapter.getQuestions().stream().filter(item->"LISTEN_AND_TYPE".equals(item.getQuestion().getQuestionType())).count();
        long choiceCount=chapter.getQuestions().stream().filter(item->"MULTIPLE_CHOICE".equals(item.getQuestion().getQuestionType())).count();
        long listeningNeeded=Math.max(0,3-listeningCount);
        long choicesNeeded=Math.max(0,7-choiceCount);
        all.stream().filter(q->"LISTEN_AND_TYPE".equals(q.getQuestionType())&&!included.contains(q.getId()))
            .sorted(Comparator.comparing(LearningQuestion::getSeedKey)).limit(listeningNeeded).forEach(chapter::addQuestion);
        all.stream().filter(q->"MULTIPLE_CHOICE".equals(q.getQuestionType())&&!included.contains(q.getId()))
            .sorted(Comparator.comparing(LearningQuestion::getSeedKey)).limit(choicesNeeded).forEach(chapter::addQuestion);
        chapters.save(chapter);
    }

    private List<LearningQuestion> selectDailyQuestions(List<LearningQuestion> all,Map<UUID,QuestionStats> questionStats,Map<String,CategoryStats> categoryStats,Instant now){
        Instant recentCutoff=now.minus(Duration.ofDays(3));
        Comparator<LearningQuestion> weaknessOrder=Comparator
            .<LearningQuestion>comparingDouble(q->-categoryStats.getOrDefault(q.getCategory(),CategoryStats.EMPTY).priority())
            .thenComparing(q->{QuestionStats s=questionStats.get(q.getId());return s==null||s.lastAttempt==null?Instant.MIN:s.lastAttempt;})
            .thenComparing(LearningQuestion::getSeedKey);
        List<LearningQuestion> listening = selectQuestionType(all,"LISTEN_AND_TYPE",3,recentCutoff,questionStats,weaknessOrder);
        List<LearningQuestion> choices = selectQuestionType(all,"MULTIPLE_CHOICE",7,recentCutoff,questionStats,weaknessOrder);
        List<LearningQuestion> selected=new ArrayList<>(listening);
        selected.addAll(choices);
        return selected;
    }
    private List<LearningQuestion> selectQuestionType(List<LearningQuestion> all,String type,int count,Instant recentCutoff,
            Map<UUID,QuestionStats> questionStats,Comparator<LearningQuestion> weaknessOrder){
        List<LearningQuestion> candidates=all.stream().filter(q->type.equals(q.getQuestionType())).toList();
        List<LearningQuestion> selected=new ArrayList<>(candidates.stream()
            .filter(q->{QuestionStats stats=questionStats.get(q.getId());return stats==null||stats.lastAttempt==null||!stats.lastAttempt.isAfter(recentCutoff);})
            .sorted(weaknessOrder).limit(count).toList());
        if(selected.size()<count){
            Set<UUID> selectedIds=selected.stream().map(LearningQuestion::getId).collect(java.util.stream.Collectors.toSet());
            candidates.stream().filter(q->!selectedIds.contains(q.getId()))
                .sorted(Comparator.<LearningQuestion>comparingInt(q->{QuestionStats stats=questionStats.get(q.getId());return stats==null?0:stats.attempts;})
                    .thenComparing(weaknessOrder))
                .limit(count-selected.size()).forEach(selected::add);
        }
        return selected;
    }
    private void addQuestion(LearningQuestion q,List<LearningQuestion> selected,Set<UUID> selectedIds,Set<String> selectedCategories){
        if(selectedIds.add(q.getId())){selected.add(q);selectedCategories.add(q.getCategory());}
    }
    private static double decay(Instant createdAt,Instant now){return Math.exp(-Duration.between(createdAt,now).toDays()/14.0);}
    private static final class QuestionStats{
        private int attempts; private Instant lastAttempt;
        private void add(QuestionAttempt attempt){attempts++;if(lastAttempt==null||attempt.getCreatedAt().isAfter(lastAttempt))lastAttempt=attempt.getCreatedAt();}
    }
    private static final class CategoryStats{
        private static final CategoryStats EMPTY=new CategoryStats();
        private int attempts; private double pressure;
        private void addAttempt(boolean correct,double decay){attempts++;pressure+=correct?-0.7*decay:2.0*decay;}
        private void addWritingError(boolean solved,double decay){pressure+=solved?-0.5*decay:1.5*decay;}
        private double priority(){return Math.max(0,pressure);}
    }
    @Transactional public AttemptResult attempt(UUID questionId,UUID studentId,String email,String answer){
        StudentProfile student=students.requireOwned(studentId,email); LearningQuestion q=questions.findById(questionId).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"문제를 찾을 수 없어요."));
        String normalizedAnswer=java.text.Normalizer.normalize(answer.trim(),java.text.Normalizer.Form.NFC);
        boolean correct=java.text.Normalizer.normalize(q.getAnswer(),java.text.Normalizer.Form.NFC).equals(normalizedAnswer); attempts.save(new QuestionAttempt(student,q,answer.trim(),correct));
        List<LearningChapter> studentChapters=chapters.findAllByStudentIdOrderByChapterNumberDescCreatedAtDesc(studentId);
        LearningChapter questionChapter=studentChapters.stream().filter(chapter->chapter.containsQuestion(questionId)).findFirst().orElse(null);
        LearningChapter activeChapter=studentChapters.stream().filter(chapter->!chapter.isComplete()).findFirst().orElse(null);
        if(correct&&questionChapter!=null){boolean updated=questionChapter.getQuestions().stream().anyMatch(item->item.complete(questionId));if(updated)chapters.save(questionChapter);}
        if(!correct){
            LocalDate chapterDate=LocalDate.now(ZoneId.of("Asia/Seoul"));
            LearningChapter reviewChapter=questionChapter!=null?questionChapter:activeChapter;
            int chapterNumber=reviewChapter!=null?reviewChapter.getChapterNumber():studentChapters.stream().findFirst().map(LearningChapter::getChapterNumber).orElse(1);
            questionReviews.findByStudentIdAndQuestionIdAndChapterNumber(studentId,questionId,chapterNumber)
                .orElseGet(()->questionReviews.save(new QuestionReviewItem(student,q,chapterDate,chapterNumber)));
        }
        String message=correct?("LISTEN_AND_TYPE".equals(q.getQuestionType())?"정답이에요!":"정답이에요! "+q.getExplanation()):"틀렸어요.";
        return new AttemptResult(correct,message,correct?q.getAnswer():null);
    }
    @Transactional public void skip(UUID questionId,UUID studentId,String email){
        StudentProfile student=students.requireOwned(studentId,email);
        LearningQuestion q=questions.findById(questionId).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"문제를 찾을 수 없어요."));
        List<LearningChapter> studentChapters=chapters.findAllByStudentIdOrderByChapterNumberDescCreatedAtDesc(studentId);
        LearningChapter chapter=studentChapters.stream().filter(item->item.containsQuestion(questionId)).findFirst().orElse(null);
        int chapterNumber=chapter!=null?chapter.getChapterNumber():studentChapters.stream().findFirst().map(LearningChapter::getChapterNumber).orElse(1);
        LocalDate chapterDate=chapter!=null?chapter.getChapterDate():LocalDate.now(ZoneId.of("Asia/Seoul"));
        if(chapter!=null){chapter.getQuestions().stream().filter(item->item.getQuestion().getId().equals(questionId)).findFirst().ifPresent(item->item.complete(questionId));chapters.save(chapter);}
        if(questionReviews.findByStudentIdAndQuestionIdAndChapterNumber(studentId,questionId,chapterNumber).isEmpty())
            questionReviews.save(new QuestionReviewItem(student,q,chapterDate,chapterNumber));
    }
    @Transactional(readOnly=true) public List<QuestionReviewChapterDto> questionReviews(UUID studentId,String email){
        students.requireOwned(studentId,email);
        Map<ReviewChapterKey,List<QuestionReviewDto>> chapters=new LinkedHashMap<>();
        for(QuestionReviewItem item:questionReviews.findAllByStudentIdOrderByChapterDateDescChapterNumberDescCreatedAtAsc(studentId)){
            LearningQuestion q=item.getQuestion();
            List<String> choices;
            try{choices=mapper.readValue(q.getChoicesJson(),new TypeReference<List<String>>(){});}catch(Exception ignored){choices=List.of();}
            ReviewChapterKey key=new ReviewChapterKey(item.getChapterDate(),item.getChapterNumber());
            chapters.computeIfAbsent(key,ignored->new ArrayList<>()).add(new QuestionReviewDto(item.getId(),q.getCategory(),q.getQuestionType(),q.getPrompt(),q.getAudioText(),choices,item.getReviewAttempts(),item.isSolved()));
        }
        return chapters.entrySet().stream().map(entry->new QuestionReviewChapterDto(entry.getKey().date(),entry.getKey().number(),entry.getValue())).toList();
    }
    @Transactional public AttemptResult attemptQuestionReview(UUID reviewId,String email,String answer){
        QuestionReviewItem item=questionReviews.findById(reviewId).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"복습 문제를 찾을 수 없어요."));
        students.requireOwned(item.getStudent().getId(),email);
        if(item.isSolved())return new AttemptResult(true,"이미 복습을 마쳤어요.",item.getQuestion().getAnswer());
        boolean correct=item.submitReview(answer);
        LearningQuestion question=item.getQuestion();
        String message=correct?("LISTEN_AND_TYPE".equals(question.getQuestionType())?"정답이에요!":"정답이에요! "+question.getExplanation()):"틀렸어요.";
        return new AttemptResult(correct,message,correct?question.getAnswer():null);
    }
    @Transactional(readOnly=true) public DailyDto daily(UUID studentId,String email){
        students.requireOwned(studentId,email); Instant today=LocalDate.now(ZoneId.of("Asia/Seoul")).atStartOfDay(ZoneId.of("Asia/Seoul")).toInstant();
        List<QuestionAttempt> a=attempts.findAllByStudentIdAndCreatedAtAfter(studentId,today); List<kr.co.hanguldetective.writing.WritingEntry> w=writings.findAllByStudentIdAndCreatedAtAfter(studentId,today);
        LocalDate todayDate=LocalDate.now(ZoneId.of("Asia/Seoul"));
        boolean questionDone=chapters.findAllByStudentIdOrderByChapterNumberDescCreatedAtDesc(studentId).stream().anyMatch(chapter->todayDate.equals(chapter.getCompletionDate()))||a.stream().filter(QuestionAttempt::isCorrect).map(QuestionAttempt::getQuestionId).distinct().count()>=10; boolean writeDone=!w.isEmpty(); boolean reviewDone=writeDone&&w.stream().allMatch(entry->entry.getErrors().stream().allMatch(WritingError::isSolved));
        return new DailyDto(questionDone,writeDone,reviewDone,(questionDone?1:0)+(writeDone?1:0)+(reviewDone?1:0));
    }
    private QuestionDto toDto(LearningQuestion q,boolean correct){try{return new QuestionDto(q.getId(),q.getCategory(),q.getQuestionType(),q.getPrompt(),q.getAudioText(),mapper.readValue(q.getChoicesJson(),new TypeReference<List<String>>(){}),null,null,correct);}catch(Exception e){return new QuestionDto(q.getId(),q.getCategory(),q.getQuestionType(),q.getPrompt(),q.getAudioText(),List.of(),null,null,correct);}}
    public record QuestionDto(UUID id,String category,String questionType,String prompt,String audioText,List<String> choices,String answer,String explanation,boolean correct){}
    public record AttemptResult(boolean correct,String message,String answer){}
    public record QuestionReviewDto(UUID id,String category,String questionType,String prompt,String audioText,List<String> choices,int reviewAttempts,boolean solved){}
    public record QuestionReviewChapterDto(LocalDate chapterDate,int chapterNumber,List<QuestionReviewDto> questions){}
    public record DailyDto(boolean questionsDone,boolean writingDone,boolean reviewDone,int completedCount){}
    @Transactional(readOnly=true) public List<DayRecord> history(UUID studentId,String email){
        students.requireOwned(studentId,email);
        ZoneId zone=ZoneId.of("Asia/Seoul");
        var allAttempts=attempts.findAllByStudentId(studentId);
        var allWritings=writings.findAllByStudentIdOrderByCreatedAtDesc(studentId);
        Map<LocalDate,List<LearningChapter>> chapterByDate=new HashMap<>();
        var studentChapters=chapters.findAllByStudentIdOrderByChapterNumberDescCreatedAtDesc(studentId);
        Map<LocalDate,Integer> completedQuestionsByDate=new HashMap<>();
        for(var chapter:studentChapters){
            LocalDate completionDate=chapter.getCompletionDate();
            if(completionDate!=null) chapterByDate.computeIfAbsent(completionDate,ignored->new ArrayList<>()).add(chapter);
            for(var item:chapter.getQuestions()) if(item.isCompleted()) {
                LocalDate date=item.getCompletedAt()==null?chapter.getChapterDate():item.getCompletedAt().atZone(zone).toLocalDate();
                completedQuestionsByDate.merge(date,1,Integer::sum);
            }
        }
        Set<LocalDate> dates=new TreeSet<>(Comparator.reverseOrder());
        dates.add(LocalDate.now(zone));
        allAttempts.forEach(a->dates.add(a.getCreatedAt().atZone(zone).toLocalDate()));
        allWritings.forEach(w->dates.add(w.getCreatedAt().atZone(zone).toLocalDate()));
        dates.addAll(chapterByDate.keySet()); dates.addAll(completedQuestionsByDate.keySet());
        return dates.stream().map(date->{
            var dayAttempts=allAttempts.stream().filter(a->a.getCreatedAt().atZone(zone).toLocalDate().equals(date)).toList();
            var dayWritings=allWritings.stream().filter(w->w.getCreatedAt().atZone(zone).toLocalDate().equals(date)).toList();
            List<LearningChapter> dayChapters=chapterByDate.getOrDefault(date,List.of());
            int solved=studentChapters.isEmpty()?(int)dayAttempts.stream().filter(QuestionAttempt::isCorrect).map(QuestionAttempt::getQuestionId).distinct().count():completedQuestionsByDate.getOrDefault(date,0);
            int chaptersCompleted=studentChapters.isEmpty()?(solved>=10?1:0):dayChapters.size();
            int remaining=(int)dayWritings.stream().flatMap(w->w.getErrors().stream()).filter(e->!e.isSolved()).count();
            int completed=(chaptersCompleted>0?1:0)+(dayWritings.isEmpty()?0:1)+(dayWritings.isEmpty()||remaining>0?0:1);
            return new DayRecord(date,solved,dayAttempts.size(),dayWritings.size(),remaining,completed,chaptersCompleted,dayWritings.stream().map(w->new Note(w.getId(),w.getText(),(int)w.getErrors().stream().filter(e->!e.isSolved()).count())).toList());
        }).toList();
    }
    public record Note(UUID id,String text,int remaining){}
    private record ReviewChapterKey(LocalDate date,int number){}
    public record DayRecord(LocalDate date,int questionsSolved,int attempts,int writingCount,int remaining,int completedCount,int chaptersCompleted,List<Note> notes){}
}
