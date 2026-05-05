export function toTitleText(value: string) {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .replace(/(^|[\s/.-])([\p{L}\p{N}])/gu, (_, separator: string, character: string) => `${separator}${character.toUpperCase()}`)
    .replace(/\bS\.a\b/g, "S.A")
    .replace(/\bSpa\b/g, "SpA");
}

export function normalizeProjectName(value: string) {
  const clean = toTitleText(value);
  const upper = clean.toUpperCase();
  if (upper === "LOS SAUCES" || upper === "EL SAUCE") return "El Sauce";
  return clean;
}

export function cleanLocationValue(value?: string | null, label?: "torre" | "nucleo" | "piso") {
  if (!value) return "";
  const prefixes: Record<string, RegExp> = {
    torre: /^torre\s*/i,
    nucleo: /^(n[uú]cleo|nuclo)\s*/i,
    piso: /^piso\s*/i
  };
  const withoutPrefix = label ? value.replace(prefixes[label], "") : value;
  return toTitleText(withoutPrefix);
}
