package kr.co.hanguldetective.writing;

import java.text.Normalizer;

/** Shared by analysis ingestion and new review entities; never rewrites stored records. */
final class WritingCandidateValidator {
    private WritingCandidateValidator() {}

    static boolean hasCorrection(String original, String correct) {
        if (original == null || correct == null || original.isBlank() || correct.isBlank()) return false;
        String source = normalize(original);
        String replacement = normalize(correct);
        // Ignore representation and outer padding differences, but retain internal spacing.
        return !source.equals(replacement)
            && !source.replaceAll("\\p{P}", "").equals(replacement.replaceAll("\\p{P}", ""));
    }

    static boolean spacingOnly(String original, String correct) {
        return normalize(original).replaceAll("\\s+", "").equals(normalize(correct).replaceAll("\\s+", ""));
    }

    private static String normalize(String value) {
        return Normalizer.normalize(value.strip(), Normalizer.Form.NFC);
    }
}
