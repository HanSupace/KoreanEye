package kr.co.hanguldetective.learning;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.Instant;
import java.util.*;
public interface QuestionAttemptRepository extends JpaRepository<QuestionAttempt, UUID> {
    List<QuestionAttempt> findAllByStudentId(UUID studentId);
    List<QuestionAttempt> findAllByStudentIdAndCreatedAtAfter(UUID studentId, Instant since);
    long countByStudentIdAndCreatedAtAfter(UUID studentId, Instant since);
}
