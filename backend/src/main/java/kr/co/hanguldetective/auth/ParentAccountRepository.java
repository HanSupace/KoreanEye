package kr.co.hanguldetective.auth;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.UUID;
public interface ParentAccountRepository extends JpaRepository<ParentAccount, UUID> { Optional<ParentAccount> findByUsername(String username); boolean existsByUsername(String username); }
