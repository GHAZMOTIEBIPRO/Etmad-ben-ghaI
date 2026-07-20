import type { Metadata } from "next";
import { Header } from "@/components/header";
import { SignatureMark } from "@/components/signature-mark";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "رادار المشاريع السعودي", template: "%s | رادار المشاريع السعودي" },
  description: "منصة سعودية لذكاء سوق المشاريع والمنافسات والترسيات والمقاولين، تربط الإشارات العامة والرسمية بملفات مشاريع موحدة عبر دورة حياتها.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const buildSha = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? process.env.GITHUB_SHA?.slice(0, 7) ?? "local";

  return (
    <html lang="ar" dir="rtl">
      <body className="min-h-screen text-slate-950 antialiased">
        <Header />
        {children}
        <footer className="mt-16 border-t border-slate-200/80 bg-white/80 backdrop-blur">
          <div className="mx-auto flex max-w-[1500px] flex-col gap-2 px-4 py-8 text-sm leading-7 text-slate-500 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
            <span>رادار المشاريع السعودي — منصة مستقلة لذكاء سوق المشاريع والفرص في المملكة.</span>
            <span className="text-xs text-slate-400">البيانات العامة والرسمية موضحة داخل مركز تشغيل المصادر. الإصدار: {buildSha}</span>
          </div>
        </footer>
        <SignatureMark />
      </body>
    </html>
  );
}
