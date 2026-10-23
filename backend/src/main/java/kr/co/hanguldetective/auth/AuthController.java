package kr.co.hanguldetective.auth;

import jakarta.validation.Valid;
import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController @RequestMapping("/api/auth")
public class AuthController {
    private final ParentAccountRepository accounts; private final PasswordEncoder passwords; private final JwtEncoder encoder; private final int expirationHours;
    public AuthController(ParentAccountRepository accounts, PasswordEncoder passwords, JwtEncoder encoder, @Value("${app.jwt-expiration-hours}") int expirationHours) { this.accounts=accounts;this.passwords=passwords;this.encoder=encoder;this.expirationHours=expirationHours; }
    public record Credentials(@JsonAlias("email") @NotBlank @Size(max=254) String username, @NotBlank String password) {}
    public record AuthResult(String token,String username,Instant expiresAt) {}
    @PostMapping("/signup") @ResponseStatus(HttpStatus.CREATED)
    public AuthResult signup(@Valid @RequestBody Credentials body) {
        String username=normalize(body.username()); if(accounts.existsByUsername(username)) throw new ResponseStatusException(HttpStatus.CONFLICT,"이미 사용 중인 아이디예요.");
        accounts.save(new ParentAccount(username,passwords.encode(body.password()))); return issue(username);
    }
    @PostMapping("/login") public AuthResult login(@Valid @RequestBody Credentials body) {
        String username=normalize(body.username()); ParentAccount account=accounts.findByUsername(username).orElseThrow(()->new ResponseStatusException(HttpStatus.UNAUTHORIZED,"아이디 또는 비밀번호를 확인해 주세요."));
        if(!passwords.matches(body.password(),account.getPasswordHash())) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,"아이디 또는 비밀번호를 확인해 주세요."); return issue(username);
    }
    private String normalize(String username) { return username.trim().toLowerCase(java.util.Locale.ROOT); }
    private AuthResult issue(String username) { Instant now=Instant.now(), expires=now.plus(expirationHours,ChronoUnit.HOURS); JwtClaimsSet claims=JwtClaimsSet.builder().subject(username).issuedAt(now).expiresAt(expires).claim("role","PARENT").claim("accountId",accounts.findByUsername(username).orElseThrow().getId().toString()).build(); JwsHeader header=JwsHeader.with(MacAlgorithm.HS256).build(); return new AuthResult(encoder.encode(JwtEncoderParameters.from(header,claims)).getTokenValue(),username,expires); }
}
