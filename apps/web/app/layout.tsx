import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Hark Protocol - Demo Publisher",
  description: "Ads that listen first.",
};

function NavBar() {
  return (
    <header className="border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-black/80 sticky top-0 z-10">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
        <Link href="/" className="flex items-center">
          <span className="rounded-md bg-white px-2 py-1.5 shadow-sm">
            <Image src="/hark-logo.png" alt="Hark" width={128} height={32} priority />
          </span>
        </Link>
        <div className="flex gap-5 text-sm font-medium text-zinc-600 dark:text-zinc-400">
          <Link href="/" className="hover:text-zinc-900 dark:hover:text-zinc-50">
            Demo Publisher
          </Link>
          <Link href="/agents" className="hover:text-zinc-900 dark:hover:text-zinc-50">
            Agent Dashboard
          </Link>
          <Link href="/explorer" className="hover:text-zinc-900 dark:hover:text-zinc-50">
            Explorer
          </Link>
        </div>
      </nav>
    </header>
  );
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-50 dark:bg-zinc-950">
        <NavBar />
        <div className="flex flex-1 flex-col">{children}</div>
      </body>
    </html>
  );
}
