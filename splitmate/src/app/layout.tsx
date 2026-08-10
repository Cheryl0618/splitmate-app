import type { Metadata } from "next";
import { SiteNav } from "@/components/site-nav";
import { CurrentUserProvider } from "@/lib/current-user";
import { getAccountUsers } from "@/server/settings";
import "./globals.css";

export const metadata: Metadata = {
  title: "SplitMate",
  description: "多人共享记账与智能结算",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const users = getAccountUsers();

  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <CurrentUserProvider users={users}>
          <SiteNav />
          {children}
        </CurrentUserProvider>
      </body>
    </html>
  );
}
