package kr.co.hanguldetective.writing;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.security.Principal;
import java.util.UUID;
import kr.co.hanguldetective.config.ApiExceptionHandler;
import kr.co.hanguldetective.learning.QuestionAttemptRepository;
import kr.co.hanguldetective.student.StudentService;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class ProfanityFilterTest {
    @Test void sharedPolicyFixtures() throws Exception {
        try (var input = getClass().getResourceAsStream("/profanity-policy.json")) {
            var policy = new ObjectMapper().readTree(input);
            for (var item : policy.get("cases")) {
                assertEquals(item.get("blocked").asBoolean(), ProfanityFilter.containsProfanity(item.get("text").asText()), item.get("text").asText());
            }
            for (String key : new String[]{"blockedExpressions", "allowedExpressions"}) {
                for (var item : policy.get(key)) {
                    String expression = item.asText();
                    for (String text : new String[]{expression, "오늘 " + expression + " 그리고 집에 갔다.", "오늘 " + expression}) {
                        assertEquals(key.equals("blockedExpressions"), ProfanityFilter.containsProfanity(text), text);
                    }
                }
            }
        }
    }

    private static java.util.List<String> consonantPrefixes() {
        var consonants = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ".codePoints()
            .mapToObj(cp -> new String(Character.toChars(cp))).toList();
        var prefixes = new java.util.ArrayList<>(consonants);
        for (String a : consonants) for (String b : consonants) prefixes.add(a + b);
        prefixes.addAll(java.util.List.of("ㄱㄴㄷ", "ㅋㅋㅋ", "ㄳㄵㄶㄺㄻㄼㄽㄾㄿㅀㅄ"));
        return prefixes;
    }

    @Test void everyConsonantAndOrderedPairBeforeProfanity() throws Exception {
        try (var input = getClass().getResourceAsStream("/profanity-policy.json")) {
            var policy = new ObjectMapper().readTree(input);
            var terms = new java.util.ArrayList<String>(java.util.List.of("ㅈ같네", "개병신", "ㅅㄲ야", "ㅅㄲ네"));
            for (String key : new String[]{"terms", "initialTerms"})
                policy.get(key).forEach(term -> terms.add(term.asText()));
            for (String prefix : consonantPrefixes()) for (String term : terms) {
                String combined = prefix + term;
                for (String text : new String[]{combined, "오늘 " + combined + " 그리고",
                        java.text.Normalizer.normalize(combined, java.text.Normalizer.Form.NFKC)})
                    assertTrue(ProfanityFilter.containsProfanity(text), text);
            }
        }
    }

    @Test void consonantsPreserveOrdinaryWordBoundaries() {
        var prefixes = new java.util.ArrayList<>(consonantPrefixes());
        prefixes.add("");
        for (String prefix : prefixes)
            for (String word : new String[]{"시발점", "등신대", "졸라매고", "병원에 갔다.", "친구와 같이 놀았다.", "씹새우를 관찰했다."})
                assertFalse(ProfanityFilter.containsProfanity(prefix + word), prefix + word);
    }

    @Test void directApiRejectsBeforeAiOrPersistenceEvenWhenAiIsUnavailable() throws Exception {
        var students = mock(StudentService.class);
        var writings = mock(WritingEntryRepository.class);
        var errors = mock(WritingErrorRepository.class);
        var checker = mock(SpellCheckService.class);
        when(checker.analyze(anyString())).thenThrow(new IllegalStateException("AI unavailable"));
        var service = new WritingService(students, writings, errors, checker, new ObjectMapper(), mock(QuestionAttemptRepository.class));
        var mvc = MockMvcBuilders.standaloneSetup(new WritingController(service)).setControllerAdvice(new ApiExceptionHandler()).build();
        var expressions = new java.util.ArrayList<>(java.util.List.of("ㅅㄲ", "ㄱㅅㄲ", "ㅈㅅㄲ", "ㅋㅋㅅㄲ", "ㄱㄴㄷㅅㄲ", "ㅅㄲ야", "ㅅㄲ네", "ㅅㅂ", "ㅂㅅ", "ㅈ같네", "좆같네", "게병신", "병신아", "좆 같은", "ㄱㄴㄷ시발", "ㅎ새끼", "ㅋㅋ씹새"));
        for (String prefix : consonantPrefixes()) expressions.add(prefix + "병신");
        for (String expression : expressions) {
          for (String text : new String[]{expression, "오늘 " + expression + " 그리고 집에 갔다.", "오늘 " + expression}) {
            mvc.perform(post("/api/students/" + UUID.randomUUID() + "/writings")
                .principal((Principal) () -> "owner").contentType("application/json")
                .content(new ObjectMapper().writeValueAsString(java.util.Map.of("text", text))))
            .andExpect(status().isUnprocessableEntity())
            .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("바른 언어를 사용해 주세요.")));
          }
        }
        verifyNoInteractions(checker, writings, errors);
    }
}
