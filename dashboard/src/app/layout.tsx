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
        <header className="w-full bg-white shadow flex items-center justify-between px-8 py-4 mb-4 z-50 relative">
          <div className="flex items-center gap-4">
            <a href="https://cair-nepal.org/" target="_blank" rel="noopener noreferrer">
              <Image src={`${BASE_PATH}/logo-slogan.png`} alt="CAIR Nepal Logo" width={120} height={40} className="h-10 mr-4 object-contain" priority unoptimized />
            </a>
            <div>
              <span className="text-2xl font-bold text-blue-700">Bias Research Dashboard</span>
              <span className="block text-sm text-gray-500">Empowering Fairness & Transparency in AI Research</span>
            </div>
          </div>
          <nav className="flex items-center gap-2 text-blue-700 font-medium text-lg">
            <Link href="/" className="px-3 py-2 hover:text-blue-900 transition">Home</Link>
            <Link href="/advanced" className="px-3 py-2 hover:text-blue-900 transition">Advanced Analytics</Link>
        
            
            <a href="https://cair-nepal.org/giving" target="_blank" className="ml-2 px-5 py-2 rounded bg-blue-600 text-white font-semibold shadow hover:bg-blue-700 transition">Donate</a>
          </nav>
        </header>
        <main className="min-h-screen bg-gray-50">
          {children}
        </main>
        <footer className="w-full bg-white border-t mt-8 py-4 text-center text-xs text-gray-500">
          <div className="mb-1">
            This work is part of <span className="font-semibold text-gray-700">Towards FAIR AI: A Survey of Regional Trends and Knowledge Graph-Enhanced Bias Mitigation</span>.<br />
            <span className="text-gray-700">Abhash Shrestha, Tek Raj Chhetri, Sanju Tiwari</span>
          </div>
          <div>
            &copy; {new Date().getFullYear()} <a href="https://cair-nepal.org" className="underline hover:text-blue-700" target="_blank" rel="noopener noreferrer">cair-nepal.org</a>. <a href="https://www.apache.org/licenses/LICENSE-2.0" className="underline hover:text-blue-700" target="_blank" rel="noopener noreferrer">Apache License 2.0</a>
          </div>
        </footer>
      </body>
    </html>
  );
}
