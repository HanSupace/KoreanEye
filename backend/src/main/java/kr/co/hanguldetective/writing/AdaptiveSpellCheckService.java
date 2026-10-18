package kr.co.hanguldetective.writing;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Service
public class AdaptiveSpellCheckService implements SpellCheckService {
    private static final Logger log=LoggerFactory.getLogger(AdaptiveSpellCheckService.class);
    private final RuleBasedSpellCheckService rules; private final OpenAiSpellCheckService openAi; private final String mode; private final String apiKey;
    public AdaptiveSpellCheckService(RuleBasedSpellCheckService rules,OpenAiSpellCheckService openAi,@Value("${app.ai.mode}") String mode,@Value("${app.ai.api-key:}") String apiKey){this.rules=rules;this.openAi=openAi;this.mode=mode;this.apiKey=apiKey;}
    @Override public AnalysisResult analyze(String text){
        if("openai".equalsIgnoreCase(mode)&&!apiKey.isBlank()) try{return openAi.analyze(text);}catch(Exception ex){log.warn("OpenAI 글 분석에 실패해 규칙 기반 분석으로 전환합니다: {}",ex.getMessage());}
        return rules.analyze(text);
    }
}
