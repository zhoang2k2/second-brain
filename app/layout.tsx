import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Second Brain",
  description: "Không gian AI cá nhân chạy trên máy của bạn.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi" className="AppLayout h-full antialiased">
      <body className="AppLayout__body min-h-full flex flex-col">
        {children}
      </body>
    </html>
  );
}
