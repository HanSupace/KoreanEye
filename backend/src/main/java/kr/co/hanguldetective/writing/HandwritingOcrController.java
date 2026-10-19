package kr.co.hanguldetective.writing;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;

@RestController
public class HandwritingOcrController {
    private final String apiKey;
    private final RestClient restClient = RestClient.create();

    public HandwritingOcrController(@Value("${app.google-vision-api-key:}") String apiKey) {
        this.apiKey = apiKey;
    }

    public record RecognizeRequest(@NotBlank @Size(max = 8_000_000) String image) {}
    public record RecognizeResult(String text) {}

    @PostMapping("/api/ocr/recognize")
    public RecognizeResult recognize(@Valid @RequestBody RecognizeRequest body) {
        if (apiKey.isBlank()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "손글씨 인식 설정이 아직 준비되지 않았어요.");
        }
        try {
            byte[] bytes = Base64.getDecoder().decode(body.image());
            if (bytes.length == 0 || bytes.length > 5_000_000) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "이미지 크기는 5MB 이하여야 해요.");
            }
            JsonNode response = restClient.post()
                .uri("https://vision.googleapis.com/v1/images:annotate?key={key}", apiKey)
                .body(Map.of("requests", List.of(Map.of(
                    "image", Map.of("content", body.image()),
                    "features", List.of(Map.of("type", "DOCUMENT_TEXT_DETECTION")),
                    "imageContext", Map.of("languageHints", List.of("ko", "en"))
                ))))
                .retrieve().body(JsonNode.class);
            JsonNode first = response == null ? null : response.path("responses").path(0);
            String text = first == null ? "" : first.path("fullTextAnnotation").path("text").asText("");
            if (text.isBlank() && first != null) text = first.path("textAnnotations").path(0).path("description").asText("");
            return new RecognizeResult(text.trim());
        } catch (ResponseStatusException ex) {
            throw ex;
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "손글씨 그림을 읽을 수 없어요.");
        } catch (Exception ex) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "손글씨를 읽지 못했어요. 다시 써서 시도해 주세요.");
        }
    }
}
