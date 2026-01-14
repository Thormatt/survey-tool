import type { Metadata } from "next";
import { Syne, Archivo } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "Survey Tool",
  description: "Create beautiful, intelligent surveys",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body
          className={`${syne.variable} ${archivo.variable} antialiased bg-[#fbf5ea] text-[#1a1a2e]`}
        >
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
