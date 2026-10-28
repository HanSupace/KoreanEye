package kr.co.hanguldetective.writing;

import com.fasterxml.jackson.databind.*;
import java.util.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

@Service
public class OpenAiSpellCheckService {
    private static final Logger log = LoggerFactory.getLogger(OpenAiSpellCheckService.class);
    private final RestClient client; private final ObjectMapper mapper; private final String apiKey; private final String model;
    public OpenAiSpellCheckService(RestClient.Builder builder,ObjectMapper mapper,@Value("${app.ai.api-key:}") String apiKey,@Value("${app.ai.model}") String model){this.client=builder.baseUrl("https://api.openai.com/v1").build();this.mapper=mapper;this.apiKey=apiKey;this.model=model;}
    public SpellCheckService.AnalysisResult analyze(String text){
        if(apiKey.isBlank()) throw new IllegalStateException("OPENAI_API_KEY가 설정되지 않았습니다.");
        Map<String,Object> errorProperties=Map.ofEntries(
            Map.entry("original",Map.of("type","string")),Map.entry("correct",Map.of("type","string")),
            Map.entry("startIndex",Map.of("type","integer")),Map.entry("endIndex",Map.of("type","integer")),
            Map.entry("category",Map.of("type","string","enum",List.of("SPACING","FINAL_CONSONANT","DOE_DWAE","AN_ANH","PRONUNCIATION_SPELLING","PARTICLE","PUNCTUATION","CHARACTER_OMISSION","CHARACTER_CONFUSION","GRAMMAR_EXPRESSION","OTHER"))),
            Map.entry("explanation",Map.of("type","string")),Map.entry("hintLevel1",Map.of("type","string")),
            Map.entry("hintLevel2",Map.of("type","string")),Map.entry("choices",Map.of("type","array","items",Map.of("type","string")))
        );
        Map<String,Object> errorSchema=Map.of("type","object","properties",errorProperties,"required",List.of("original","correct","startIndex","endIndex","category","explanation","hintLevel1","hintLevel2","choices"),"additionalProperties",false);
        Map<String,Object> schema=Map.of("type","object","properties",Map.of("errors",Map.of("type","array","items",errorSchema)),"required",List.of("errors"),"additionalProperties",false);
        Map<String,Object> body=Map.of("model",model,"store",false,"input",List.of(
            Map.of("role","system","content","초등학교 1~3학년 학생의 한국어 글을 검사해요. 맞춤법·띄어쓰기 오류는 해당 단어나 구절만 original로 잡고 표준 표기로 고쳐요. 맞춤법은 맞아도 문장 구조, 어순, 조사 사용, 호응 때문에 매우 어색하거나 뜻이 통하기 어려운 경우에는 category를 GRAMMAR_EXPRESSION으로 하고 어색한 문장 전체를 original로, 자연스러운 대체 문장 전체를 correct로 제안해요. 문체 취향이나 단순한 문장 다듬기는 지적하지 마세요. 마침표, 쉼표, 물음표, 느낌표 등 문장부호는 검사 대상에서 제외하고, 문장부호만 바꾸는 후보를 만들지 마세요. 다른 오류를 고칠 때도 원문의 문장부호를 그대로 유지하세요. explanation에는 무엇이 어색한지와 왜 대체 표현이 자연스러운지 어린이가 이해할 설명을 써요. 맞춤법과 문법 문제가 함께 있으면 두 후보를 모두 반환하세요. 이 경우 문법 후보는 문장 전체, 맞춤법 후보는 틀린 단어만 가리켜 서로 구간이 겹쳐도 괜찮아요. 힌트 두 개는 초등학생이 실제로 문제를 풀 때 사용할 수 있도록 오류마다 구체적이고 쉬운 말로 작성하세요. hintLevel1은 먼저 살펴볼 위치나 적용할 생각 방법을 알려주고, hintLevel2는 첫 힌트보다 한 단계 더 좁혀 소리, 뜻, 낱말의 기본형 또는 문장 속 관계를 생각하게 하세요. '다시 생각해 보세요'처럼 막연한 말은 쓰지 마세요. 두 힌트 모두 정답 표현(correct), 정답의 첫 글자나 음절, 정답을 그대로 떠올리게 하는 낱말을 말하지 마세요. 예를 들어 '으려웠어'를 고치는 문제라면 '첫 글자를 어로 바꿔 보세요'나 정답 낱말의 기본형을 직접 말하지 말고, 먼저 비슷한 뜻의 기본형을 떠올리고 소리를 확인하게 한 뒤, 더 좁은 힌트에서 첫소리와 활용을 살펴보게 하세요. 문법 오류는 어느 부분의 관계나 의미를 확인할지 알려주되 수정 문장을 말하지 마세요. 이런 방식으로 유효한 힌트를 만들 수 없다면 해당 후보를 제외하세요. 각 original이 원문에서 정확히 일치하는 인덱스를 사용하세요. 불확실하면 후보에서 제외하세요. 학생 개인정보를 추론하지 마세요."),
            Map.of("role","user","content",text)),"text",Map.of("format",Map.of("type","json_schema","name","spelling_analysis","strict",true,"schema",schema)),"max_output_tokens",1800);
        JsonNode response=client.post().uri("/responses").header("Authorization","Bearer "+apiKey).body(body).retrieve().body(JsonNode.class);
        if(response==null)throw new IllegalStateException("AI 응답이 비어 있습니다.");
        String output=null;for(JsonNode item:response.path("output"))for(JsonNode content:item.path("content"))if("output_text".equals(content.path("type").asText()))output=content.path("text").asText();
        if(output==null||output.isBlank())throw new IllegalStateException("구조화된 AI 응답을 찾을 수 없습니다.");
        try {JsonNode root=mapper.readTree(output);log.info("OpenAI가 반환한 errors JSON 배열:\n{}",mapper.writerWithDefaultPrettyPrinter().writeValueAsString(root.path("errors")));List<SpellCheckService.DetectedError> errors=new ArrayList<>();for(JsonNode e:root.path("errors")){
            List<String> choices=new ArrayList<>();e.path("choices").forEach(c->choices.add(c.asText()));
            errors.add(new SpellCheckService.DetectedError(e.path("original").asText(),e.path("correct").asText(),e.path("startIndex").asInt(),e.path("endIndex").asInt(),e.path("category").asText(),e.path("explanation").asText(),e.path("hintLevel1").asText(),e.path("hintLevel2").asText(),choices));
        }return new SpellCheckService.AnalysisResult(errors,"openai");}catch(Exception e){throw new IllegalStateException("AI 분석 JSON을 읽지 못했습니다.",e);}
    }
}
