package kr.co.hanguldetective.writing;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.Instant;
import java.util.*;
public interface WritingEntryRepository extends JpaRepository<WritingEntry, UUID> {
    @Query("select w.createdAt from WritingEntry w where w.student.id = :studentId and w.createdAt >= :start and w.createdAt < :end")
    List<Instant> findWeeklyActivity(@Param("studentId") UUID studentId, @Param("start") Instant start, @Param("end") Instant end);
    List<WritingEntry> findAllByStudentIdOrderByCreatedAtDesc(UUID studentId);
    @EntityGraph(attributePaths = "errors")
    List<WritingEntry> findHistoryByStudentIdOrderByCreatedAtDesc(UUID studentId);
    List<WritingEntry> findAllByStudentIdAndCreatedAtAfter(UUID studentId, Instant since);
    @EntityGraph(attributePaths = "errors")
    List<WritingEntry> findDailyByStudentIdAndCreatedAtAfter(UUID studentId, Instant since);
}
