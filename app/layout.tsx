import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Second Brain",
  description: "A local-first personal AI workspace.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="AppLayout h-full antialiased">
      <body className="AppLayout__body min-h-full flex flex-col">
        {children}
      </body>
    </html>
  );
}
