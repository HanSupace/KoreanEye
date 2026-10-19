package kr.co.hanguldetective.learning;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface QuestionReviewRepository extends JpaRepository<QuestionReviewItem, UUID> {
    List<QuestionReviewItem> findAllByStudentIdOrderByChapterDateDescChapterNumberDescCreatedAtAsc(UUID studentId);
    Optional<QuestionReviewItem> findByStudentIdAndQuestionIdAndChapterNumber(UUID studentId, UUID questionId, int chapterNumber);
}
