package kr.co.hanguldetective.writing;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import kr.co.hanguldetective.learning.QuestionAttemptRepository;
import kr.co.hanguldetective.student.StudentService;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.any;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

/** Uses a recorded-shape HTTP response, not the live Gemini API or a real API key. */
class GeminiCandidateValidationTest {
    @Test void geminiParsingPreservesNoOpAndServerRejectsItBeforePersistence() throws Exception {
        var mapper=new ObjectMapper();
        var builder=RestClient.builder();
        var server=MockRestServiceServer.bindTo(builder).build();
        var gemini=new GeminiSpellCheckService(builder,mapper,"test-only","test-model","test-fallback-model");
        var error=Map.of("original","빨리","correct","빨리","startIndex",4,"endIndex",6,"category","OTHER",
            "explanation","설명","hintLevel1","힌트1","hintLevel2","힌트2","choices",List.of("빨리"));
        var output=mapper.writeValueAsString(Map.of("errors",List.of(error)));
        var response=mapper.writeValueAsString(Map.of("candidates",List.of(Map.of("content",Map.of("parts",List.of(Map.of("text",output)))))));
        server.expect(requestTo("https://generativelanguage.googleapis.com/v1beta/models/test-model:generateContent"))
            .andRespond(withSuccess(response,MediaType.APPLICATION_JSON));
        String text="시험이 빨리 끝났으면 좋겠다";
        var parsed=gemini.analyze(text);
        assertEquals("빨리",parsed.errors().getFirst().original());
        assertEquals("빨리",parsed.errors().getFirst().correct());
        var repository=mock(WritingEntryRepository.class);
        when(repository.save(any(WritingEntry.class))).thenAnswer(call->call.getArgument(0));
        var service=new WritingService(mock(StudentService.class),repository,mock(WritingErrorRepository.class),ignored->parsed,mapper,mock(QuestionAttemptRepository.class));
        assertTrue(service.create(UUID.randomUUID(),"owner",text).errors().isEmpty());
        var saved=org.mockito.ArgumentCaptor.forClass(WritingEntry.class);
        verify(repository).save(saved.capture());
        assertTrue(saved.getValue().getErrors().isEmpty());
        server.verify();
    }
}
