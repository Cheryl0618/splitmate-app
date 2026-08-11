import { getGroupBalances } from "@/server/balances";
import { openDatabase } from "@/server/database";
import { normalizeAvatarColor, type AvatarColor } from "@/lib/avatar-colors";
import type { Currency } from "@/lib/currency";

export interface GroupMemberSummary {
  id: string;
  userId: string | null;
  displayName: string;
  avatarColor: AvatarColor;
}

export interface GroupCardData {
  id: string;
  name: string;
  currency: Currency;
  members: GroupMemberSummary[];
  balancesByUserId: Record<string, number>;
}

interface GroupRow {
  id: string;
  name: string;
  currency: Currency;
}

interface MemberRow extends GroupMemberSummary {
  groupId: string;
}

export function getGroupListData(): {
  groups: GroupCardData[];
} {
  const database = openDatabase();

  try {
    const groupRows = database
      .prepare(`SELECT id, name, currency FROM "Group" ORDER BY createdAt, id`)
      .all() as GroupRow[];
    const memberRows = database
      .prepare(
        `SELECT id, groupId, userId, displayName, avatarColor
         FROM "GroupMember"
         ORDER BY createdAt, id`
      )
      .all() as MemberRow[];
    const groups = groupRows.map((group): GroupCardData => {
      const members = memberRows.filter((member) => member.groupId === group.id);
      const balances = getGroupBalances(group.id);
      const balancesByUserId = Object.fromEntries(
        balances.flatMap((member) =>
          member.userId ? [[member.userId, member.amountCents]] : []
        )
      );

      return {
        id: group.id,
        name: group.name,
        currency: group.currency,
        members: members.map(({ id, userId, displayName, avatarColor }) => ({
          id,
          userId,
          displayName,
          avatarColor: normalizeAvatarColor(avatarColor),
        })),
        balancesByUserId,
      };
    });

    return { groups };
  } finally {
    database.close();
  }
}
