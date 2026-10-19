package kr.co.hanguldetective.auth;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/preferences")
public class PreferenceController {
    private final ParentAccountRepository accounts;

    public PreferenceController(ParentAccountRepository accounts) { this.accounts = accounts; }

    public record Preferences(String preferredInputMode) {}
    public record UpdatePreferences(@NotBlank String preferredInputMode) {}

    @GetMapping
    public Preferences get(@AuthenticationPrincipal Jwt jwt) {
        return accounts.findByUsername(jwt.getSubject())
            .map(account -> new Preferences(account.getPreferredInputMode()))
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
    }

    @PutMapping
    public Preferences update(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody UpdatePreferences body) {
        String mode = body.preferredInputMode().toUpperCase(java.util.Locale.ROOT);
        if (!mode.equals("TYPE") && !mode.equals("HANDWRITING")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "입력 방식을 확인해 주세요.");
        }
        var account = accounts.findByUsername(jwt.getSubject())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        account.setPreferredInputMode(mode);
        accounts.save(account);
        return new Preferences(mode);
    }
}
