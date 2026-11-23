import type { Metadata, Viewport } from "next";
import "@fontsource/allura";
import "@fontsource-variable/eb-garamond";
import "@fontsource-variable/eb-garamond/wght-italic.css";
import "./globals.css";
import { OrnamentDefs } from "@/components/Ornament";
import { party } from "@/config/party";

export const metadata: Metadata = {
  title: `RSVP · ${party.companyName} Christmas Party ${party.year}`,
  description: `RSVP for the ${party.companyName} Christmas Party.`,
};

export const viewport: Viewport = {
  themeColor: "#6e0f1f",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <OrnamentDefs />
        {children}
      </body>
    </html>
  );
}
