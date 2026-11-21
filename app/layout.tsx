import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Thai } from "next/font/google";
import "./globals.css";

const thai = IBM_Plex_Sans_Thai({ variable: "--font-thai", subsets: ["thai", "latin"], weight: ["400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: "พูดได้ Pud-dai",
  description: "คัดกรองไข้หวัดใหญ่สำหรับประชาชน และเฝ้าระวังการระบาดแบบเรียลไทม์สำหรับเจ้าหน้าที่ควบคุมโรค (ต้นแบบ)",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0e7468" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th">
      <body className={`${thai.variable} antialiased`}>{children}</body>
    </html>
  );
}
