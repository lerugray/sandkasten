import type { Metadata } from "next";
import "./globals.css";

const TITLE = "Sandkasten: open-source naval and air wargame";
const DESCRIPTION =
  "Command naval and air forces on a tactical map with NATO symbology, radar detection, fog of war, and WeGo turns. Free and open source.";

export const metadata: Metadata = {
  metadataBase: new URL("https://csl-sandkasten.com/"),
  title: TITLE,
  description: DESCRIPTION,
  applicationName: "Sandkasten",
  alternates: { canonical: "https://csl-sandkasten.com/" },
  openGraph: {
    type: "website",
    url: "https://csl-sandkasten.com/",
    siteName: "Sandkasten",
    title: TITLE,
    description: DESCRIPTION,
    locale: "en_US",
    images: [
      {
        url: "https://csl-sandkasten.com/og-1200x630.png",
        width: 1200,
        height: 630,
        alt: "Sandkasten: in-game tactical plot of the Strait of Hormuz opening scenario",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["https://csl-sandkasten.com/og-1200x630.png"],
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
