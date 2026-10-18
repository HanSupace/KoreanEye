package kr.co.hanguldetective.auth;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
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
    public record Credentials(@Email @NotBlank @Size(max=254) String email, @NotBlank @Size(min=8,max=72) String password) {}
    public record AuthResult(String token,String email,Instant expiresAt) {}
    @PostMapping("/signup") @ResponseStatus(HttpStatus.CREATED)
    public AuthResult signup(@Valid @RequestBody Credentials body) {
        String email=body.email().trim().toLowerCase(); if(accounts.existsByEmail(email)) throw new ResponseStatusException(HttpStatus.CONFLICT,"이미 가입된 이메일이에요.");
        accounts.save(new ParentAccount(email,passwords.encode(body.password()))); return issue(email);
    }
    @PostMapping("/login") public AuthResult login(@Valid @RequestBody Credentials body) {
        String email=body.email().trim().toLowerCase(); ParentAccount account=accounts.findByEmail(email).orElseThrow(()->new ResponseStatusException(HttpStatus.UNAUTHORIZED,"이메일 또는 비밀번호를 확인해 주세요."));
        if(!passwords.matches(body.password(),account.getPasswordHash())) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,"이메일 또는 비밀번호를 확인해 주세요."); return issue(email);
    }
    private AuthResult issue(String email) { Instant now=Instant.now(), expires=now.plus(expirationHours,ChronoUnit.HOURS); JwtClaimsSet claims=JwtClaimsSet.builder().subject(email).issuedAt(now).expiresAt(expires).claim("role","PARENT").build(); JwsHeader header=JwsHeader.with(MacAlgorithm.HS256).build(); return new AuthResult(encoder.encode(JwtEncoderParameters.from(header,claims)).getTokenValue(),email,expires); }
}
