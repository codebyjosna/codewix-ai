import type { Metadata } from "next";
import PlausibleProvider from "next-plausible";
import "./globals.css";

let title = "Codewix – AI App Generator";
let description = "Turn your idea into an app with Codewix.";
let url = "https://codewix.in/";
let ogimage = "https://codewix.in/og-image.png";
let sitename = "Codewix";

export const metadata: Metadata = {
  metadataBase: new URL(url),
  title,
  description,
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icon.png", type: "image/png" },
    ],
    apple: "/apple-icon.png",
  },
  openGraph: {
    images: [ogimage],
    title,
    description,
    url: url,
    siteName: sitename,
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    images: [ogimage],
    title,
    description,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <head>
        <PlausibleProvider domain="codewix.in" />
      </head>

      {children}
    </html>
  );
}
