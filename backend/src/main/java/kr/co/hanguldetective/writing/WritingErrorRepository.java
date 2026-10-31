package kr.co.hanguldetective.writing;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.Instant;
import java.util.*;
public interface WritingErrorRepository extends JpaRepository<WritingError, UUID> {
    interface WeeklyClue {
        String getCategory();
        String getOriginal();
        String getCorrection();
    }
    @Query("select e.category as category, e.original as original, e.correct as correction from WritingError e where e.writing.student.id = :studentId and e.writing.createdAt >= :start and e.writing.createdAt < :end")
    List<WeeklyClue> findWeeklyClues(@Param("studentId") UUID studentId, @Param("start") Instant start, @Param("end") Instant end);
    List<WritingError> findAllByWritingStudentIdAndCreatedAtAfter(UUID studentId, Instant since);
    List<WritingError> findAllByWritingStudentId(UUID studentId);
}
