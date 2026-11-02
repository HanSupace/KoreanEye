package kr.co.hanguldetective.learning;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.Instant;
import java.util.*;
public interface QuestionAttemptRepository extends JpaRepository<QuestionAttempt, UUID> {
    interface WeeklyAttempt {
        UUID getQuestionId();
        Instant getCreatedAt();
        boolean getCorrect();
        String getCategory();
    }
    @Query("select a.question.id as questionId, a.createdAt as createdAt, a.correct as correct, a.question.category as category from QuestionAttempt a where a.student.id = :studentId and a.createdAt >= :start and a.createdAt < :end")
    List<WeeklyAttempt> findWeeklyActivity(@Param("studentId") UUID studentId, @Param("start") Instant start, @Param("end") Instant end);
    List<QuestionAttempt> findAllByStudentId(UUID studentId);
    List<QuestionAttempt> findAllByStudentIdAndCreatedAtAfter(UUID studentId, Instant since);
    long countByStudentIdAndCreatedAtAfter(UUID studentId, Instant since);
}
