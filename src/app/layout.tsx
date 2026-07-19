import type { Metadata } from "next";
import { Header } from "@/components/header";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "اعتماد بلس", template: "%s | اعتماد بلس" },
  description: "منصة عربية لعرض وتحليل المنافسات والترسيات الحكومية السعودية.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl">
      <body className="min-h-screen bg-slate-50 text-slate-950 antialiased">
        <Header />
        {children}
        <footer className="mt-16 border-t border-slate-200 bg-white">
          <div className="mx-auto max-w-[1500px] px-4 py-8 text-sm text-slate-500 sm:px-6 lg:px-8">
            اعتماد بلس — منصة تحليلية مستقلة. البيانات التجريبية المعروضة في وضع MVP ليست بيانات رسمية ما لم يتم تفعيل موصل مصدر حكومي موثق.
          </div>
        </footer>
      </body>
    </html>
  );
}
