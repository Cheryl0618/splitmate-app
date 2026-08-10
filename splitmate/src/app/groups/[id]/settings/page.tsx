import { notFound } from "next/navigation";

import { GroupForm } from "@/components/group-form";
import { GroupMembersForm } from "@/components/group-members-form";
import { getExpenseFormGroup } from "@/server/expenses";

export default async function GroupSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const group = getExpenseFormGroup(id);
  if (!group) notFound();
  return (
    <main className="min-h-screen bg-[#f6f8f7] px-4 py-10 text-slate-900">
      <div className="mx-auto max-w-xl">
        <GroupForm
          embedded
          initialValue={{ id: group.id, name: group.name, currency: group.currency }}
        />
        <GroupMembersForm groupId={group.id} />
      </div>
    </main>
  );
}
