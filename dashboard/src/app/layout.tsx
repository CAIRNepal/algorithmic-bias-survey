import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Image from 'next/image';
import Link from 'next/link';

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || '';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Bias Research Dashboard | CAIR-Nepal",
  description: "Explore regional trends and knowledge graph-based bias mitigation in AI research. Empowering fairness and transparency in AI.",
  keywords: "AI bias, fairness, transparency, CAIR Nepal, knowledge graph, regional trends, research dashboard",
  openGraph: {
    title: "Bias Research Dashboard | CAIR-Nepal | Towards FAIR AI | AI Bias | CAIR-Nepal",
    description: "Explore regional trends and knowledge graph-based bias mitigation in AI research.",
    url: "https://cairnepal.github.io/algorithmic-bias-survey/",
    siteName: "Bias Research Dashboard",
    images: [
      {
        url: `${BASE_PATH}/logo-slogan.png`,
        width: 120,
        height: 40,
        alt: "CAIR Nepal Logo",
      },
    ],
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href={`${BASE_PATH}/logo-slogan.png`} type="image/png" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <header className="w-full bg-white border-b border-gray-100 shadow-sm flex items-center justify-between px-8 py-4 sticky top-0 z-50">
          <div className="flex items-center gap-4">
            <a href="https://cair-nepal.org/" target="_blank" rel="noopener noreferrer">
              <Image src={`${BASE_PATH}/logo-slogan.png`} alt="CAIR Nepal Logo" width={120} height={40} className="h-10 object-contain" priority unoptimized />
            </a>
            <div className="border-l border-gray-200 pl-4">
              <span className="text-xl font-bold text-gray-900">Bias Research Dashboard</span>
              <span className="block text-xs text-gray-500 mt-0.5">Empowering Fairness &amp; Transparency in AI Research</span>
            </div>
          </div>
          <nav className="flex items-center gap-1">
            <Link href="/" className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-all">Home</Link>
            <Link href="/advanced" className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-all">Advanced Analytics</Link>
            <Link href="/atlas" className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-violet-600 hover:text-violet-800 hover:bg-violet-50 rounded-lg transition-all">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-60" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500" />
              </span>
              Atlas
            </Link>
            <a href="https://cair-nepal.org/giving" target="_blank" className="ml-3 px-5 py-2 text-sm font-semibold rounded-lg bg-blue-600 text-white shadow-sm hover:bg-blue-700 transition-colors">Donate</a>
          </nav>
        </header>
        <main className="bg-slate-50">
          {children}
        </main>
        <footer className="w-full bg-gray-900 text-white mt-0 py-8">
          <div className="max-w-7xl mx-auto px-8 text-center">
            <p className="text-gray-300 text-sm leading-relaxed">
              This work is part of{" "}
              <span className="font-semibold text-white">
                Towards FAIR AI: A Survey of Regional Trends and Knowledge Graph-Enhanced Bias Mitigation
              </span>
            </p>
            <p className="text-gray-400 text-sm mt-1">Abhash Shrestha · Tek Raj Chhetri · Sanju Tiwari</p>
            <div className="mt-5 pt-5 border-t border-gray-800 flex items-center justify-center gap-4 text-xs text-gray-500">
              <span>&copy; {new Date().getFullYear()}</span>
              <a href="https://cair-nepal.org" className="text-gray-400 hover:text-white transition-colors underline" target="_blank" rel="noopener noreferrer">cair-nepal.org</a>
              <span>·</span>
              <a href="https://www.apache.org/licenses/LICENSE-2.0" className="text-gray-400 hover:text-white transition-colors underline" target="_blank" rel="noopener noreferrer">Apache License 2.0</a>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
