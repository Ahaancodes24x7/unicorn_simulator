export function money(n: number, opts: { compact?: boolean; cents?: boolean } = {}): string {
  const compact = opts.compact ?? Math.abs(n) >= 100_000;
  const sign = n < 0 ? "-" : "";
  const v = Math.abs(n);
  if (compact) {
    if (v >= 1e9) return `${sign}$${(v / 1e9).toFixed(v >= 1e10 ? 1 : 2)}B`;
    if (v >= 1e6) return `${sign}$${(v / 1e6).toFixed(v >= 1e7 ? 1 : 2)}M`;
    if (v >= 1e3) return `${sign}$${(v / 1e3).toFixed(v >= 1e4 ? 0 : 1)}k`;
  }
  return `${sign}$${v.toLocaleString("en-US", { maximumFractionDigits: opts.cents ? 2 : 0 })}`;
}

export const num = (n: number) => (Math.abs(n) >= 10_000 ? `${(n / 1000).toFixed(n >= 100_000 ? 0 : 1)}k` : Math.round(n).toLocaleString("en-US"));
export const pct = (n: number, digits = 0) => `${(n * 100).toFixed(digits)}%`;
export const ratio = (n: number) => (n > 0 ? `${n.toFixed(1)}×` : "–");
export const runway = (n: number) => (n >= 99 ? "Profitable" : `${n.toFixed(1)} turns`);
export const signed = (n: number, f: (v: number) => string = (v) => String(Math.round(v))) => (n > 0 ? `+${f(n)}` : n < 0 ? `−${f(-n)}` : f(0));
