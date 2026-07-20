import type { Metadata } from "next";
import { Header } from "@/components/header";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "رادار المقاولات", template: "%s | رادار المقاولات" },
  description: "منصة سعودية لرصد وتحليل المشاريع والمنافسات والمقاولين وفرص قطاع التشييد من مصادر عامة ورسمية متعددة.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl">
      <body className="min-h-screen bg-slate-50 text-slate-950 antialiased">
        <Header />
        {children}
        <footer className="mt-16 border-t border-slate-200 bg-white">
          <div className="mx-auto max-w-[1500px] px-4 py-8 text-sm leading-7 text-slate-500 sm:px-6 lg:px-8">
            رادار المقاولات — منصة تحليلية مستقلة تجمع البيانات العامة والمفتوحة من مصادر متعددة. يتم وسم حالة كل مصدر بوضوح، ولا تُعرض البيانات التجريبية إلا عند تفعيلها صراحة في بيئة التطوير.
          </div>
        </footer>
      </body>
    </html>
  );
}
