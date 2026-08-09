import { randomUUID } from "node:crypto";

import { openDatabase, openWritableDatabase } from "@/server/database";
import { getSettlementPageData } from "@/server/settlements";

export class SettlementMutationError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

interface SettlementInput {
  fromMemberId: string;
  toMemberId: string;
  amountCents: number;
}

function parseInput(value: unknown): SettlementInput {
  if (!value || typeof value !== "object") {
    throw new SettlementMutationError("转账数据格式不正确", 400);
  }
  const input = value as Record<string, unknown>;
  const result = {
    fromMemberId:
      typeof input.fromMemberId === "string" ? input.fromMemberId : "",
    toMemberId: typeof input.toMemberId === "string" ? input.toMemberId : "",
    amountCents:
      typeof input.amountCents === "number" ? input.amountCents : Number.NaN,
  };
  if (
    !result.fromMemberId ||
    !result.toMemberId ||
    result.fromMemberId === result.toMemberId ||
    !Number.isInteger(result.amountCents) ||
    result.amountCents <= 0
  ) {
    throw new SettlementMutationError("转账数据无效", 400);
  }
  return result;
}

export function createSettlement(
  groupId: string,
  currentUserId: string,
  value: unknown
) {
  if (!currentUserId) {
    throw new SettlementMutationError("缺少当前用户", 401);
  }
  const input = parseInput(value);
  const pageData = getSettlementPageData(groupId);
  if (!pageData) throw new SettlementMutationError("群组不存在", 404);

  const database = openDatabase();
  try {
    const membership = database
      .prepare(
        `SELECT id FROM "GroupMember" WHERE groupId = ? AND userId = ? LIMIT 1`
      )
      .get(groupId, currentUserId);
    if (!membership) {
      throw new SettlementMutationError("当前用户不属于这个群组", 403);
    }
  } finally {
    database.close();
  }

  const currentTransfers = [
    ...pageData.optimalTransfers,
    ...pageData.directTransfers,
  ];
  const isCurrentTransfer = currentTransfers.some(
    (transfer) =>
      transfer.from === input.fromMemberId &&
      transfer.to === input.toMemberId &&
      transfer.amountCents === input.amountCents
  );
  if (!isCurrentTransfer) {
    throw new SettlementMutationError("结算方案已经变化，请刷新后重试", 409);
  }

  const settlementId = randomUUID();
  const writable = openWritableDatabase();
  try {
    writable
      .prepare(
        `INSERT INTO "Settlement" (
          id, groupId, fromMemberId, toMemberId, amountCents, confirmedAt
        ) VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        settlementId,
        groupId,
        input.fromMemberId,
        input.toMemberId,
        input.amountCents,
        Date.now()
      );
  } finally {
    writable.close();
  }

  return { settlementId, groupId };
}
