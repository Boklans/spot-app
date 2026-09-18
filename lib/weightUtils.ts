export function normalizeWeight(value: number): number {
  return Math.round(value * 100) / 100;
}

export function addWeight(weight: number, increment: number): number {
  return normalizeWeight(Math.max(0, weight + increment));
}

export function subtractWeight(weight: number, increment: number, min = 0): number {
  return normalizeWeight(Math.max(min, weight - increment));
}

export function formatWeight(weight: number): string {
  const normalized = normalizeWeight(weight);
  return Number(normalized.toFixed(2)).toString();
}

