package kr.co.hanguldetective.writing;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.server.ResponseStatusException;
import java.util.Optional;
import java.util.Map;

@Service
public class AdaptiveSpellCheckService implements SpellCheckService {
    private static final Logger log=LoggerFactory.getLogger(AdaptiveSpellCheckService.class);
    private final RuleBasedSpellCheckService rules; private final OpenAiSpellCheckService openAi; private final GeminiSpellCheckService gemini; private final String mode; private final String apiKey; private final String geminiApiKey;
    public AdaptiveSpellCheckService(RuleBasedSpellCheckService rules,OpenAiSpellCheckService openAi,GeminiSpellCheckService gemini,@Value("${app.ai.mode}") String mode,@Value("${app.ai.api-key:}") String apiKey,@Value("${app.ai.gemini-api-key:}") String geminiApiKey){this.rules=rules;this.openAi=openAi;this.gemini=gemini;this.mode=mode;this.apiKey=apiKey;this.geminiApiKey=geminiApiKey;}
    @Override public AnalysisResult analyze(String text){
        if("openai".equalsIgnoreCase(mode)) {
            if (apiKey.isBlank()) {
                throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "OpenAI API 키가 설정되지 않아 글을 분석하지 못했어요.");
            }
            try {
                return openAi.analyze(text);
            } catch (Exception ex) {
                log.warn("OpenAI 글 분석에 실패했습니다: {}", ex.getMessage());
                throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "OpenAI 연결에 실패해 글을 분석하지 못했어요. 보호자 설정에서 API 키를 확인해 주세요.");
            }
        }
        if("gemini".equalsIgnoreCase(mode)) {
            if (geminiApiKey.isBlank()) {
                throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Gemini API 키가 설정되지 않아 글을 분석하지 못했어요.");
            }
            try {
                return gemini.analyze(text);
            } catch (Exception ex) {
                log.warn("Gemini 글 분석에 실패했습니다: {}", ex.getMessage());
                String message=ex instanceof HttpServerErrorException.ServiceUnavailable
                    ? "Google Gemini가 일시적으로 바빠요. 잠시 후 다시 시도해 주세요."
                    : "Google Gemini 연결에 실패해 글을 분석하지 못했어요. API 키와 사용량 한도를 확인해 주세요.";
                throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, message);
            }
        }
        return rules.analyze(text);
    }

    public Optional<String> generatePracticeSentence(String category,String correct,String incorrect){
        try{
            String sentence;
            if("gemini".equalsIgnoreCase(mode)) sentence=gemini.generatePracticeSentence(category,correct,incorrect);
            else if("openai".equalsIgnoreCase(mode)) sentence=openAi.generatePracticeSentence(category,correct,incorrect);
            else if(!geminiApiKey.isBlank()) sentence=gemini.generatePracticeSentence(category,correct,incorrect);
            else if(!apiKey.isBlank()) sentence=openAi.generatePracticeSentence(category,correct,incorrect);
            else return Optional.empty();
            if(sentence==null)return Optional.empty();
            sentence=sentence.strip();
            int blank=sentence.indexOf("___");
            if(sentence.length()>200||blank<0||sentence.indexOf("___",blank+3)>=0||sentence.contains("____")){
                log.warn("AI 맞춤 예문을 사용하지 않았어요: 형식이 올바르지 않습니다.");
                return Optional.empty();
            }
            return Optional.of(sentence);
        }catch(Exception ex){
            String reason=ex instanceof IllegalStateException&&ex.getMessage()!=null?ex.getMessage():ex.getClass().getSimpleName();
            if(reason.length()>240)reason=reason.substring(0,240);
            log.warn("AI 맞춤 예문 생성에 실패했어요: {}",reason);
            return Optional.empty();
        }
    }

    public Optional<WeeklyReportAiInsight> generateWeeklyReportInsight(Map<String,Object> metrics){
        try{
            WeeklyReportAiInsight insight;
            if("gemini".equalsIgnoreCase(mode))insight=gemini.generateWeeklyReportInsight(metrics);
            else if("openai".equalsIgnoreCase(mode))insight=openAi.generateWeeklyReportInsight(metrics);
            else if(!geminiApiKey.isBlank())insight=gemini.generateWeeklyReportInsight(metrics);
            else if(!apiKey.isBlank())insight=openAi.generateWeeklyReportInsight(metrics);
            else return Optional.empty();
            if(insight==null)return Optional.empty();
            String praise=insight.praise()==null?"":insight.praise().strip();
            String nextGoal=insight.nextGoal()==null?"":insight.nextGoal().strip();
            String weakness=insight.weaknessSummary()==null?"":insight.weaknessSummary().strip();
            String advice=insight.parentAdvice()==null?"":insight.parentAdvice().strip();
            if(praise.isBlank()||nextGoal.isBlank()||weakness.isBlank()||advice.isBlank()
                    ||praise.length()>120||nextGoal.length()>120||weakness.length()>160||advice.length()>180){
                log.warn("AI 주간 리포트 문구를 사용하지 않았어요: 응답 형식이 올바르지 않습니다.");
                return Optional.empty();
            }
            return Optional.of(new WeeklyReportAiInsight(praise,nextGoal,weakness,advice));
        }catch(Exception ex){
            log.warn("AI 주간 리포트 생성에 실패했어요: {}",ex.getClass().getSimpleName());
            return Optional.empty();
        }
    }
}
