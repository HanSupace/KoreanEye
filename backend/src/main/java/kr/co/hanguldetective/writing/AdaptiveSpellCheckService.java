package kr.co.hanguldetective.writing;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

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
                throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Google Gemini 연결에 실패해 글을 분석하지 못했어요. Gemini API 키와 사용량 한도를 확인해 주세요.");
            }
        }
        return rules.analyze(text);
    }
}
