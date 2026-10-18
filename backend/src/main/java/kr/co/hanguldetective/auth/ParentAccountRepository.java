package kr.co.hanguldetective.auth;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.UUID;
public interface ParentAccountRepository extends JpaRepository<ParentAccount, UUID> { Optional<ParentAccount> findByEmail(String email); boolean existsByEmail(String email); }
