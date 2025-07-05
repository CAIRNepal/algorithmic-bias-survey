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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${BASE_PATH}/papers.csv`)
      .then(res => {
        if (!res.ok) throw new Error('CSV not found');
        return res.text();
      })
      .then(csvText => {
        if (!csvText.trim()) throw new Error('CSV is empty');
        Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            setPapers(results.data as Paper[]);
            setLoading(false);
          },
          error: (err: unknown) => {
            setLoading(false);
            setPapers([]);
            setError('Failed to parse papers.csv. Please check the file format.');
            if (err instanceof Error) {
              console.error('PapaParse error:', err.message);
            } else {
              console.error('PapaParse error:', err);
            }
          }
        });
      })
      .catch((err: unknown) => {
        setLoading(false);
        setPapers([]);
        setError(err instanceof Error ? err.message : 'Failed to load papers.csv');
        console.error('Error loading CSV:', err);
      });
  }, []);

  if (loading) return <div className="p-8 text-center">Loading...</div>;
  if (error) return <div className="p-8 text-center text-red-600 font-semibold">{error}</div>;
  return <AdvancedAnalytics papers={papers} />;
} 