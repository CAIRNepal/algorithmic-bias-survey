import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Image from 'next/image';

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
        url: "logo-slogan.png",
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
        <link rel="icon" href="logo-slogan.png" type="image/png" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <header className="w-full bg-white shadow flex items-center px-6 py-4 mb-4">
          <a href="https://cair-nepal.org/" target="_blank" rel="noopener noreferrer">
            <Image src="logo-slogan.png" alt="CAIR Nepal Logo" width={120} height={40} className="h-10 mr-4 object-contain" priority />
          </a>
          <div>
            <span className="text-2xl font-bold text-blue-700">Bias Research Dashboard</span>
            <span className="block text-sm text-gray-500">Empowering Fairness & Transparency in AI Research</span>
          </div>
        </header>
        <main className="min-h-screen bg-gray-50">
          {children}
        </main>
        <footer className="w-full bg-white border-t mt-8 py-4 text-center text-xs text-gray-500">
          <div>
            &copy; {new Date().getFullYear()} <a href="https://cair-nepal.org" className="underline hover:text-blue-700" target="_blank" rel="noopener noreferrer">cair-nepal.org</a> + authors. <a href="https://creativecommons.org/licenses/by/4.0/" className="underline hover:text-blue-700" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>
          </div>
        </footer>
      </body>
    </html>
  );
}
