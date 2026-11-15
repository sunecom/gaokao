import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "高考决策引擎 — AI 智能志愿填报",
  description: "基于位次匹配 + AI 分析的高考志愿填报决策系统",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-slate-50 antialiased">{children}</body>
    </html>
  );
}
