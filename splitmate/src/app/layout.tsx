import type { Metadata } from "next";
import { Instrument_Serif } from "next/font/google";
import { SiteNav } from "@/components/site-nav";
import { I18nProvider } from "@/i18n/context";
import { CurrentUserProvider } from "@/lib/current-user";
import "./globals.css";

const brandFont = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  variable: "--font-brand",
});

export const metadata: Metadata = {
  title: "Quits",
  description: "Shared expenses and clean settlements",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-CN" className={`${brandFont.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <I18nProvider>
          <CurrentUserProvider>
            <SiteNav />
            {children}
          </CurrentUserProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
