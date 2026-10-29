// Normaliza códigos no estándar a ISO 4217 válidos.
const normalizeCurrency = (c?: string | null): string => {
  if (!c) return "USD";
  const up = c.trim().toUpperCase();
  const map: Record<string, string> = {
    RD: "DOP", "RD$": "DOP", DOP: "DOP",
    US: "USD", "US$": "USD", "$": "USD",
    EU: "EUR", "€": "EUR",
  };
  if (map[up]) return map[up];
  return /^[A-Z]{3}$/.test(up) ? up : "USD";
};

export const formatCurrency = (value: number | string | null | undefined, currency: string | null | undefined = "USD") => {
  const n = typeof value === "string" ? parseFloat(value) : value ?? 0;
  const cur = normalizeCurrency(currency);
  try {
    return new Intl.NumberFormat("es-ES", { style: "currency", currency: cur, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);
  } catch {
    return `${cur} ${(n || 0).toFixed(2)}`;
  }
};

export const formatNumber = (value: number | string | null | undefined, decimals = 2) => {
  const n = typeof value === "string" ? parseFloat(value) : value ?? 0;
  return new Intl.NumberFormat("es-ES", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(n || 0);
};

/** Cantidad inteligente: sin decimales si es entero, hasta 2 si tiene fracción. */
export const formatQty = (value: number | string | null | undefined) => {
  const n = typeof value === "string" ? parseFloat(value) : value ?? 0;
  if (!isFinite(n)) return "0";
  if (Number.isInteger(n)) {
    return new Intl.NumberFormat("es-ES").format(n);
  }
  return new Intl.NumberFormat("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n);
};

export const formatDate = (value: string | Date | null | undefined) => {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short", year: "numeric" }).format(d);
};

export const formatDateTime = (value: string | Date | null | undefined) => {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(d);
};
