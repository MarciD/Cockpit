import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "cockpit",
  description: "Personal work dashboard",
  applicationName: "cockpit",
  appleWebApp: {
    capable: true,
    title: "cockpit",
    statusBarStyle: "default",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
};

// `viewport-fit=cover` is what makes `env(safe-area-inset-*)` resolve to real
// values under a notch / home indicator (used by the mobile chrome). Zoom is
// left enabled on purpose (no maximumScale / userScalable) for accessibility.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#e8e1d3",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
