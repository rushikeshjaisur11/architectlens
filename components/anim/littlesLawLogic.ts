export type QueueStats =
  | { stable: false; rho: number }
  | { stable: true; rho: number; waitProb: number; wq: number; w: number; l: number; lq: number };

/** M/M/c via Erlang C. lambda, mu in req/s (mu per server). w = mean time in system (s). */
export function mmc(lambda: number, mu: number, c: number): QueueStats {
  const a = lambda / mu;
  const rho = a / c;
  if (rho >= 1) return { stable: false, rho };
  let term = 1; // a^k / k!
  let sum = 0;
  for (let k = 0; k < c; k++) {
    sum += term;
    term *= a / (k + 1);
  }
  const top = term / (1 - rho); // a^c / c! / (1 - rho)
  const waitProb = top / (sum + top);
  const wq = waitProb / (c * mu - lambda);
  const w = wq + 1 / mu;
  return { stable: true, rho, waitProb, wq, w, l: lambda * w, lq: lambda * wq };
}

/** Mean time in system as a multiple of bare service time, at a target utilisation. */
export function latencyMultiplier(rho: number, mu: number, c: number): number {
  const s = mmc(rho * c * mu, mu, c);
  return s.stable ? s.w * mu : Infinity;
}
