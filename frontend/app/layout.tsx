import type { Metadata } from "next";
import "./globals.css";
import { ToastViewport } from "../components/ToastViewport";

export const metadata: Metadata = {
  title: "Secure P2P Transfer",
  description: "Direct browser-to-browser file sharing and messaging.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {children}
        <ToastViewport />
      </body>
    </html>
  );
}
