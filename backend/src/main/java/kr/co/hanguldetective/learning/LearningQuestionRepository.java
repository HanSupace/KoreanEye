package kr.co.hanguldetective.learning;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;
public interface LearningQuestionRepository extends JpaRepository<LearningQuestion, UUID> {
    List<LearningQuestion> findAllByGradeInOrderByCategoryAsc(List<Integer> grades);
    Optional<LearningQuestion> findBySeedKey(String seedKey);
}
