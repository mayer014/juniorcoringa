export function formatDate(value: string | null, style: "short" | "long" = "long") {
  if (!value) return "Sem data";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: style === "long" ? "long" : "2-digit",
    year: "numeric",
    timeZone: "America/Campo_Grande",
  }).format(new Date(value));
}

export function readingTime(content: string) {
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 210));
}
