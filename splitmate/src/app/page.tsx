import { HomeDashboard } from "@/components/home-dashboard";
import { getGroupListData } from "@/server/groups";

export default function Home() {
  const data = getGroupListData();
  return <HomeDashboard users={data.users} groups={data.groups} />;
}
