import type { Metadata } from "next";
import { CurrentUserProvider } from "@/lib/current-user";
import { getCurrentUserId } from "@/server/current-user";
import "./globals.css";

export const metadata: Metadata = {
  title: "SplitMate",
  description: "多人共享记账与智能结算",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const initialUserId = await getCurrentUserId();

  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <CurrentUserProvider initialUserId={initialUserId}>
          {children}
        </CurrentUserProvider>
      </body>
    </html>
  );
}
