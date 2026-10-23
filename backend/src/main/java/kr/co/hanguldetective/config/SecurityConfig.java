package kr.co.hanguldetective.config;

import com.nimbusds.jose.jwk.source.ImmutableSecret;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.List;

@Configuration
public class SecurityConfig {
    @Bean SecretKey jwtKey(@Value("${app.jwt-secret}") String secret) { return new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"); }
    @Bean JwtEncoder jwtEncoder(SecretKey key) { return new NimbusJwtEncoder(new ImmutableSecret<>(key)); }
    @Bean JwtDecoder jwtDecoder(SecretKey key, kr.co.hanguldetective.auth.ParentAccountRepository accounts) {
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withSecretKey(key).macAlgorithm(MacAlgorithm.HS256).build();
        decoder.setJwtValidator(new org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator<>(
            JwtValidators.createDefault(), jwt -> {
                boolean active = accounts.findByUsername(jwt.getSubject()).map(account ->
                    jwt.getIssuedAt() != null && !account.getCreatedAt().truncatedTo(java.time.temporal.ChronoUnit.SECONDS).isAfter(jwt.getIssuedAt())
                    && (jwt.getClaimAsString("accountId") == null || account.getId().toString().equals(jwt.getClaimAsString("accountId")))
                ).orElse(false);
                return active ? org.springframework.security.oauth2.core.OAuth2TokenValidatorResult.success()
                    : org.springframework.security.oauth2.core.OAuth2TokenValidatorResult.failure(new org.springframework.security.oauth2.core.OAuth2Error("invalid_token"));
            }));
        return decoder;
    }
    @Bean PasswordEncoder passwordEncoder() {
        BCryptPasswordEncoder bcrypt = new BCryptPasswordEncoder();
        return new PasswordEncoder() {
            @Override public String encode(CharSequence rawPassword) {
                return bcrypt.encode(prehash(rawPassword));
            }
            @Override public boolean matches(CharSequence rawPassword, String encodedPassword) {
                if (bcrypt.matches(prehash(rawPassword), encodedPassword)) return true;
                // Accept hashes created by the previous direct-BCrypt encoder during migration.
                return rawPassword.toString().getBytes(StandardCharsets.UTF_8).length <= 72
                    && bcrypt.matches(rawPassword, encodedPassword);
            }
            private String prehash(CharSequence rawPassword) {
                try {
                    byte[] digest = MessageDigest.getInstance("SHA-256").digest(rawPassword.toString().getBytes(StandardCharsets.UTF_8));
                    return java.util.HexFormat.of().formatHex(digest);
                } catch (NoSuchAlgorithmException impossible) {
                    throw new IllegalStateException("SHA-256 is unavailable", impossible);
                }
            }
        };
    }
    @Bean CorsConfigurationSource corsConfigurationSource(@Value("${app.cors-origin}") String origin) {
        CorsConfiguration config = new CorsConfiguration(); config.setAllowedOrigins(List.of(origin)); config.setAllowedMethods(List.of("GET","POST","PUT","DELETE","OPTIONS")); config.setAllowedHeaders(List.of("Authorization","Content-Type"));
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource(); source.registerCorsConfiguration("/**", config); return source;
    }
    @Bean SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        return http.csrf(c -> c.disable()).cors(Customizer.withDefaults()).sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(a -> a.requestMatchers("/api/auth/**", "/api/health").permitAll().anyRequest().authenticated())
            .oauth2ResourceServer(o -> o.jwt(Customizer.withDefaults())).build();
    }
}
