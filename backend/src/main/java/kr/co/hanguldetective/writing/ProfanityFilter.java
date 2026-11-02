package kr.co.hanguldetective.writing;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.text.Normalizer;
import java.util.List;
import java.util.regex.Pattern;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/** Local, deterministic policy shared with the browser. Never sends writing to an AI. */
public final class ProfanityFilter {
    private static final Policy POLICY = load();
    private static final Pattern EDUCATIONAL = Pattern.compile(POLICY.educational());
    private static final Pattern ANIMAL = Pattern.compile("(?:강아지|고양이|동물|새)의?\\s+새끼");
    private static final List<Pattern> TERMS = compileTerms();

    private static String spelling(String word) {
        return Normalizer.normalize(word, Normalizer.Form.NFKC).codePoints().mapToObj(cp -> {
            String character = Pattern.quote(new String(Character.toChars(cp)));
            return character + "(?:" + POLICY.separator() + character + ")*";
        }).collect(java.util.stream.Collectors.joining(POLICY.separator()));
    }

    private static List<Pattern> compileTerms() {
        String gap = POLICY.separator();
        String prefix = "(?:(?:" + POLICY.prefixes().stream().map(ProfanityFilter::spelling)
            .collect(java.util.stream.Collectors.joining("|")) + ")" + gap + ")?";
        String ending = "(?:" + gap + "(?:" + POLICY.suffix() + "|" + POLICY.predicateSuffix() + "))*";
        String consonants = "(?:" + POLICY.consonantPrefix() + gap + ")*";
        var bodies = new java.util.ArrayList<String>();
        // Full syllables and multi-initial abbreviations allow optional endings.
        java.util.stream.Stream.concat(POLICY.terms().stream(), POLICY.initialTerms().stream())
            .forEach(term -> bodies.add(prefix + spelling(term) + ending));
        // A single initial alone is not enough evidence of profanity.
        POLICY.mixedRoots().forEach(root -> bodies.add(prefix + spelling(root) + gap + POLICY.predicateSuffix() + ending));
        return bodies.stream().map(body -> Pattern.compile("(?<![\\p{L}\\p{N}])" + consonants + body + "(?![\\p{L}\\p{N}])",
            Pattern.UNICODE_CHARACTER_CLASS)).toList();
    }

    public static boolean containsProfanity(String text) {
        String normalized = Normalizer.normalize(text, Normalizer.Form.NFKC);
        normalized = EDUCATIONAL.matcher(normalized).replaceAll(" ");
        String content = ANIMAL.matcher(normalized).replaceAll(" ");
        return TERMS.stream().anyMatch(term -> term.matcher(content).find());
    }

    public static void validate(String text) {
        if (containsProfanity(text)) throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, POLICY.title() + " " + POLICY.message());
    }

    private static Policy load() {
        try (var input = ProfanityFilter.class.getResourceAsStream("/profanity-policy.json")) {
            return new ObjectMapper().configure(com.fasterxml.jackson.databind.DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false).readValue(input, Policy.class);
        } catch (Exception e) { throw new IllegalStateException("Cannot load writing language policy", e); }
    }
    private record Policy(String title, String message, List<String> terms, List<String> initialTerms,
        List<String> mixedRoots, List<String> prefixes, String suffix, String predicateSuffix, String separator, String educational, String consonantPrefix) {}
    private ProfanityFilter() {}
}
