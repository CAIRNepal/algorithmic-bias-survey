import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Image from 'next/image';
import Link from 'next/link';
import React from 'react';

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
        url: "/algorithmic-bias-survey/logo-slogan.png",
        width: 120,
        height: 40,
        alt: "CAIR Nepal Logo",
      },
    ],
    type: "website",
  },
};

// ErrorBoundary component
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch() {
    // You can log error info here if needed
    // console.error('ErrorBoundary caught:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Something went wrong.</h1>
          <p className="text-gray-700 mb-2">A client-side error occurred. Please try refreshing the page or contact support if the problem persists.</p>
          {this.state.error && (
            <pre className="bg-red-100 text-red-800 p-2 rounded text-xs max-w-xl overflow-x-auto mt-2">{this.state.error.message}</pre>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/algorithmic-bias-survey/logo-slogan.png" type="image/png" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ErrorBoundary>
          <header className="w-full bg-white shadow flex items-center justify-between px-8 py-4 mb-4 z-50 relative">
            <div className="flex items-center gap-4">
              <a href="https://cair-nepal.org/" target="_blank" rel="noopener noreferrer">
                <Image src="/algorithmic-bias-survey/logo-slogan.png" alt="CAIR Nepal Logo" width={120} height={40} className="h-10 mr-4 object-contain" priority unoptimized />
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
              &copy; {new Date().getFullYear()} <a href="https://cair-nepal.org" className="underline hover:text-blue-700" target="_blank" rel="noopener noreferrer">cair-nepal.org</a>. <a href="https://creativecommons.org/licenses/by/4.0/" className="underline hover:text-blue-700" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>
            </div>
          </footer>
        </ErrorBoundary>
      </body>
    </html>
  );
}
