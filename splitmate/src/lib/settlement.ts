/**
 * 最优结算引擎
 *
 * 所有金额一律用「分」(整数) 表示。永远不要用 float 存钱。
 */

export type Cents = number;

export interface Expense {
  id: string;
  amountCents: Cents;
  paidBy: string;
  /** 每个人应承担的份额，必须加起来等于 amountCents */
  shares: Record<string, Cents>;
  settled?: boolean;
}

export interface Transfer {
  from: string;
  to: string;
  amountCents: Cents;
}

/* ------------------------------------------------------------------ */
/* 1. 分摊：把总额按权重拆成整数分，余数用最大余数法分配                 */
/* ------------------------------------------------------------------ */

/**
 * 100 分三个人 → [34, 33, 33]，而不是 [33.33, 33.33, 33.33]。
 * 余数给小数部分最大的人，保证 sum(result) === total 恒成立。
 */
export function splitByWeights(total: Cents, weights: number[]): Cents[] {
  const weightSum = weights.reduce((a, b) => a + b, 0);
  if (weightSum <= 0) throw new Error("weights must sum to a positive number");

  const exact = weights.map((w) => (total * w) / weightSum);
  const floored = exact.map(Math.floor);
  let remainder = total - floored.reduce((a, b) => a + b, 0);

  const byFraction = exact
    .map((v, i) => ({ frac: v - Math.floor(v), i }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);

  for (let k = 0; k < remainder; k++) floored[byFraction[k].i]++;
  return floored;
}

export const splitEqually = (total: Cents, n: number): Cents[] =>
  splitByWeights(total, new Array(n).fill(1));

/* ------------------------------------------------------------------ */
/* 2. 净额化：环在这一步就消失了                                        */
/* ------------------------------------------------------------------ */

export function computeNetBalances(expenses: Expense[]): Map<string, Cents> {
  const net = new Map<string, Cents>();
  const add = (user: string, delta: Cents) =>
    net.set(user, (net.get(user) ?? 0) + delta);

  for (const e of expenses) {
    if (e.settled) continue;

    const shareTotal = Object.values(e.shares).reduce((a, b) => a + b, 0);
    if (shareTotal !== e.amountCents) {
      throw new Error(
        `expense ${e.id}: shares sum to ${shareTotal}, expected ${e.amountCents}`
      );
    }

    add(e.paidBy, e.amountCents);
    for (const [user, share] of Object.entries(e.shares)) add(user, -share);
  }

  for (const [user, v] of net) if (v === 0) net.delete(user);
  return net;
}

/* ------------------------------------------------------------------ */
/* 3. 贪心结算：最大债务人对最大债权人，最多 n-1 笔                      */
/* ------------------------------------------------------------------ */

export function greedySettle(balances: Map<string, Cents>): Transfer[] {
  const debtors = [...balances].filter(([, v]) => v < 0).map(([u, v]) => ({ u, v: -v }));
  const creditors = [...balances].filter(([, v]) => v > 0).map(([u, v]) => ({ u, v }));

  debtors.sort((a, b) => b.v - a.v);
  creditors.sort((a, b) => b.v - a.v);

  const transfers: Transfer[] = [];
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(debtors[i].v, creditors[j].v);
    transfers.push({ from: debtors[i].u, to: creditors[j].u, amountCents: amount });

    debtors[i].v -= amount;
    creditors[j].v -= amount;
    if (debtors[i].v === 0) i++;
    if (creditors[j].v === 0) j++;
  }

  return transfers;
}

/* ------------------------------------------------------------------ */
/* 4. 精确解：先把人拆成最多的「和为零子集」，再在子集内贪心              */
/* ------------------------------------------------------------------ */

const EXACT_LIMIT = 15;

/**
 * 一组 k 个人若无法再拆成更小的零和子集，则恰好需要 k-1 笔。
 * 所以最少笔数 = n - (最多能拆出的零和子集数)。
 */
function partitionIntoZeroSumGroups(values: Cents[]): number[][] {
  const n = values.length;
  const full = 1 << n;

  const sum = new Int32Array(full);
  for (let mask = 1; mask < full; mask++) {
    const low = mask & -mask;
    const i = 31 - Math.clz32(low);
    sum[mask] = sum[mask ^ low] + values[i];
  }

  const best = new Int32Array(full).fill(-1);
  const pick = new Int32Array(full);
  best[0] = 0;

  for (let mask = 1; mask < full; mask++) {
    if (sum[mask] !== 0) continue;
    const low = mask & -mask;

    for (let sub = mask; sub > 0; sub = (sub - 1) & mask) {
      if (!(sub & low)) continue;
      if (sum[sub] !== 0) continue;
      const rest = mask ^ sub;
      if (best[rest] < 0) continue;
      if (best[rest] + 1 > best[mask]) {
        best[mask] = best[rest] + 1;
        pick[mask] = sub;
      }
    }
  }

  const groups: number[][] = [];
  let mask = full - 1;
  while (mask > 0) {
    const sub = pick[mask];
    const members: number[] = [];
    for (let i = 0; i < n; i++) if (sub & (1 << i)) members.push(i);
    groups.push(members);
    mask ^= sub;
  }
  return groups;
}

export function optimalSettle(balances: Map<string, Cents>): Transfer[] {
  const entries = [...balances].filter(([, v]) => v !== 0);
  if (entries.length === 0) return [];

  const total = entries.reduce((a, [, v]) => a + v, 0);
  if (total !== 0) throw new Error(`balances do not sum to zero (off by ${total})`);

  if (entries.length > EXACT_LIMIT) return greedySettle(balances);

  const values = entries.map(([, v]) => v);
  const groups = partitionIntoZeroSumGroups(values);

  return groups.flatMap((members) => {
    const sub = new Map<string, Cents>();
    for (const i of members) sub.set(entries[i][0], entries[i][1]);
    return greedySettle(sub);
  });
}

/* ------------------------------------------------------------------ */
/* 5. 解释链：告诉用户「为什么是我付给这个人」                           */
/* ------------------------------------------------------------------ */

export function settle(expenses: Expense[]) {
  const balances = computeNetBalances(expenses);
  const optimal = optimalSettle(balances);
  const direct = greedySettle(balances);

  return {
    balances,
    transfers: optimal,
    /** 未简化的笔数，用来在 UI 上展示「省了几笔」 */
    naiveCount: direct.length,
    savedCount: Math.max(0, direct.length - optimal.length),
  };
}
