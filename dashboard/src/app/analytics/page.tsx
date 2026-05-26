"use client";

import { useEffect, useState } from "react";
import Papa from "papaparse";
import dynamic from "next/dynamic";

const AdvancedAnalytics = dynamic(() => import("../AdvancedAnalytics"), {
  ssr: false,
  loading: () => (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
      <p className="text-gray-500 font-medium">Loading advanced analytics…</p>
    </div>
  ),
});

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

type Paper = {
  SN?: string;
  "Paper Title"?: string;
  DOI?: string;
  Authors?: string;
  "Author Regions"?: string;
  Affiliations?: string;
  Year?: string;
  "Focus Region"?: string;
  Domain?: string;
  Abstract?: string;
  "ORC ID"?: string;
  [key: string]: unknown;
};

export default function AnalyticsPage() {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${BASE_PATH}/papers.csv`)
      .then((r) => r.text())
      .then((csvText) => {
        if (!csvText.trim()) throw new Error("CSV is empty");
        Papa.parse<Paper>(csvText, {
          header: true,
          skipEmptyLines: true,
          complete: (result) => {
            setPapers(result.data);
            setLoading(false);
          },
          error: (err: { message: string }) => {
            setError("Failed to parse papers.csv: " + err.message);
            setLoading(false);
          },
        });
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load papers.csv");
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
        <p className="text-gray-500 font-medium">Loading papers…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  return <AdvancedAnalytics papers={papers} />;
}
