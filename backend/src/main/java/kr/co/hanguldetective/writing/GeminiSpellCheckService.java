package kr.co.hanguldetective.writing;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

@Service
public class GeminiSpellCheckService {
    private final RestClient client;
    private final ObjectMapper mapper;
    private final String apiKey;
    private final String model;

    public GeminiSpellCheckService(
            RestClient.Builder builder,
            ObjectMapper mapper,
            @Value("${app.ai.gemini-api-key:}") String apiKey,
            @Value("${app.ai.gemini-model}") String model) {
        this.client = builder.baseUrl("https://generativelanguage.googleapis.com/v1beta").build();
        this.mapper = mapper;
        this.apiKey = apiKey;
        this.model = model;
    }

    public SpellCheckService.AnalysisResult analyze(String text) {
        if (apiKey.isBlank()) throw new IllegalStateException("GOOGLE_GEMINI_API_KEY가 설정되지 않았습니다.");

        Map<String, Object> errorSchema = Map.of(
                "type", "object",
                "properties", Map.of(
                        "original", Map.of("type", "string"),
                        "correct", Map.of("type", "string"),
                        "startIndex", Map.of("type", "integer"),
                        "endIndex", Map.of("type", "integer"),
                        "category", Map.of("type", "string", "enum", List.of("SPACING", "FINAL_CONSONANT", "DOE_DWAE", "AN_ANH", "PRONUNCIATION_SPELLING", "PARTICLE", "PUNCTUATION", "CHARACTER_OMISSION", "CHARACTER_CONFUSION", "GRAMMAR_EXPRESSION", "OTHER")),
                        "explanation", Map.of("type", "string"),
                        "hintLevel1", Map.of("type", "string"),
                        "hintLevel2", Map.of("type", "string"),
                        "choices", Map.of("type", "array", "items", Map.of("type", "string"))),
                "required", List.of("original", "correct", "startIndex", "endIndex", "category", "explanation", "hintLevel1", "hintLevel2", "choices"));
        Map<String, Object> schema = Map.of(
                "type", "object",
                "properties", Map.of("errors", Map.of("type", "array", "items", errorSchema)),
                "required", List.of("errors"));
        String systemPrompt = "초등학교 1~3학년 학생의 한국어 글을 검사해요. 맞춤법·띄어쓰기 오류는 해당 단어나 구절만 original로 잡고 표준 표기로 고쳐요. 맞춤법은 맞아도 문장 구조, 어순, 조사 사용, 호응 때문에 매우 어색하거나 뜻이 통하기 어려운 경우에는 category를 GRAMMAR_EXPRESSION으로 하고 어색한 문장 전체를 original로, 자연스러운 대체 문장 전체를 correct로 제안해요. 문체 취향이나 단순한 문장 다듬기는 지적하지 마세요. explanation에는 무엇이 어색한지와 왜 대체 표현이 자연스러운지 어린이가 이해할 설명을 써요. 맞춤법과 문법 문제가 함께 있으면 두 후보를 모두 반환하세요. 이 경우 문법 후보는 문장 전체, 맞춤법 후보는 틀린 단어만 가리켜 서로 구간이 겹쳐도 괜찮아요. 문장 전체의 뜻과 자연스러움을 보고, 실제로 드물게 쓰이는 낱말이라도 문맥에 맞지 않으면 아이가 쓰려던 흔한 낱말을 후보로 제안하세요. correct와 choices에는 표준어 또는 자연스러운 표준 문장만 사용하세요. 확신할 수 없으면 오류 후보를 제외하세요. 정답을 직접 말하지 않는 단계별 힌트를 만들고, 각 original이 원문에서 정확히 일치하는 인덱스를 사용하세요. 학생 개인정보를 추론하지 마세요. 반드시 지정된 JSON 형식으로만 응답하세요.";
        Map<String, Object> body = Map.of(
                "systemInstruction", Map.of("parts", List.of(Map.of("text", systemPrompt))),
                "contents", List.of(Map.of("role", "user", "parts", List.of(Map.of("text", text)))),
                "generationConfig", Map.of(
                        "responseMimeType", "application/json",
                        "responseSchema", schema,
                        "maxOutputTokens", 1800));

        JsonNode response = client.post()
                .uri("/models/{model}:generateContent", model)
                .header("x-goog-api-key", apiKey)
                .body(body)
                .retrieve()
                .body(JsonNode.class);
        if (response == null) throw new IllegalStateException("Gemini 응답이 비어 있습니다.");

        String output = response.path("candidates").path(0).path("content").path("parts").path(0).path("text").asText();
        if (output.isBlank()) throw new IllegalStateException("Gemini 응답에 분석 결과가 없습니다.");
        try {
            JsonNode root = mapper.readTree(output);
            List<SpellCheckService.DetectedError> errors = new ArrayList<>();
            for (JsonNode error : root.path("errors")) {
                List<String> choices = new ArrayList<>();
                error.path("choices").forEach(choice -> choices.add(choice.asText()));
                errors.add(new SpellCheckService.DetectedError(
                        error.path("original").asText(), error.path("correct").asText(),
                        error.path("startIndex").asInt(), error.path("endIndex").asInt(),
                        error.path("category").asText(), error.path("explanation").asText(),
                        error.path("hintLevel1").asText(), error.path("hintLevel2").asText(), choices));
            }
            return new SpellCheckService.AnalysisResult(errors, "gemini");
        } catch (Exception ex) {
            throw new IllegalStateException("Gemini 분석 JSON을 읽지 못했습니다.", ex);
        }
    }
}
