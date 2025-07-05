"use client";
import { useEffect, useState } from 'react';
import Papa from 'papaparse';
import AdvancedAnalytics from '../AdvancedAnalytics';

type Paper = {
  SN?: string;
  'Paper Title'?: string;
  DOI?: string;
  'Authors'?: string;
  'Author Regions'?: string;
  'Affiliations'?: string;
  Year?: string;
  'Focus Region'?: string;
  Domain?: string;
  Abstract?: string;
  [key: string]: unknown;
};

const BASE_PATH = '/algorithmic-bias-survey';

export default function AdvancedPage() {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${BASE_PATH}/papers.csv`)
      .then(res => res.text())
      .then(csvText => {
        Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            setPapers(results.data as Paper[]);
            setLoading(false);
          }
        });
      });
  }, []);

  if (loading) return <div className="p-8 text-center">Loading...</div>;
  return <AdvancedAnalytics papers={papers} />;
} 