package kr.co.hanguldetective.writing;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.Instant;
import java.util.*;
public interface WritingErrorRepository extends JpaRepository<WritingError, UUID> {
    List<WritingError> findAllByWritingStudentIdAndCreatedAtAfter(UUID studentId, Instant since);
    List<WritingError> findAllByWritingStudentId(UUID studentId);
}
