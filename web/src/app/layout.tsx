import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro, JetBrains_Mono } from "next/font/google";
import { NetworkBackground } from "@/components/NetworkBackground";
import "./globals.css";
import { Providers } from "./providers";

const beVietnamPro = Be_Vietnam_Pro({
  variable: "--font-be-vietnam-pro",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin", "vietnamese"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "AgentLeash — Cổng kiểm soát chi tiêu x402 cho AI Agent",
  description:
    "Ví cho AI agent có dây xích on-chain trên Avalanche Fuji: hạn mức 2 tầng Whitelist & Sandbox, dòng tiền x402 và Kill Switch khẩn cấp.",
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#020617",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className={`${beVietnamPro.variable} ${jetbrainsMono.variable} dark`}>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <NetworkBackground />
        <div className="relative z-10">
          <Providers>{children}</Providers>
        </div>
      </body>
    </html>
  );
}
