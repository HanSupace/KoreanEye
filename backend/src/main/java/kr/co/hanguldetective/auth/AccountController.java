package kr.co.hanguldetective.auth;

import jakarta.persistence.EntityManager;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.security.Principal;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/account")
public class AccountController {
    private final ParentAccountRepository accounts;
    private final PasswordEncoder passwords;
    private final EntityManager entities;

    public AccountController(ParentAccountRepository accounts, PasswordEncoder passwords, EntityManager entities) {
        this.accounts = accounts; this.passwords = passwords; this.entities = entities;
    }

    public record DeleteAccount(@NotBlank String password) {}

    @DeleteMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void delete(Principal principal, @Valid @RequestBody DeleteAccount body) {
        var account = accounts.findByUsername(principal.getName())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        if (!passwords.matches(body.password(), account.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "비밀번호가 일치하지 않아요.");
        }
        // Delete dependent records first; shared learning questions remain intact.
        String students = "select s.id from StudentProfile s where s.parent.id = :accountId";
        String[] deletions = {
            "delete from WritingError e where e.writing.id in (select w.id from WritingEntry w where w.student.id in (" + students + "))",
            "delete from WritingEntry w where w.student.id in (" + students + ")",
            "delete from QuestionAttempt a where a.student.id in (" + students + ")",
            "delete from QuestionReviewItem r where r.student.id in (" + students + ")",
            "delete from LearningChapterQuestion q where q.chapter.id in (select c.id from LearningChapter c where c.student.id in (" + students + "))",
            "delete from LearningChapter c where c.student.id in (" + students + ")",
            "delete from StudentProfile s where s.parent.id = :accountId"
        };
        for (String deletion : deletions) {
            entities.createQuery(deletion).setParameter("accountId", account.getId()).executeUpdate();
        }
        accounts.delete(account);
        accounts.flush();
    }
}
