const PLACEHOLDER_PATTERNS = [
  /^(?:none|null|undefined|unknown|tbd)$/i,
  /^n\/?a$/i,
  /^not\s+(?:provided|specified|available)$/i,
  /^(?:company|role|date|dates)\s+not\s+specified$/i,
];

const YEAR_PLACEHOLDER_PATTERN = /^y{4}(?:\s*[-/]\s*(?:y{4}|present))?$/i;

function normalizeOptionalText(value) {
  if (value === undefined || value === null) return '';

  const text = String(value).trim();
  if (!text) return '';

  const normalized = text.replace(/\s+/g, ' ');

  if (YEAR_PLACEHOLDER_PATTERN.test(normalized)) {
    return '';
  }

  if (PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return '';
  }

  return text;
}

function normalizeTextLines(text = '') {
  return String(text)
    .split(/\n+/)
    .map((line) => line.replace(/^[•\-\u2022]+\s*/, '').trim())
    .map(normalizeOptionalText)
    .filter(Boolean);
}

module.exports = {
  normalizeOptionalText,
  normalizeTextLines,
};
