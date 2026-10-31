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
    private WritingService creationService(SpellCheckService checker) {
        var repository=mock(WritingEntryRepository.class);
        when(repository.save(any(WritingEntry.class))).thenAnswer(call->call.getArgument(0));
        return new WritingService(mock(StudentService.class),repository,mock(WritingErrorRepository.class),checker,new ObjectMapper(),mock(QuestionAttemptRepository.class));
    }

    private SpellCheckService.DetectedError candidate(String original,String correct,int start,int end,String category) {
        return new SpellCheckService.DetectedError(original,correct,start,end,category,"설명","힌트1","힌트2",List.of());
    }

    @Test void identicalAiCorrectionDoesNotCreateReview() {
        String text="시험이 빨리 끝났으면 좋겠다";
        SpellCheckService checker=ignored->new SpellCheckService.AnalysisResult(List.of(candidate("빨리","빨리",4,6,"OTHER")),"gemini");
        assertTrue(creationService(checker).create(UUID.randomUUID(),"owner",text).errors().isEmpty());
        assertThrows(IllegalArgumentException.class,()->new WritingError(4,6,"빨리","빨리","OTHER","설명","힌트1","힌트2","[]"));
    }

    @Test void rejectsInvalidAiCandidatesButKeepsAndClassifiesRealSpacing() {
        String text="집에와서 빨리 빨리";
        var valid=candidate("집에와서","집에 와서",0,4,"OTHER");
        var invalid=List.of(
            candidate("없는말","교정",5,7,"OTHER"),
            candidate("빨리","어서",-1,1,"OTHER"), // ambiguous location cannot be repaired safely
            candidate("빨리","",5,7,"OTHER"),
            candidate("빨리"," 빨리 ",5,7,"OTHER"),
            candidate("빨리","빨리.",5,7,"OTHER"),
            candidate("빨리","어서",5,7,"SPACING"), // word replacement is not a spacing correction
            valid,valid);
        SpellCheckService checker=ignored->new SpellCheckService.AnalysisResult(invalid,"gemini");
        var result=creationService(checker).create(UUID.randomUUID(),"owner",text);
        assertEquals(1,result.errors().size());
        assertEquals("SPACING",result.errors().getFirst().category());
        assertEquals("집에 와서",result.errors().getFirst().correct());
    }

    @Test void repairsOnlyUnambiguousAiSourceLocation() {
        SpellCheckService checker=ignored->new SpellCheckService.AnalysisResult(List.of(candidate("가치","같이",99,101,"PRONUNCIATION_SPELLING")),"gemini");
        var result=creationService(checker).create(UUID.randomUUID(),"owner","친구랑 가치 놀았다.");
        assertEquals(4,result.errors().getFirst().startIndex());
    }

    @Test void canonicalHangulRepresentationIsNotAReviewQuestion() {
        assertFalse(WritingCandidateValidator.hasCorrection("빨리",java.text.Normalizer.normalize("빨리",java.text.Normalizer.Form.NFD)));
        assertTrue(WritingCandidateValidator.hasCorrection("집에와서","집에 와서"));
    }

    @Test void reviewAttemptsPreserveHintsAndCannotUndoOrRepeatCompletedReview() {
        var error=reviewError("owner");
        error.nextHint();
        assertFalse(error.submit("되요"));
        assertEquals(1,error.getAttemptCount());
        assertTrue(error.submit("돼요"));
        assertEquals(2,error.getAttemptCount());
        assertTrue(error.submit("되요"));
        assertEquals(2,error.getAttemptCount());
        assertEquals(1,error.getHintLevelUsed());
    }
    @Test void completesOwnedReviewWithoutChangingAttemptsAndIsIdempotent() {
        var errors=mock(WritingErrorRepository.class);
        var error=reviewError("owner");
        var id=UUID.randomUUID();
        when(errors.findById(id)).thenReturn(java.util.Optional.of(error));
        var service=reviewService(errors);
        service.completeReview(id,"owner");
        service.completeReview(id,"owner");
        assertTrue(error.isSolved());
        assertEquals(0,error.getAttemptCount());
        assertEquals(0,error.getHintLevelUsed());
    }

    @Test void rejectsAnotherOwnersReviewWithoutChangingIt() {
        var errors=mock(WritingErrorRepository.class);
        var error=reviewError("owner");
        var id=UUID.randomUUID();
        when(errors.findById(id)).thenReturn(java.util.Optional.of(error));
        var exception=assertThrows(org.springframework.web.server.ResponseStatusException.class,
            ()->reviewService(errors).completeReview(id,"other"));
        assertEquals(404,exception.getStatusCode().value());
        assertFalse(error.isSolved());
    }

    @Test void missingReviewReturnsNotFound() {
        var exception=assertThrows(org.springframework.web.server.ResponseStatusException.class,
            ()->reviewService(mock(WritingErrorRepository.class)).completeReview(UUID.randomUUID(),"owner"));
        assertEquals(404,exception.getStatusCode().value());
    }

    @Test void listingChecksStudentOwnershipBeforeReadingWritings() {
        var students=mock(StudentService.class);
        var writings=mock(WritingEntryRepository.class);
        var id=UUID.randomUUID();
        when(students.requireOwned(id,"other")).thenThrow(new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.NOT_FOUND));
        var service=new WritingService(students,writings,mock(WritingErrorRepository.class),mock(SpellCheckService.class),new ObjectMapper(),mock(QuestionAttemptRepository.class));
        assertThrows(org.springframework.web.server.ResponseStatusException.class,()->service.list(id,"other"));
        verifyNoInteractions(writings);
    }

    private WritingService reviewService(WritingErrorRepository errors) {
        return new WritingService(mock(StudentService.class),mock(WritingEntryRepository.class),errors,mock(SpellCheckService.class),new ObjectMapper(),mock(QuestionAttemptRepository.class));
    }

    private WritingError reviewError(String username) {
        var parent=new kr.co.hanguldetective.auth.ParentAccount(username,"unused");
        var student=new kr.co.hanguldetective.student.StudentProfile(parent,"student",1,null);
        var writing=new WritingEntry(student,"되요");
        var error=new WritingError(0,2,"되요","돼요","DOE_DWAE","설명","힌트1","힌트2","[]");
        writing.addError(error);
        return error;
    }

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
