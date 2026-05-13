import "./globals.css";
import { ReactNode } from "react";
import { Fraunces, Public_Sans, JetBrains_Mono } from "next/font/google";
import { NuqsAdapter } from "nuqs/adapters/next/app";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  axes: ["opsz"],
  display: "swap",
});

const publicSans = Public_Sans({
  subsets: ["latin"],
  variable: "--font-public-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata = {
  title: "Virginia Energy Data Atlas",
  description:
    "Interactive companion to the UVA Biocomplexity residential energy digital twin papers.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${publicSans.variable} ${jetbrainsMono.variable}`}
    >
      <body className="min-h-screen antialiased">
        <NuqsAdapter>{children}</NuqsAdapter>
      </body>
    </html>
  );
}
