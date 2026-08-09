import { splitByWeights } from "./settlement";

export type SplitMethod = "equal" | "percentage" | "amount";

export interface SplitParticipant {
  memberId: string;
  percentage?: number;
  amountCents?: number;
}

function validateCommon(totalCents: number, participants: SplitParticipant[]) {
  if (!Number.isInteger(totalCents) || totalCents < 0) {
    throw new Error("totalCents must be a non-negative integer");
  }
  if (participants.length === 0) {
    throw new Error("at least one participant is required");
  }

  const memberIds = new Set(participants.map((participant) => participant.memberId));
  if (memberIds.size !== participants.length || [...memberIds].some((id) => !id)) {
    throw new Error("participant memberIds must be unique and non-empty");
  }
}

export function calculateShares(
  totalCents: number,
  method: SplitMethod,
  participants: SplitParticipant[]
): Record<string, number> {
  validateCommon(totalCents, participants);

  if (method === "amount") {
    const amounts = participants.map((participant) => participant.amountCents);
    if (
      amounts.some(
        (amountCents) =>
          amountCents === undefined ||
          !Number.isInteger(amountCents) ||
          amountCents < 0
      )
    ) {
      throw new Error("amount shares must be non-negative integer cents");
    }

    const assignedCents = (amounts as number[]).reduce(
      (total, amountCents) => total + amountCents,
      0
    );
    if (assignedCents !== totalCents) {
      throw new Error(
        `amount shares sum to ${assignedCents}, expected ${totalCents}`
      );
    }

    return Object.fromEntries(
      participants.map((participant, index) => [
        participant.memberId,
        (amounts as number[])[index],
      ])
    );
  }

  const weights =
    method === "equal"
      ? participants.map(() => 1)
      : participants.map((participant) => participant.percentage);

  if (
    weights.some(
      (weight) => weight === undefined || !Number.isFinite(weight) || weight < 0
    )
  ) {
    throw new Error("percentage shares must be non-negative numbers");
  }

  if (method === "percentage") {
    const percentageTotal = (weights as number[]).reduce(
      (total, percentage) => total + percentage,
      0
    );
    if (Math.abs(percentageTotal - 100) > 1e-9) {
      throw new Error(`percentages sum to ${percentageTotal}, expected 100`);
    }
  }

  const amounts = splitByWeights(totalCents, weights as number[]);
  return Object.fromEntries(
    participants.map((participant, index) => [participant.memberId, amounts[index]])
  );
}
