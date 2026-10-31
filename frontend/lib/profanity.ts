import policy from "./profanity-policy.json";

export const profanityTitle = policy.title;
export const profanityMessage = policy.message;
const letter = "[\\p{L}\\p{N}]";
const gap = policy.separator;
// Repeat each character even when repetitions are separated by punctuation or spaces.
const spelling = (word: string) => Array.from(word.normalize("NFKC"))
  .map(char => `${char}(?:${gap}${char})*`).join(gap);
const prefix = `(?:(?:${policy.prefixes.map(spelling).join("|")})${gap})?`;
const ending = `(?:${gap}(?:${policy.suffix}|${policy.predicateSuffix}))*`;
// Consume standalone consonants inside the boundary after NFKC normalization.
const consonants = `(?:${policy.consonantPrefix}${gap})*`;
const bounded = (body: string) => new RegExp(`(?<!${letter})${consonants}${body}(?!${letter})`, "gu");
const terms = [
  ...policy.terms.map(term => bounded(`${prefix}${spelling(term)}${ending}`)),
  ...policy.initialTerms.map(term => bounded(`${prefix}${spelling(term)}${ending}`)),
  // A single initial is ambiguous: require a complete predicate continuation.
  ...policy.mixedRoots.map(root => bounded(`${prefix}${spelling(root)}${gap}${policy.predicateSuffix}${ending}`)),
];

// Only a quoted expression immediately followed by an educational explanation is exempt.
export function containsProfanity(text: string): boolean {
  const normalized = text.normalize("NFKC").replace(new RegExp(policy.educational, "gu"), " ")
    .replace(/(?:강아지|고양이|동물|새)의?\s+새끼/g, " ");
  return terms.some(term => { term.lastIndex = 0; return term.test(normalized); });
}
