// Deterministic, seedable RNG so every roll can be re-derived from its logged seed.

function hashString(str: string): number {
  // cyrb53-style 32-bit mix
  let h1 = 0xdeadbeef ^ str.length;
  let h2 = 0x41c6ce57 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  return h1 >>> 0;
}

export type Rng = () => number;

export function createRng(seed: string): Rng {
  let a = hashString(seed);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pickWeighted<T extends { weight: number }>(items: T[], rng: Rng): T | undefined {
  const total = items.reduce((s, i) => s + Math.max(0, i.weight), 0);
  if (total <= 0) return undefined;
  let r = rng() * total;
  for (const item of items) {
    r -= Math.max(0, item.weight);
    if (r < 0) return item;
  }
  return items[items.length - 1];
}
