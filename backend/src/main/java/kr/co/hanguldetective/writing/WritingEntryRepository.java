package kr.co.hanguldetective.writing;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.Instant;
import java.util.*;
public interface WritingEntryRepository extends JpaRepository<WritingEntry, UUID> {
    List<WritingEntry> findAllByStudentIdOrderByCreatedAtDesc(UUID studentId);
    List<WritingEntry> findAllByStudentIdAndCreatedAtAfter(UUID studentId, Instant since);
}
