import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Đọc Truyện Dọc",
  description: "Trải nghiệm đọc truyện cuộn dọc xuyên suốt",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
