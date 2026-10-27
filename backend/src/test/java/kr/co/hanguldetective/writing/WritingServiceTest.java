package kr.co.hanguldetective.writing;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.UUID;
import kr.co.hanguldetective.learning.QuestionAttemptRepository;
import kr.co.hanguldetective.student.StudentService;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.any;

class WritingServiceTest {
    @Test void keepsValidAiErrorsEvenWhenResponseIsOutOfOrder() {
        var repository=mock(WritingEntryRepository.class);
        when(repository.save(any(WritingEntry.class))).thenAnswer(call->call.getArgument(0));
        var checker=mock(SpellCheckService.class);
        var later=new SpellCheckService.DetectedError("되요","돼요",3,5,"DOE_DWAE","설명","힌트1","힌트2",List.of("되요","돼요"));
        var first=new SpellCheckService.DetectedError("됬","됐",0,1,"DOE_DWAE","설명","힌트1","힌트2",List.of("됬","됐"));
        when(checker.analyze("됬어 되요")).thenReturn(new SpellCheckService.AnalysisResult(List.of(later,first),"gemini"));
        var service=new WritingService(mock(StudentService.class),repository,mock(WritingErrorRepository.class),checker,new ObjectMapper(),mock(QuestionAttemptRepository.class));
        var result=service.create(UUID.randomUUID(),"owner","됬어 되요");
        assertEquals(2,result.errors().size());
        assertEquals(0,result.errors().get(0).startIndex());
        assertEquals(3,result.errors().get(1).startIndex());
    }
}
