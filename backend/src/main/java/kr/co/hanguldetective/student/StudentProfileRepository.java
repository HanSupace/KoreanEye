package kr.co.hanguldetective.student;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;
public interface StudentProfileRepository extends JpaRepository<StudentProfile, UUID> {
    List<StudentProfile> findAllByParentEmailOrderByCreatedAt(String email);
    Optional<StudentProfile> findByIdAndParentEmail(UUID id, String email);
}
