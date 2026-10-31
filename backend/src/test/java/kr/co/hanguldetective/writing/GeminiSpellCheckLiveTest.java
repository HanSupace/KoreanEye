package kr.co.hanguldetective.writing;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.web.client.RestClient;
import static org.junit.jupiter.api.Assertions.*;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/** Explicit opt-in: uses the real API, quota and credentials supplied by the environment. */
@EnabledIfEnvironmentVariable(named="KOREANEYE_RUN_LIVE_GEMINI_TESTS",matches="true")
class GeminiSpellCheckLiveTest {
    private GeminiSpellCheckService service() {
        String key=System.getenv("GOOGLE_GEMINI_API_KEY");
        assumeTrue(key!=null&&!key.isBlank(),"Requires GOOGLE_GEMINI_API_KEY in the process environment");
        String model=System.getenv().getOrDefault("GOOGLE_GEMINI_MODEL","gemini-3.1-flash-lite");
        return new GeminiSpellCheckService(RestClient.builder(),new ObjectMapper(),key,model);
    }

    @Test void correctSentencesHaveNoActionableCandidates() {
        var checker=service();
        for(String text:List.of("시험이 빨리 끝났으면 좋겠다.","오늘 학교에 다녀왔다.","친구와 함께 밥을 먹었다.","나는 책을 읽고 잠들었다.")) {
            var actionable=checker.analyze(text).errors().stream()
                .filter(error->WritingCandidateValidator.hasCorrection(error.original(),error.correct())).toList();
            assertTrue(actionable.isEmpty(),text);
        }
    }

    @Test void realSpellingAndSpacingErrorsRemainDetectable() {
        var checker=service();
        for(String text:List.of("시험이 빨리 끝낫으면 좋겠다.","오늘 친구랑 가치 놀았다.","집에와서 밥을 먹었다."))
            assertTrue(checker.analyze(text).errors().stream()
                .anyMatch(error->WritingCandidateValidator.hasCorrection(error.original(),error.correct())),text);
    }
}
