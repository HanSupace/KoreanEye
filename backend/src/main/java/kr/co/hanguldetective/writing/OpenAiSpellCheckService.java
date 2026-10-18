package kr.co.hanguldetective.writing;

import com.fasterxml.jackson.databind.*;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

@Service
public class OpenAiSpellCheckService {
    private final RestClient client; private final ObjectMapper mapper; private final String apiKey; private final String model;
    public OpenAiSpellCheckService(RestClient.Builder builder,ObjectMapper mapper,@Value("${app.ai.api-key:}") String apiKey,@Value("${app.ai.model}") String model){this.client=builder.baseUrl("https://api.openai.com/v1").build();this.mapper=mapper;this.apiKey=apiKey;this.model=model;}
    public SpellCheckService.AnalysisResult analyze(String text){
        if(apiKey.isBlank()) throw new IllegalStateException("OPENAI_API_KEY가 설정되지 않았습니다.");
        Map<String,Object> errorProperties=Map.ofEntries(
            Map.entry("original",Map.of("type","string")),Map.entry("correct",Map.of("type","string")),
            Map.entry("startIndex",Map.of("type","integer")),Map.entry("endIndex",Map.of("type","integer")),
            Map.entry("category",Map.of("type","string","enum",List.of("SPACING","FINAL_CONSONANT","DOE_DWAE","AN_ANH","PRONUNCIATION_SPELLING","PARTICLE","PUNCTUATION","CHARACTER_OMISSION","CHARACTER_CONFUSION","OTHER"))),
            Map.entry("explanation",Map.of("type","string")),Map.entry("hintLevel1",Map.of("type","string")),
            Map.entry("hintLevel2",Map.of("type","string")),Map.entry("choices",Map.of("type","array","items",Map.of("type","string")))
        );
        Map<String,Object> errorSchema=Map.of("type","object","properties",errorProperties,"required",List.of("original","correct","startIndex","endIndex","category","explanation","hintLevel1","hintLevel2","choices"),"additionalProperties",false);
        Map<String,Object> schema=Map.of("type","object","properties",Map.of("errors",Map.of("type","array","items",errorSchema)),"required",List.of("errors"),"additionalProperties",false);
        Map<String,Object> body=Map.of("model",model,"store",false,"input",List.of(
            Map.of("role","system","content","초등학교 1~3학년 학생의 한국어 글에서 실제 맞춤법과 띄어쓰기 오류만 찾아요. 문체는 교정하지 마세요. 정답을 직접 말하지 않는 단계별 힌트를 만들고, 각 original이 원문에서 정확히 일치하는 인덱스를 사용하세요. 불확실하면 오류 후보에서 제외하세요. 학생 개인정보를 추론하지 마세요."),
            Map.of("role","user","content",text)),"text",Map.of("format",Map.of("type","json_schema","name","spelling_analysis","strict",true,"schema",schema)),"max_output_tokens",1800);
        JsonNode response=client.post().uri("/responses").header("Authorization","Bearer "+apiKey).body(body).retrieve().body(JsonNode.class);
        if(response==null)throw new IllegalStateException("AI 응답이 비어 있습니다.");
        String output=null;for(JsonNode item:response.path("output"))for(JsonNode content:item.path("content"))if("output_text".equals(content.path("type").asText()))output=content.path("text").asText();
        if(output==null||output.isBlank())throw new IllegalStateException("구조화된 AI 응답을 찾을 수 없습니다.");
        try {JsonNode root=mapper.readTree(output);List<SpellCheckService.DetectedError> errors=new ArrayList<>();for(JsonNode e:root.path("errors")){
            List<String> choices=new ArrayList<>();e.path("choices").forEach(c->choices.add(c.asText()));
            errors.add(new SpellCheckService.DetectedError(e.path("original").asText(),e.path("correct").asText(),e.path("startIndex").asInt(),e.path("endIndex").asInt(),e.path("category").asText(),e.path("explanation").asText(),e.path("hintLevel1").asText(),e.path("hintLevel2").asText(),choices));
        }return new SpellCheckService.AnalysisResult(errors,"openai");}catch(Exception e){throw new IllegalStateException("AI 분석 JSON을 읽지 못했습니다.",e);}
    }
}
