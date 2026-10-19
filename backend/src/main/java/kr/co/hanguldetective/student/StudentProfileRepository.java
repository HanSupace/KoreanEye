package kr.co.hanguldetective.student;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;
public interface StudentProfileRepository extends JpaRepository<StudentProfile, UUID> {
    List<StudentProfile> findAllByParentUsernameOrderByCreatedAt(String username);
    Optional<StudentProfile> findByIdAndParentUsername(UUID id, String username);
}
