package kr.co.hanguldetective.writing;

import com.fasterxml.jackson.databind.ObjectMapper;
import kr.co.hanguldetective.auth.ParentAccount;
import kr.co.hanguldetective.learning.QuestionAttemptRepository;
import kr.co.hanguldetective.student.StudentProfile;
import kr.co.hanguldetective.student.StudentService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@DataJpaTest(properties = {"spring.jpa.hibernate.ddl-auto=create-drop", "spring.jpa.show-sql=false"})
class WritingReviewPersistenceTest {
    @Autowired TestEntityManager em;
    @Autowired WritingEntryRepository writings;
    @Autowired WritingErrorRepository errors;
    @Autowired QuestionAttemptRepository attempts;

    @Test void rulesErrorsAndCompletionSurviveReloadWithOriginalIdsAndOwner() {
        var student=em.persist(new StudentProfile(em.persist(new ParentAccount("owner","unused")),"학생",1,null));
        var students=mock(StudentService.class);
        when(students.requireOwned(student.getId(),"owner")).thenReturn(student);
        SpellCheckService checker=text->new RuleBasedSpellCheckService().analyze(text);
        var service=new WritingService(students,writings,errors,checker,new ObjectMapper(),attempts);
        var created=service.create(student.getId(),"owner","오늘 친구랑 가치 놀았다. 집에와서 밥을 먹었다.");
        assertEquals(2,created.errors().size());
        var errorId=created.errors().getFirst().id();
        em.flush(); em.clear();
        var stored=service.list(student.getId(),"owner").getFirst();
        assertEquals(created.id(),stored.id());
        assertEquals(created.text(),stored.text());
        assertEquals(created.createdAt().toEpochMilli(),stored.createdAt().toEpochMilli());
        assertEquals(errorId,stored.errors().getFirst().id());
        assertEquals("가치",stored.errors().getFirst().original());
        assertEquals("같이",stored.errors().getFirst().correct());
        assertFalse(stored.errors().getFirst().solved());
        service.completeReview(errorId,"owner");
        em.flush(); em.clear();
        assertTrue(service.list(student.getId(),"owner").getFirst().errors().stream().filter(e->e.id().equals(errorId)).findFirst().orElseThrow().solved());
        assertEquals(student.getId(),errors.findById(errorId).orElseThrow().getWriting().getStudent().getId());
    }

    @Test void emptyAnalysisIsStoredWithoutInventingErrorsAndFailureSavesNothing() {
        var student=em.persist(new StudentProfile(em.persist(new ParentAccount("owner","unused")),"학생",1,null));
        var students=mock(StudentService.class);
        when(students.requireOwned(student.getId(),"owner")).thenReturn(student);
        var checker=mock(SpellCheckService.class);
        when(checker.analyze("친구와 같이 놀았다.")).thenReturn(new RuleBasedSpellCheckService().analyze("친구와 같이 놀았다."));
        when(checker.analyze("분석 실패")).thenThrow(new IllegalStateException("mock failure"));
        var service=new WritingService(students,writings,errors,checker,new ObjectMapper(),attempts);
        var created=service.create(student.getId(),"owner","친구와 같이 놀았다.");
        em.flush(); em.clear();
        assertTrue(service.get(created.id(),"owner").errors().isEmpty());
        long before=writings.count();
        assertThrows(IllegalStateException.class,()->service.create(student.getId(),"owner","분석 실패"));
        em.flush();
        assertEquals(before,writings.count());
        assertEquals(0,errors.count());
    }
}
