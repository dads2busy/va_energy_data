import "./globals.css";
import { ReactNode } from "react";
import { NuqsAdapter } from "nuqs/adapters/next/app";

export const metadata = {
  title: "Virginia Energy Data",
  description:
    "Interactive companion to the UVA Biocomplexity residential energy digital twin papers.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-gray-900 antialiased">
        <NuqsAdapter>{children}</NuqsAdapter>
      </body>
    </html>
  );
}
