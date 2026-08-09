import { getGroupBalances } from "@/server/balances";
import { openDatabase } from "@/server/database";

export interface DemoUserSummary {
  id: string;
  displayName: string;
}

export interface GroupMemberSummary {
  id: string;
  userId: string | null;
  displayName: string;
}

export interface GroupCardData {
  id: string;
  name: string;
  members: GroupMemberSummary[];
  balancesByUserId: Record<string, number>;
}

interface GroupRow {
  id: string;
  name: string;
}

interface MemberRow extends GroupMemberSummary {
  groupId: string;
}

export function getGroupListData(): {
  users: DemoUserSummary[];
  groups: GroupCardData[];
} {
  const database = openDatabase();

  try {
    const userRows = database
      .prepare(`SELECT id, displayName FROM "User" ORDER BY createdAt, id`)
      .all() as DemoUserSummary[];
    const groupRows = database
      .prepare(`SELECT id, name FROM "Group" ORDER BY createdAt, id`)
      .all() as GroupRow[];
    const memberRows = database
      .prepare(
        `SELECT id, groupId, userId, displayName FROM "GroupMember" ORDER BY createdAt, id`
      )
      .all() as MemberRow[];
    const users = userRows.map(({ id, displayName }) => ({ id, displayName }));
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
        members: members.map(({ id, userId, displayName }) => ({
          id,
          userId,
          displayName,
        })),
        balancesByUserId,
      };
    });

    return { users, groups };
  } finally {
    database.close();
  }
}
