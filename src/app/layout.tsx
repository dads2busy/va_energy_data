import "./globals.css";
import { ReactNode } from "react";

export const metadata = {
  title: "Virginia Energy Data",
  description:
    "Interactive companion to the UVA Biocomplexity residential energy digital twin papers.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-gray-900 antialiased">
        {children}
      </body>
    </html>
  );
}
