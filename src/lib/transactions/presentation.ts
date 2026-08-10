const PROVIDER_CATEGORY_PREFIXES = [
  "BANK_FEES",
  "ENTERTAINMENT",
  "FOOD_AND_DRINK",
  "GENERAL_MERCHANDISE",
  "GENERAL_SERVICES",
  "GOVERNMENT_AND_NON_PROFIT",
  "HOME_IMPROVEMENT",
  "INCOME",
  "LOAN_PAYMENTS",
  "MEDICAL",
  "PERSONAL_CARE",
  "RENT_AND_UTILITIES",
  "TRANSFER_IN",
  "TRANSFER_OUT",
  "TRANSPORTATION",
  "TRAVEL",
] as const;

const LOWERCASE_WORDS = new Set([
  "and",
  "at",
  "for",
  "in",
  "of",
  "on",
  "or",
  "the",
  "to",
]);

function words(value: string, titleFirst = true) {
  return value
    .split("_")
    .filter(Boolean)
    .map((word, index) => {
      const lower = word.toLowerCase();
      if (!titleFirst && index > 0) return lower;
      if ((index > 0 || !titleFirst) && LOWERCASE_WORDS.has(lower))
        return lower;
      return `${lower.charAt(0).toUpperCase()}${lower.slice(1)}`;
    })
    .join(" ");
}

export function isProviderCategoryCode(value: string) {
  return /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/.test(value);
}

export function formatTransactionCategory(value: string | null | undefined) {
  if (!value) return "Uncategorized";
  if (!isProviderCategoryCode(value)) return value;

  const prefix = PROVIDER_CATEGORY_PREFIXES.find(
    (candidate) => value === candidate || value.startsWith(`${candidate}_`),
  );
  if (!prefix) return words(value);

  const detail = value.slice(prefix.length + 1);
  return detail ? `${words(prefix)} · ${words(detail, false)}` : words(prefix);
}
