package kr.co.hanguldetective.learning;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LearningChapterRepository extends JpaRepository<LearningChapter, UUID> {
    List<LearningChapter> findAllByStudentIdOrderByChapterNumberDescCreatedAtDesc(UUID studentId);

    @EntityGraph(attributePaths = "questions")
    List<LearningChapter> findHistoryByStudentIdOrderByChapterNumberDescCreatedAtDesc(UUID studentId);
}
