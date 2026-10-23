package kr.co.hanguldetective.auth;

import jakarta.persistence.EntityManager;
import java.time.LocalDate;
import kr.co.hanguldetective.learning.*;
import kr.co.hanguldetective.student.*;
import kr.co.hanguldetective.writing.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.web.server.ResponseStatusException;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@DataJpaTest(properties = "spring.config.import=")
@Import({AccountController.class, StudentService.class})
class AccountControllerTest {
    @Autowired EntityManager entities;
    @Autowired ParentAccountRepository accounts;
    @Autowired AccountController controller;
    @Autowired StudentService students;
    @MockitoBean PasswordEncoder passwords;

    private ParentAccount account(String name) {
        return accounts.saveAndFlush(new ParentAccount(name, "hash"));
    }

    @Test void wrongPasswordPreservesAccount() {
        account("owner");
        assertThrows(ResponseStatusException.class, () -> controller.delete(() -> "owner", new AccountController.DeleteAccount("wrong")));
        assertTrue(accounts.existsByUsername("owner"));
    }

    @Test void deletionRemovesAllDependentRecordsAndPreservesOtherAccountsAndSharedQuestions() {
        var owner = account("owner");
        account("other");
        var question = new LearningQuestion("test", "SPACING", 1, "CHOICE", "문제", "[]", "답", "설명");
        entities.persist(question);
        for (String name : new String[]{"first", "second"}) {
            var student = new StudentProfile(owner, name, 1, null);
            entities.persist(student);
            entities.persist(new QuestionAttempt(student, question, "답", true));
            entities.persist(new QuestionReviewItem(student, question, LocalDate.now(), 1));
            var chapter = new LearningChapter(student, LocalDate.now(), 1);
            chapter.addQuestion(question);
            entities.persist(chapter);
            var writing = new WritingEntry(student, "글쓰기");
            writing.addError(new WritingError(0, 1, "글", "굴", "OTHER", "설명", "힌트", "힌트", "[]"));
            entities.persist(writing);
        }
        var otherStudent = new StudentProfile(accounts.findByUsername("other").orElseThrow(), "other", 1, null);
        entities.persist(otherStudent);
        entities.persist(new QuestionAttempt(otherStudent, question, "답", true));
        entities.flush();
        when(passwords.matches("correct", "hash")).thenReturn(true);
        controller.delete(() -> "owner", new AccountController.DeleteAccount("correct"));
        entities.clear();
        assertFalse(accounts.existsByUsername("owner"));
        assertTrue(accounts.existsByUsername("other"));
        assertEquals(1L, entities.createQuery("select count(s) from StudentProfile s", Long.class).getSingleResult());
        assertEquals(1L, entities.createQuery("select count(a) from QuestionAttempt a", Long.class).getSingleResult());
        assertEquals(1L, entities.createQuery("select count(q) from LearningQuestion q", Long.class).getSingleResult());
        for (String entity : new String[]{"WritingError", "WritingEntry", "QuestionReviewItem", "LearningChapterQuestion", "LearningChapter"}) {
            assertEquals(0L, entities.createQuery("select count(e) from " + entity + " e", Long.class).getSingleResult());
        }
    }

    @Test void profileUpdateRequiresOwnershipAndPersistsChanges() {
        var owner = account("owner");
        var profile = new StudentProfile(owner, "before", 1, null);
        entities.persist(profile); entities.flush();
        assertThrows(ResponseStatusException.class, () -> students.update(profile.getId(), "other", "after", 2, "별명"));
        students.update(profile.getId(), "owner", "after", 2, "별명");
        entities.flush(); entities.clear();
        var updated = entities.find(StudentProfile.class, profile.getId());
        assertEquals("after", updated.getName());
        assertEquals(2, updated.getGrade());
        assertEquals("별명", updated.getNickname());
    }
}
