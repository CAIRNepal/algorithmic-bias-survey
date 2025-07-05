"use client";
import { useEffect, useState } from 'react';
import Papa from 'papaparse';
import AdvancedAnalytics from '../AdvancedAnalytics';

export default function AdvancedPage() {
  const [papers, setPapers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/papers.csv')
      .then(res => res.text())
      .then(csvText => {
        Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            setPapers(results.data as any[]);
            setLoading(false);
          }
        });
      });
  }, []);

  if (loading) return <div className="p-8 text-center">Loading...</div>;
  return <AdvancedAnalytics papers={papers} />;
} 