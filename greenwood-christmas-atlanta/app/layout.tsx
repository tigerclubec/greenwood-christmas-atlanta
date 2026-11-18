import type { Metadata, Viewport } from "next";
import "@fontsource/instrument-serif";
import "@fontsource/instrument-serif/400-italic.css";
import "@fontsource-variable/inter";
import "@fontsource/great-vibes";
import "./globals.css";
import { OrnamentDefs } from "@/components/Ornament";
import { party } from "@/config/party";

export const metadata: Metadata = {
  title: `RSVP · ${party.companyName} Christmas Party ${party.year}`,
  description: `RSVP for the ${party.companyName} Christmas Party.`,
};

export const viewport: Viewport = {
  themeColor: "#2a0a10",
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
