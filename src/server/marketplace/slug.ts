/**
 * Slug utilities — MAS-31.
 *
 * `slugify` produces a URL-safe slug from a free-text title. Strips
 * diacritics, lowercases, collapses non-alphanumerics to dashes, and
 * trims leading/trailing dashes. Empty / all-symbol input → throws so
 * the caller can surface a 400.
 *
 * `withRandomSuffix` appends a short base32-ish suffix — used to make
 * slugs unique when the natural slug collides (e.g. two sellers naming
 * a product "Kurma Ajwa 1kg").
 */

export function slugify(input: string): string {
  const base = input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip combining marks
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (base.length === 0) {
    throw new Error("slugify: input produced empty slug");
  }
  return base.slice(0, 80);
}

const SUFFIX_ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789"; // no 0/1/l/o (ambiguous)

export function withRandomSuffix(slug: string, n = 5, rng: () => number = Math.random): string {
  let suffix = "";
  for (let i = 0; i < n; i++) {
    const idx = Math.floor(rng() * SUFFIX_ALPHABET.length) % SUFFIX_ALPHABET.length;
    suffix += SUFFIX_ALPHABET.charAt(idx);
  }
  // Trim slug so total stays ≤ 80 chars.
  const max = 80 - n - 1;
  const trimmed = slug.length > max ? slug.slice(0, max) : slug;
  return `${trimmed}-${suffix}`;
}
