export function order(filename: string): number {
  const match = /^(\d+)-/.exec(filename);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}
