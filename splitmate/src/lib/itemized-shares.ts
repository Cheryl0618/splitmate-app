import { splitByWeights } from "./settlement";

export interface ItemizedShareItem {
  priceCents: number;
  memberIds: string[];
}

export interface ItemizedShareResult {
  shares: Record<string, number>;
  itemSubtotals: Record<string, number>;
  taxShares: Record<string, number>;
  tipShares: Record<string, number>;
  recognizedTotalCents: number;
}

function addShares(target: Record<string, number>, addition: Record<string, number>) {
  for (const [memberId, amountCents] of Object.entries(addition)) {
    target[memberId] = (target[memberId] ?? 0) + amountCents;
  }
}

function allocateByWeights(
  totalCents: number,
  memberIds: string[],
  weights: number[]
) {
  if (totalCents === 0) {
    return Object.fromEntries(memberIds.map((memberId) => [memberId, 0]));
  }
  if (memberIds.length === 0) {
    throw new Error("at least one item participant is required");
  }
  const amounts = splitByWeights(
    totalCents,
    weights.some((weight) => weight > 0) ? weights : memberIds.map(() => 1)
  );
  return Object.fromEntries(
    memberIds.map((memberId, index) => [memberId, amounts[index]])
  );
}

export function calculateItemizedShares(
  totalCents: number,
  taxCents: number,
  tipCents: number,
  items: ItemizedShareItem[]
): ItemizedShareResult {
  for (const amount of [totalCents, taxCents, tipCents]) {
    if (!Number.isInteger(amount) || amount < 0) {
      throw new Error("itemized amounts must be non-negative integer cents");
    }
  }

  const itemSubtotals: Record<string, number> = {};
  for (const item of items) {
    if (!Number.isInteger(item.priceCents) || item.priceCents < 0) {
      throw new Error("item prices must be non-negative integer cents");
    }
    const memberIds = [...new Set(item.memberIds)];
    if (memberIds.length === 0 || memberIds.some((memberId) => !memberId)) {
      throw new Error("each item must have at least one participant");
    }
    addShares(
      itemSubtotals,
      allocateByWeights(item.priceCents, memberIds, memberIds.map(() => 1))
    );
  }

  const memberIds = Object.keys(itemSubtotals);
  const subtotalWeights = memberIds.map((memberId) => itemSubtotals[memberId]);
  const taxShares = allocateByWeights(taxCents, memberIds, subtotalWeights);
  const tipShares = allocateByWeights(tipCents, memberIds, subtotalWeights);
  const recognizedShares = { ...itemSubtotals };
  addShares(recognizedShares, taxShares);
  addShares(recognizedShares, tipShares);

  const recognizedTotalCents = Object.values(recognizedShares).reduce(
    (sum, amountCents) => sum + amountCents,
    0
  );
  const shares =
    recognizedTotalCents === totalCents
      ? recognizedShares
      : allocateByWeights(
          totalCents,
          memberIds,
          memberIds.map((memberId) => recognizedShares[memberId])
        );

  return { shares, itemSubtotals, taxShares, tipShares, recognizedTotalCents };
}
