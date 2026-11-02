package kr.co.hanguldetective.learning;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.*;
public interface LearningQuestionRepository extends JpaRepository<LearningQuestion, UUID> {
    @Query("select q from LearningQuestion q where q.grade in :grades and (q.ownerStudent is null or q.ownerStudent.id = :studentId) order by q.category asc")
    List<LearningQuestion> findAllAvailableForStudent(@Param("grades") List<Integer> grades, @Param("studentId") java.util.UUID studentId);
    Optional<LearningQuestion> findBySeedKey(String seedKey);
    Optional<LearningQuestion> findBySourceWritingErrorId(java.util.UUID sourceWritingErrorId);
}
