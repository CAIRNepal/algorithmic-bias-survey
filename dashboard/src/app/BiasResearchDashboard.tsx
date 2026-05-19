"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";
import { useEffect, useState } from "react";
import Papa from "papaparse";
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from "react-simple-maps";
import { saveAs } from "file-saver";
import html2canvas from "html2canvas";

const formatDomainForDisplay = (domain: string): string => {
  const specialCases: Record<string, string> = {
    "health & clinical ai": "Health & Clinical AI",
    "general fairness & bias mitigation": "General Fairness & Bias Mitigation",
    "graph-based fairness & bias mitigation":
      "Graph-Based Fairness & Bias Mitigation",
    "llm and nlp": "LLM and NLP",
    "recommender systems": "Recommender Systems",
  };

  return specialCases[domain.toLowerCase()] || domain;
};

const DOMAIN_COLORS = [
  "#2563eb",
  "#dc2626",
  "#16a34a",
  "#ca8a04",
  "#9333ea",
  "#eab308",
  "#f59e42",
  "#10b981",
];
const authorRegionToCountryMap: Record<string, string> = {
  USA: "United States of America",
  "United States": "United States of America",
  UK: "United Kingdom",
  Australia: "Australia",
  Germany: "Germany",
  France: "France",
  Canada: "Canada",
  China: "China",
  India: "India",
  Japan: "Japan",
  "South Korea": "Republic of Korea",
  Italy: "Italy",
  Spain: "Spain",
  Netherlands: "Netherlands",
  Switzerland: "Switzerland",
  Sweden: "Sweden",
  Norway: "Norway",
  Denmark: "Denmark",
  Finland: "Finland",
  Austria: "Austria",
  Belgium: "Belgium",
  Greece: "Greece",
  Ireland: "Ireland",
  Israel: "Israel",
  Turkey: "Turkey",
  Taiwan: "Taiwan",
  "Hong Kong": "Hong Kong",
  "United Arab Emirates": "United Arab Emirates",
};

type Paper = {
  SN?: string;
  "Paper Title"?: string;
  Authors?: string;
  DOI?: string;
  "Author Regions"?: string;
  Affiliations?: string;
  Year?: string;
  "Focus Region"?: string;
  Domain?: string;
  Abstract?: string;
  Citations?: string;
  [key: string]: unknown;
};

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

// Reusable download icon
const DownloadIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
);

const BiasResearchDashboard = () => {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(true);
  const [tooltip, setTooltip] = useState<{
    content: string;
    x: number;
    y: number;
  } | null>(null);
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [selectedDomains, setSelectedDomains] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [useFirstAuthorOnly, setUseFirstAuthorOnly] = useState(false);
  const [filterYear, setFilterYear] = useState("");
  const [filterRegion, setFilterRegion] = useState("");
  const [filterDomain, setFilterDomain] = useState("");
  const [filterAuthor, setFilterAuthor] = useState("");
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: "asc" | "desc";
  } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [modalPaper, setModalPaper] = useState<Paper | null>(null);
  const pageSize = 10;
  const [error, setError] = useState<string | null>(null);

  const downloadChartAsImage = async (elementId: string, filename: string) => {
    const element = document.getElementById(elementId);
    if (element) {
      try {
        const canvas = await html2canvas(element, {
          backgroundColor: "#ffffff",
          scale: 2,
          logging: false,
          useCORS: false,
          allowTaint: false,
        });
        const link = document.createElement("a");
        link.download = `${filename}.png`;
        link.href = canvas.toDataURL();
        link.click();
      } catch (error) {
        console.error("Download error:", error);
        alert("Chart download failed. Please try again.");
      }
    }
  };

  useEffect(() => {
    fetch(`${BASE_PATH}/papers.csv`)
      .then((res) => {
        if (!res.ok) throw new Error("CSV not found");
        return res.text();
      })
      .then((csvText) => {
        if (!csvText.trim()) throw new Error("CSV is empty");
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
            setError("Failed to parse papers.csv. Please check the file format.");
            if (err instanceof Error) {
              console.error("PapaParse error:", err.message);
            } else {
              console.error("PapaParse error:", err);
            }
          },
        });
      })
      .catch((err: unknown) => {
        setLoading(false);
        setPapers([]);
        setError(err instanceof Error ? err.message : "Failed to load papers.csv");
        console.error("Error loading CSV:", err);
      });
  }, []);

  const allRows = papers;
  const validPapers = allRows.filter((paper) => {
    const year = (String(paper["Year"] || "") || "").trim();
    return !!year;
  });
  const skippedPapers = allRows.filter((paper) => !validPapers.includes(paper));
  const totalPapers = allRows.length;
  const skippedCount = skippedPapers.length;

  const yearMap: Record<string, number> = {};
  validPapers.forEach((paper) => {
    const year = (String(paper["Year"] || "") || "").trim();
    if (year) yearMap[year] = (yearMap[year] || 0) + 1;
  });
  const yearData = Object.entries(yearMap)
    .map(([year, count]) => ({ year: Number(year), count }))
    .sort((a, b) => a.year - b.year);

  const firstAuthorRegionMap: Record<string, number> = {};
  validPapers.forEach((paper) => {
    const authorRegions = (String(paper["Author Regions"] || "") || "").trim();
    if (authorRegions) {
      const firstRegion = authorRegions.split(";")[0].trim();
      if (firstRegion)
        firstAuthorRegionMap[firstRegion] = (firstAuthorRegionMap[firstRegion] || 0) + 1;
    }
  });
  const firstAuthorRegionData = Object.entries(firstAuthorRegionMap).map(([region, count]) => ({ region, count }));

  const allAuthorsRegionMap: Record<string, number> = {};
  validPapers.forEach((paper) => {
    const authorRegions = (String(paper["Author Regions"] || "") || "").trim();
    if (authorRegions) {
      const regions = authorRegions.split(";").map((r) => r.trim()).filter(Boolean);
      regions.forEach((region) => {
        if (region) allAuthorsRegionMap[region] = (allAuthorsRegionMap[region] || 0) + 1;
      });
    }
  });
  const allAuthorsRegionData = Object.entries(allAuthorsRegionMap).map(([region, count]) => ({ region, count }));

  const domainMap: Record<string, number> = {};
  validPapers.forEach((paper) => {
    const domain = (String(paper["Domain"] || "") || "").trim();
    if (domain) domainMap[domain] = (domainMap[domain] || 0) + 1;
  });
  const domainTotal = Object.values(domainMap).reduce((sum, c) => sum + c, 0);
  const domainData = Object.entries(domainMap).map(([domain, count], i) => ({
    domain,
    count,
    percentage: ((count / domainTotal) * 100).toFixed(1),
    color: DOMAIN_COLORS[i % DOMAIN_COLORS.length],
  }));
  console.log("domainData", domainData);

  const allYears = papers
    .map((paper) => (String(paper["Year"] || "") || "").trim())
    .filter((year) => year)
    .map(Number)
    .filter((year) => !isNaN(year));
  const minYear = allYears.length ? Math.min(...allYears) : "";
  const maxYear = allYears.length ? Math.max(...allYears) : "";
  const years = minYear && maxYear ? `${minYear}-${maxYear}` : "";

  const totalDomains = domainData.length;
  const totalRegions = firstAuthorRegionData.length;

  const peakYear = yearData.reduce(
    (max, curr) => (curr.count > max.count ? curr : max),
    { year: 0, count: 0 }
  );
  const growthPeriod =
    yearData.length > 1 ? `${yearData[0].year}-${yearData[yearData.length - 1].year}` : "";
  const recentLLM = domainData.find(
    (d) => d.domain.toLowerCase().includes("llm") || d.domain.toLowerCase().includes("nlp")
  );
  const llmInsight = recentLLM
    ? `Emerging focus on ${recentLLM.domain} (${yearData[yearData.length - 1]?.year})`
    : "";
  const fairnessInsight =
    domainData.length > 0 && domainData[0].domain.toLowerCase().includes("fairness")
      ? "Strong foundation in general fairness research"
      : "";
  const topRegion = firstAuthorRegionData.length > 0 ? firstAuthorRegionData[0] : null;
  const europeanCountries = ["UK", "Germany", "France", "Italy", "Spain", "Switzerland", "Norway", "Denmark"];
  const asianCountries = ["China", "India", "Hong Kong", "South Korea", "Turkey", "Israel"];
  const hasEurope = firstAuthorRegionData.some((r) => europeanCountries.includes(r.region));
  const hasAsia = firstAuthorRegionData.some((r) => asianCountries.includes(r.region));

  const createCountryDomainMap = (
    firstAuthorOnly: boolean
  ): Record<string, { domain: string; count: number; papers: string[]; domainBreakdown: Record<string, number> }> => {
    const countryDomainMap: {
      [key: string]: { domain: string; count: number; papers: string[]; domainBreakdown: { [domain: string]: number } };
    } = {};

    validPapers.forEach((paper) => {
      const authorRegions = (String(paper["Author Regions"] || "") || "").trim();
      const domain = (String(paper["Domain"] || "") || "").trim();
      const title = paper["Paper Title"] || "Unknown";

      if (authorRegions && domain) {
        let regions: string[];
        if (firstAuthorOnly) {
          const firstRegion = authorRegions.split(";")[0].trim();
          regions = firstRegion ? [firstRegion] : [];
        } else {
          regions = authorRegions.split(";").map((r) => r.trim()).filter(Boolean);
        }

        regions.forEach((region: string) => {
          const countryName = authorRegionToCountryMap[region];
          if (countryName) {
            if (!countryDomainMap[countryName]) {
              countryDomainMap[countryName] = { domain: "", count: 0, papers: [], domainBreakdown: {} };
            }
            countryDomainMap[countryName].count++;
            countryDomainMap[countryName].papers.push(title);
            if (!countryDomainMap[countryName].domainBreakdown[domain]) {
              countryDomainMap[countryName].domainBreakdown[domain] = 0;
            }
            countryDomainMap[countryName].domainBreakdown[domain]++;
          } else if (region) {
            console.log(`Unmapped author region: "${region}"`);
          }
        });
      }
    });

    Object.keys(countryDomainMap).forEach((countryName: string) => {
      const domainCounts = countryDomainMap[countryName].domainBreakdown;
      if (Object.keys(domainCounts).length > 0) {
        const dominantDomain = Object.entries(domainCounts).reduce((a, b) => (a[1] > b[1] ? a : b))[0];
        countryDomainMap[countryName].domain = dominantDomain;
      }
    });

    return countryDomainMap;
  };

  const countryDomainMap = createCountryDomainMap(useFirstAuthorOnly);

  const countryToGeoName: Record<string, string> = {
    USA: "United States of America",
    UK: "United Kingdom",
    "South Korea": "Republic of Korea",
    Russia: "Russian Federation",
    Iran: "Iran (Islamic Republic of)",
    Vietnam: "Viet Nam",
    Syria: "Syrian Arab Republic",
    Venezuela: "Venezuela (Bolivarian Republic of)",
    Tanzania: "United Republic of Tanzania",
    Moldova: "Republic of Moldova",
    Bolivia: "Bolivia (Plurinational State of)",
    Brunei: "Brunei Darussalam",
    Laos: "Lao People's Democratic Republic",
    "North Korea": "Democratic People's Republic of Korea",
    "Czech Republic": "Czechia",
    "Ivory Coast": "Côte d&#39;Ivoire",
    Swaziland: "Eswatini",
    "Cape Verde": "Cabo Verde",
    Palestine: "Palestine, State of",
  };

  const getAllUniqueAuthors = () => {
    const allAuthors = new Set<string>();
    papers.forEach((paper) => {
      const authors = (String(paper["Authors"] || "") || "").split(";").map((a) => a.trim()).filter(Boolean);
      authors.forEach((author) => allAuthors.add(author));
    });
    return Array.from(allAuthors).sort();
  };
  const uniqueAuthors = getAllUniqueAuthors();

  const getAllUniqueAuthorRegions = () => {
    const allRegions = new Set<string>();
    papers.forEach((paper) => {
      const regions: string[] = String(paper["Author Regions"] || "").split(";").map((r: string) => r.trim()).filter(Boolean);
      regions.forEach((region: string) => allRegions.add(region));
    });
    return Array.from(allRegions).sort();
  };
  const uniqueAuthorRegions = getAllUniqueAuthorRegions();

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterYear, filterRegion, filterDomain, filterAuthor]);

  const filteredPapers = papers.filter((paper) => {
    const title = (String(paper["Paper Title"] || "") || "").toLowerCase().trim();
    const author = (String(paper["Authors"] || "") || "").toLowerCase().trim();
    const doi = (String(paper["DOI"] || "") || "").toLowerCase().trim();
    const domain = (String(paper["Domain"] || "") || "").toLowerCase().trim();
    const focusRegion = (String(paper["Focus Region"] || "") || "").trim();
    const year = (String(paper["Year"] || "") || "").trim();
    const q = searchQuery.toLowerCase().trim();

    const paperAuthors = (String(paper["Authors"] || "") || "").split(";").map((a) => a.trim().toLowerCase());
    const authorMatches = !filterAuthor || paperAuthors.some((a) => a.includes(filterAuthor.toLowerCase()));

    const authorRegions = (String(paper["Author Regions"] || "") || "").split(";").map((r) => r.trim());
    const regionMatches = !filterRegion || authorRegions.some((r) => r.toLowerCase() === filterRegion.toLowerCase());

    return (
      (!searchQuery || title.includes(q) || author.includes(q) || domain.includes(q) || focusRegion.includes(q) || doi.includes(q)) &&
      (!filterYear || year === filterYear) &&
      regionMatches &&
      (!filterDomain || domain === filterDomain.toLowerCase().trim()) &&
      authorMatches
    );
  });

  const sortedPapers = [...filteredPapers].sort((a, b) => {
    if (!sortConfig) return 0;
    const aVal = String(a[sortConfig.key] || "") || "";
    const bVal = String(b[sortConfig.key] || "") || "";
    if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
    return 0;
  });

  const totalPages = Math.ceil(sortedPapers.length / pageSize);
  const pagedPapers = sortedPapers.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function exportCSV(papersToExport: Paper[], filename: string) {
    const headers = ["SN", "Paper Title", "Authors", "DOI", "Year", "Author Regions", "Focus Region", "Domain", ""];
    const rows = papersToExport.map((p) => headers.map((h) => String(p[h] || "").replace(/\n/g, " ")));
    const csv = [
      headers.join(","),
      ...rows.map((r) => r.map((f) => `"${f.replace(/"/g, '""')}"`).join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    saveAs(blob, filename);
  }

  const tooltipStyle = {
    borderRadius: "10px",
    border: "1px solid #e5e7eb",
    boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
    fontSize: "12px",
  };

  return (
    <div className="w-full bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
            <p className="text-gray-500 font-medium">Loading research data…</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl font-medium">
            {error}
          </div>
        ) : papers.length === 0 ? (
          <div className="bg-amber-50 border border-amber-200 text-amber-700 p-4 rounded-xl font-medium">
            No data found. Please ensure papers.csv is present in the public directory and accessible at /papers.csv.
          </div>
        ) : (
          <>
            {/* ── Page header ──────────────────────────────────────────── */}
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-gray-900">Survey Overview</h1>
              <p className="text-sm text-gray-500 mt-1">Algorithmic bias research landscape · {years}</p>
            </div>

            {/* ── KPI Cards ────────────────────────────────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
              <div className="bg-gradient-to-br from-blue-600 to-blue-700 text-white p-6 rounded-2xl shadow-md">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-blue-100 text-xs font-semibold uppercase tracking-wider">Total Papers</p>
                    <p className="text-4xl font-bold mt-2">{totalPapers}</p>
                    <p className="text-blue-200 text-xs mt-2">Survey corpus</p>
                  </div>
                  <div className="bg-white/20 p-3 rounded-xl">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 text-white p-6 rounded-2xl shadow-md">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-emerald-100 text-xs font-semibold uppercase tracking-wider">Years Covered</p>
                    <p className="text-3xl font-bold mt-2">{years}</p>
                    <p className="text-emerald-200 text-xs mt-2">Research period</p>
                  </div>
                  <div className="bg-white/20 p-3 rounded-xl">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-violet-600 to-violet-700 text-white p-6 rounded-2xl shadow-md">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-violet-100 text-xs font-semibold uppercase tracking-wider">Research Domains</p>
                    <p className="text-4xl font-bold mt-2">{totalDomains}</p>
                    <p className="text-violet-200 text-xs mt-2">Distinct areas</p>
                  </div>
                  <div className="bg-white/20 p-3 rounded-xl">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-amber-500 to-orange-500 text-white p-6 rounded-2xl shadow-md">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-amber-100 text-xs font-semibold uppercase tracking-wider">Countries / Regions</p>
                    <p className="text-4xl font-bold mt-2">{totalRegions}</p>
                    <p className="text-amber-100 text-xs mt-2">Global reach</p>
                  </div>
                  <div className="bg-white/20 p-3 rounded-xl">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* Skipped papers warning */}
            {skippedCount > 0 && (
              <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-sm text-amber-800">
                <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <div>
                  <span className="font-semibold">{skippedCount} papers skipped</span> — missing year or region data.{" "}
                  <span className="text-amber-700">{skippedPapers.map((p) => p["SN"] || p["Paper Title"]).join(", ")}</span>
                </div>
              </div>
            )}

            {/* ── Row 1: Timeline + Domain Pie ─────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Publication Timeline */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-200 p-6">
                <div className="flex justify-between items-start mb-5">
                  <div>
                    <h2 className="text-base font-semibold text-gray-900">Publication Timeline</h2>
                    <p className="text-xs text-gray-400 mt-0.5">{years}</p>
                  </div>
                  <button
                    title="Download chart"
                    className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                    onClick={() => downloadChartAsImage("timeline-chart", "publication-timeline")}
                  >
                    <DownloadIcon />
                  </button>
                </div>
                <div id="timeline-chart">
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={yearData} margin={{ right: 20, top: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis
                        dataKey="year"
                        type="number"
                        domain={[
                          yearData.length > 0 ? yearData[0].year : "auto",
                          yearData.length > 0 ? yearData[yearData.length - 1].year : "auto",
                        ]}
                        tick={{ fontSize: 11, fill: "#9ca3af" }}
                        interval={0}
                        allowDuplicatedCategory={false}
                        minTickGap={5}
                        padding={{ right: 20 }}
                        label={{ value: "Year", position: "insideBottom", offset: -5, fill: "#6b7280", fontSize: 11 }}
                      />
                      <YAxis
                        dataKey="count"
                        tick={{ fontSize: 11, fill: "#9ca3af" }}
                        label={{ value: "Count", angle: -90, position: "insideLeft", fill: "#6b7280", fontSize: 11 }}
                      />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="count"
                        stroke="#2563eb"
                        strokeWidth={2.5}
                        dot={{ fill: "#2563eb", strokeWidth: 0, r: 4 }}
                        activeDot={{ r: 6, strokeWidth: 0 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Domain Distribution Pie Chart */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-200 p-6">
                <div className="flex justify-between items-start mb-5">
                  <div>
                    <h2 className="text-base font-semibold text-gray-900">Research Domain Distribution</h2>
                    <p className="text-xs text-gray-400 mt-0.5">By paper count</p>
                  </div>
                  <button
                    title="Download chart"
                    className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                    onClick={async () => {
                      const canvas = document.createElement("canvas");
                      const ctx = canvas.getContext("2d");
                      if (!ctx) { alert("Canvas not supported in this browser"); return; }
                      canvas.width = 900;
                      canvas.height = 750;
                      ctx.fillStyle = "#ffffff";
                      ctx.fillRect(0, 0, canvas.width, canvas.height);
                      ctx.strokeStyle = "#e5e7eb";
                      ctx.lineWidth = 1;
                      ctx.strokeRect(0, 0, canvas.width, canvas.height);
                      ctx.fillStyle = "#374151";
                      ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
                      ctx.textAlign = "center";
                      ctx.fillText("Research Domain Distribution", canvas.width / 2, 50);
                      const centerX = canvas.width / 2;
                      const centerY = 280;
                      const radius = 140;
                      let currentAngle = -Math.PI / 2;
                      domainData.forEach((entry) => {
                        const sliceAngle = (entry.count / domainData.reduce((sum, d) => sum + d.count, 0)) * 2 * Math.PI;
                        ctx.save();
                        ctx.shadowColor = "rgba(0, 0, 0, 0.1)";
                        ctx.shadowBlur = 4;
                        ctx.shadowOffsetX = 2;
                        ctx.shadowOffsetY = 2;
                        ctx.beginPath();
                        ctx.moveTo(centerX, centerY);
                        ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
                        ctx.closePath();
                        ctx.fillStyle = entry.color;
                        ctx.fill();
                        ctx.restore();
                        ctx.strokeStyle = "#ffffff";
                        ctx.lineWidth = 2;
                        ctx.stroke();
                        const labelAngle = currentAngle + sliceAngle / 2;
                        const labelRadius = parseFloat(entry.percentage) < 5 ? radius * 1.2 : radius * 0.75;
                        const labelX = centerX + Math.cos(labelAngle) * labelRadius;
                        const labelY = centerY + Math.sin(labelAngle) * labelRadius;
                        if (parseFloat(entry.percentage) >= 1) {
                          ctx.fillStyle = parseFloat(entry.percentage) < 5 ? "#374151" : "#ffffff";
                          ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
                          ctx.textAlign = "center";
                          ctx.textBaseline = "middle";
                          if (parseFloat(entry.percentage) >= 5) {
                            ctx.strokeStyle = "#000000";
                            ctx.lineWidth = 3;
                            ctx.strokeText(`${entry.percentage}%`, labelX, labelY);
                          }
                          ctx.fillText(`${entry.percentage}%`, labelX, labelY);
                        }
                        currentAngle += sliceAngle;
                      });
                      const legendStartY = centerY + radius + 80;
                      const legendItemHeight = 32;
                      let maxTextWidth = 0;
                      domainData.forEach((entry) => {
                        const text = `${formatDomainForDisplay(entry.domain)} (${entry.percentage}%)`;
                        ctx.font = '16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
                        const textWidth = ctx.measureText(text).width;
                        maxTextWidth = Math.max(maxTextWidth, textWidth);
                      });
                      const legendCenterX = (canvas.width - maxTextWidth - 40) / 2;
                      domainData.forEach((entry, index) => {
                        const y = legendStartY + index * legendItemHeight;
                        ctx.beginPath();
                        ctx.arc(legendCenterX + 12, y, 8, 0, 2 * Math.PI);
                        ctx.fillStyle = entry.color;
                        ctx.fill();
                        ctx.strokeStyle = "#e5e7eb";
                        ctx.lineWidth = 1;
                        ctx.stroke();
                        ctx.fillStyle = "#374151";
                        ctx.font = '16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
                        ctx.textAlign = "left";
                        ctx.textBaseline = "middle";
                        ctx.fillText(`${formatDomainForDisplay(entry.domain)} (${entry.percentage}%)`, legendCenterX + 28, y);
                      });
                      canvas.toBlob((blob) => {
                        if (blob) {
                          const url = URL.createObjectURL(blob);
                          const link = document.createElement("a");
                          link.href = url;
                          link.download = "domain-distribution.png";
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                          URL.revokeObjectURL(url);
                        }
                      }, "image/png");
                    }}
                  >
                    <DownloadIcon />
                  </button>
                </div>
                <div id="domain-chart" style={{ minHeight: "460px" }}>
                  <ResponsiveContainer width="100%" height={380}>
                    <PieChart>
                      <Pie
                        data={domainData.map((entry) => ({ ...entry, domain: formatDomainForDisplay(entry.domain) }))}
                        cx="50%"
                        cy="45%"
                        labelLine={true}
                        label={({ percent }) => {
                          if (!percent || percent < 0.01) return "";
                          return `${(percent * 100).toFixed(1)}%`;
                        }}
                        outerRadius={120}
                        dataKey="count"
                        nameKey="domain"
                      >
                        {domainData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value, name) => [value, formatDomainForDisplay(name as string)]}
                        contentStyle={tooltipStyle}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 px-2 mt-2">
                    {domainData.map((entry) => (
                      <div key={entry.domain} className="flex items-center gap-1.5">
                        <span style={{ backgroundColor: entry.color, width: 10, height: 10, borderRadius: "50%", display: "inline-block", flexShrink: 0 }} />
                        <span className="text-xs text-gray-600">{formatDomainForDisplay(entry.domain)} ({entry.percentage}%)</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* ── Row 2: Author Regions ─────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* First Author Regions */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-200 p-6">
                <div className="flex justify-between items-start mb-1">
                  <div>
                    <h2 className="text-base font-semibold text-gray-900">First Author Regions</h2>
                    <p className="text-xs text-gray-400 mt-0.5">By first author's country</p>
                  </div>
                  <button
                    title="Download chart"
                    className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                    onClick={() => downloadChartAsImage("first-author-regions-chart", "first-author-regions")}
                  >
                    <DownloadIcon />
                  </button>
                </div>
                {firstAuthorRegionData.length === 0 ? (
                  <div className="flex items-center justify-center h-40 text-gray-400 text-sm">No data available.</div>
                ) : (
                  <div id="first-author-regions-chart" style={{ width: "100%", overflowX: "auto" }}>
                    <ResponsiveContainer width="100%" height={380}>
                      <BarChart data={firstAuthorRegionData} margin={{ top: 20, right: 20, left: 10, bottom: 80 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="region" angle={-45} textAnchor="end" interval={0} height={100} tick={{ fontSize: 11, fill: "#6b7280" }} label={{ value: "Country", position: "insideBottom", offset: -60, fill: "#6b7280", fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} label={{ value: "Count", angle: -90, position: "insideLeft", fill: "#6b7280", fontSize: 11 }} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Bar dataKey="count" fill="#2563eb" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* All Authors Regions */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-200 p-6">
                <div className="flex justify-between items-start mb-1">
                  <div>
                    <h2 className="text-base font-semibold text-gray-900">All Authors Regions</h2>
                    <p className="text-xs text-gray-400 mt-0.5">Including all co-authors</p>
                  </div>
                  <button
                    title="Download chart"
                    className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                    onClick={() => downloadChartAsImage("all-authors-regions-chart", "all-authors-regions")}
                  >
                    <DownloadIcon />
                  </button>
                </div>
                {allAuthorsRegionData.length === 0 ? (
                  <div className="flex items-center justify-center h-40 text-gray-400 text-sm">No data available.</div>
                ) : (
                  <div id="all-authors-regions-chart" style={{ width: "100%", overflowX: "auto" }}>
                    <ResponsiveContainer width="100%" height={380}>
                      <BarChart data={allAuthorsRegionData} margin={{ top: 20, right: 20, left: 10, bottom: 80 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="region" angle={-45} textAnchor="end" interval={0} height={100} tick={{ fontSize: 11, fill: "#6b7280" }} label={{ value: "Country", position: "insideBottom", offset: -60, fill: "#6b7280", fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} label={{ value: "Count", angle: -90, position: "insideLeft", fill: "#6b7280", fontSize: 11 }} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Bar dataKey="count" fill="#059669" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>

            {/* ── Geographic Map ────────────────────────────────────────── */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-200 p-6 mb-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-base font-semibold text-gray-900">Research Domain Geographic Distribution</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Countries colored by dominant research domain · hover for breakdown</p>
                </div>
                <button
                  title="Download map"
                  className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                  onClick={() => downloadChartAsImage("map-chart", "geographic-distribution")}
                >
                  <DownloadIcon />
                </button>
              </div>

              {/* Domain filter pills */}
              <div className="space-y-3 mb-4">
                <p className="text-xs text-gray-500">
                  Click domains to filter · hold Ctrl/Cmd for multi-select
                </p>
                <div className="flex flex-wrap gap-2">
                  {domainData.map((entry) => (
                    <button
                      key={entry.domain}
                      type="button"
                      className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-all ${
                        selectedDomains.includes(entry.domain) || selectedDomain === entry.domain
                          ? "border-blue-400 bg-blue-50 text-blue-700 shadow-sm font-medium"
                          : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                      }`}
                      onClick={(e) => {
                        if (e.ctrlKey || e.metaKey) {
                          if (selectedDomains.includes(entry.domain)) {
                            setSelectedDomains((prev) => prev.filter((d) => d !== entry.domain));
                          } else {
                            setSelectedDomains((prev) => [...prev, entry.domain]);
                          }
                          setSelectedDomain(null);
                        } else {
                          setSelectedDomain(selectedDomain === entry.domain ? null : entry.domain);
                          setSelectedDomains([]);
                        }
                      }}
                    >
                      <span style={{ backgroundColor: entry.color, width: 8, height: 8, borderRadius: "50%", display: "inline-block" }} />
                      {formatDomainForDisplay(entry.domain)}
                    </button>
                  ))}
                </div>

                {selectedDomains.length > 0 && (
                  <div className="flex items-center gap-2 text-xs text-blue-700 bg-blue-50 border border-blue-100 px-3 py-2 rounded-lg">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    Multi-select active: {selectedDomains.length} domain{selectedDomains.length > 1 ? "s" : ""} selected · countries show dominant domain with borders for secondary
                  </div>
                )}

                <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
                  <span className="text-xs font-medium text-gray-600">Author mapping:</span>
                  <div className="flex gap-1">
                    <button
                      className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${
                        !useFirstAuthorOnly ? "bg-blue-600 text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                      onClick={() => setUseFirstAuthorOnly(false)}
                    >
                      All Authors
                    </button>
                    <button
                      className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${
                        useFirstAuthorOnly ? "bg-blue-600 text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                      onClick={() => setUseFirstAuthorOnly(true)}
                    >
                      First Author Only
                    </button>
                  </div>
                  <span className="text-xs text-gray-400">
                    {useFirstAuthorOnly ? "Colored by first author's domain" : "Colored by all authors' domains"}
                  </span>
                </div>
              </div>

              <div
                id="map-chart"
                style={{ width: "100%", maxWidth: "100%", height: 500, marginBottom: 48, overflow: "hidden" }}
              >
                <ComposableMap projection="geoEqualEarth" projectionConfig={{ scale: 147 }}>
                  <ZoomableGroup>
                    <Geographies geography="https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json">
                      {({ geographies }) =>
                        geographies.map((geo) => {
                          const countryName: string =
                            geo.properties.NAME ||
                            geo.properties.name ||
                            geo.properties.NAME_EN ||
                            geo.properties.NAME_LONG ||
                            "";
                          const altName = Object.keys(countryToGeoName).find(
                            (key) => countryToGeoName[key] === countryName
                          );
                          const countryData =
                            countryDomainMap[countryName] ||
                            (altName ? countryDomainMap[altName] : undefined);
                          let fillColor = "#e2e8f0";
                          let strokeColor = "#ffffff";
                          let strokeWidth = 0.5;
                          let strokeDasharray = "";
                          let isDominant = false;
                          let isPresent = false;
                          let hasSecondaryDomains = false;

                          if (countryData) {
                            const countryPapers = validPapers.filter((p) => {
                              const authorRegions = (String(p["Author Regions"] || "") || "").trim();
                              if (!authorRegions) return false;
                              if (useFirstAuthorOnly) {
                                const firstRegion = authorRegions.split(";")[0].trim();
                                return authorRegionToCountryMap[firstRegion] === countryName;
                              }
                              const regions = authorRegions.split(";").map((r) => r.trim()).filter(Boolean);
                              return regions.some((region) => authorRegionToCountryMap[region] === countryName);
                            });

                            if (selectedDomains.length > 0) {
                              const countryDomainCounts: Record<string, number> = {};
                              countryPapers.forEach((p) => {
                                const domain = (String(p["Domain"] || "") || "").trim();
                                if (selectedDomains.includes(domain)) {
                                  countryDomainCounts[domain] = (countryDomainCounts[domain] || 0) + 1;
                                }
                              });
                              const presentDomains = Object.keys(countryDomainCounts);
                              if (presentDomains.length > 0) {
                                const dominantDomain = presentDomains.reduce((a, b) =>
                                  countryDomainCounts[a] > countryDomainCounts[b] ? a : b
                                );
                                const domainEntry = domainData.find(
                                  (d) => d.domain.toLowerCase() === dominantDomain.toLowerCase()
                                );
                                fillColor = domainEntry?.color || "#e2e8f0";
                                isDominant = true;
                                const secondaryDomains = presentDomains.filter((d) => d !== dominantDomain);
                                if (secondaryDomains.length > 0) {
                                  hasSecondaryDomains = true;
                                  const prominentSecondary = secondaryDomains.reduce((a, b) =>
                                    countryDomainCounts[a] > countryDomainCounts[b] ? a : b
                                  );
                                  const secondaryEntry = domainData.find(
                                    (d) => d.domain.toLowerCase() === prominentSecondary.toLowerCase()
                                  );
                                  strokeColor = secondaryEntry?.color || "#1f2937";
                                  strokeWidth = 3;
                                  strokeDasharray = "4,2";
                                }
                              }
                            } else if (selectedDomain) {
                              isDominant = countryData.domain.toLowerCase() === selectedDomain.toLowerCase();
                              isPresent = countryPapers.some(
                                (p) =>
                                  (String(p["Domain"] || "") || "").trim().toLowerCase() === selectedDomain.toLowerCase()
                              );
                              const domainEntry = domainData.find(
                                (d) => d.domain.toLowerCase() === selectedDomain.toLowerCase()
                              );
                              if (isDominant) fillColor = domainEntry ? domainEntry.color : "#e2e8f0";
                              else if (isPresent) fillColor = domainEntry ? `${domainEntry.color}80` : "#cbd5e1";
                            } else {
                              const domainIndex = domainData.findIndex(
                                (d) => d.domain.toLowerCase() === (String(countryData?.domain) || "").toLowerCase()
                              );
                              fillColor = domainData[domainIndex]?.color || "#e2e8f0";
                              isDominant = true;
                            }
                          }

                          return (
                            <Geography
                              key={geo.rsmKey}
                              geography={geo}
                              fill={fillColor}
                              stroke={strokeColor}
                              strokeWidth={strokeWidth}
                              strokeDasharray={strokeDasharray}
                              style={{
                                default: { outline: "none" },
                                hover: {
                                  fill: countryData ? "#0f172a" : "#cbd5e1",
                                  outline: "none",
                                  cursor: "pointer",
                                },
                                pressed: { outline: "none" },
                              }}
                              onMouseEnter={() => {
                                if (countryData) {
                                  let tooltipContent = `${countryName}\nAuthor Contributions: ${countryData.count}\n\n`;

                                  if (selectedDomains.length > 0) {
                                    const countryPapers = validPapers.filter((p) => {
                                      const authorRegions = (String(p["Author Regions"] || "") || "").trim();
                                      if (!authorRegions) return false;
                                      const regions = authorRegions.split(";").map((r) => r.trim()).filter(Boolean);
                                      return regions.some((region) => authorRegionToCountryMap[region] === countryName);
                                    });
                                    const selectedDomainCounts: Record<string, number> = {};
                                    countryPapers.forEach((p) => {
                                      const domain = (String(p["Domain"] || "") || "").trim();
                                      if (selectedDomains.includes(domain)) {
                                        selectedDomainCounts[domain] = (selectedDomainCounts[domain] || 0) + 1;
                                      }
                                    });
                                    const sortedSelected = Object.entries(selectedDomainCounts)
                                      .sort((a, b) => b[1] - a[1])
                                      .map(([domain, count]) => `${formatDomainForDisplay(domain)}: ${count}`)
                                      .join("\n");
                                    tooltipContent +=
                                      selectedDomainCounts && Object.keys(selectedDomainCounts).length > 0
                                        ? `Selected Domains:\n${sortedSelected}`
                                        : "No papers in selected domains";
                                    if (hasSecondaryDomains) {
                                      const secondaryDomains = Object.keys(selectedDomainCounts).filter(
                                        (d) => selectedDomainCounts[d] < Math.max(...Object.values(selectedDomainCounts))
                                      );
                                      tooltipContent += `\n\nColored border shows secondary: ${secondaryDomains.map((d) => formatDomainForDisplay(d)).join(", ")}`;
                                    }
                                  } else {
                                    const domainBreakdown = Object.entries(countryData.domainBreakdown)
                                      .sort((a, b) => b[1] - a[1])
                                      .map(([domain, count]) => `${formatDomainForDisplay(domain)}: ${count}`)
                                      .join("\n");
                                    tooltipContent += domainBreakdown;
                                  }

                                  setTooltip({ content: tooltipContent, x: 0, y: 0 });
                                }
                              }}
                              onMouseMove={(event: any) => {
                                if (countryData && tooltip) {
                                  setTooltip({ ...tooltip, x: event.clientX || 0, y: (event.clientY || 0) - 10 });
                                }
                              }}
                              onMouseLeave={() => setTooltip(null)}
                            />
                          );
                        })
                      }
                    </Geographies>
                  </ZoomableGroup>
                </ComposableMap>
                {tooltip && (
                  <div
                    style={{
                      position: "fixed",
                      left: tooltip.x,
                      top: tooltip.y,
                      backgroundColor: "rgba(15,23,42,0.92)",
                      color: "white",
                      padding: "10px 14px",
                      borderRadius: "10px",
                      fontSize: "12px",
                      pointerEvents: "none",
                      zIndex: 1000,
                      whiteSpace: "pre-line",
                      transform: "translate(-50%, -100%)",
                      maxWidth: "280px",
                      lineHeight: "1.6",
                    }}
                  >
                    {tooltip.content}
                  </div>
                )}
              </div>
            </div>

            {/* ── Key Research Insights ─────────────────────────────────── */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
              <h2 className="text-base font-semibold text-gray-900 mb-5">Key Research Insights</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <span className="w-6 h-6 bg-blue-100 text-blue-700 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                    </span>
                    Research Trends
                  </h3>
                  <ul className="space-y-2.5">
                    {peakYear.count > 0 && (
                      <li className="flex items-start gap-2 text-sm text-gray-600">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 flex-shrink-0" />
                        Peak activity in <strong className="text-gray-800 mx-1">{peakYear.year}</strong> with {peakYear.count} publications
                      </li>
                    )}
                    {growthPeriod && (
                      <li className="flex items-start gap-2 text-sm text-gray-600">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 flex-shrink-0" />
                        Research period: <strong className="text-gray-800 ml-1">{growthPeriod}</strong>
                      </li>
                    )}
                    {llmInsight && (
                      <li className="flex items-start gap-2 text-sm text-gray-600">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 flex-shrink-0" />
                        {llmInsight}
                      </li>
                    )}
                    {fairnessInsight && (
                      <li className="flex items-start gap-2 text-sm text-gray-600">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 flex-shrink-0" />
                        {fairnessInsight}
                      </li>
                    )}
                    <li className="flex items-start gap-2 text-sm text-gray-600">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 flex-shrink-0" />
                      {totalDomains} distinct research domains covered
                    </li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <span className="w-6 h-6 bg-emerald-100 text-emerald-700 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </span>
                    Geographic Distribution
                  </h3>
                  <ul className="space-y-2.5">
                    {topRegion && (
                      <li className="flex items-start gap-2 text-sm text-gray-600">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-2 flex-shrink-0" />
                        <strong className="text-gray-800 mr-1">{topRegion.region}</strong> leads with {Math.round((topRegion.count / totalPapers) * 100)}% of publications
                      </li>
                    )}
                    {hasEurope && (
                      <li className="flex items-start gap-2 text-sm text-gray-600">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-2 flex-shrink-0" />
                        Strong European presence (UK, Germany, etc.)
                      </li>
                    )}
                    {hasAsia && (
                      <li className="flex items-start gap-2 text-sm text-gray-600">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-2 flex-shrink-0" />
                        Growing Asian contribution (China, India, etc.)
                      </li>
                    )}
                    <li className="flex items-start gap-2 text-sm text-gray-600">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-2 flex-shrink-0" />
                      Global collaborative research trend
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* ── Papers Table ──────────────────────────────────────────── */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex justify-between items-center mb-5">
                <h2 className="text-base font-semibold text-gray-900">All Papers</h2>
                <div className="flex gap-2">
                  <button
                    className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                    onClick={() => exportCSV(sortedPapers, "papers.csv")}
                  >
                    Export CSV
                  </button>
                  <button
                    className="px-4 py-2 text-sm font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                    onClick={() => {
                      setSearchQuery("");
                      setFilterYear("");
                      setFilterRegion("");
                      setFilterDomain("");
                      setFilterAuthor("");
                    }}
                  >
                    Clear Filters
                  </button>
                </div>
              </div>

              {/* Filter bar */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-4">
                <div className="flex flex-wrap gap-3">
                  <div className="relative flex-1 min-w-48">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      type="text"
                      placeholder="Search by title, author, or keyword…"
                      className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-300 transition"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <select
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-300 transition"
                    value={filterYear}
                    onChange={(e) => setFilterYear(e.target.value)}
                  >
                    <option value="">All Years</option>
                    {Array.from(new Set(papers.map((p) => (String(p["Year"] || "") || "").trim()).filter(Boolean))).sort().map((year) => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                  <select
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-300 transition"
                    value={filterRegion}
                    onChange={(e) => setFilterRegion(e.target.value)}
                  >
                    <option value="">All Regions</option>
                    {uniqueAuthorRegions.map((region: string) => (
                      <option key={region} value={region}>{region}</option>
                    ))}
                  </select>
                  <select
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-300 transition"
                    value={filterDomain}
                    onChange={(e) => setFilterDomain(e.target.value)}
                  >
                    <option value="">All Domains</option>
                    {Array.from(new Set(papers.map((p) => (String(p["Domain"] || "") || "").trim()).filter(Boolean))).sort().map((domain) => (
                      <option key={domain} value={domain}>{domain}</option>
                    ))}
                  </select>
                  <select
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-300 transition"
                    value={filterAuthor}
                    onChange={(e) => setFilterAuthor(e.target.value)}
                  >
                    <option value="">All Authors</option>
                    {uniqueAuthors.map((author) => (
                      <option key={author} value={author}>{author}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="text-xs text-gray-500 mb-3 flex items-center gap-2">
                Showing {sortedPapers.length} of {papers.length} papers
                {(searchQuery || filterYear || filterRegion || filterDomain || filterAuthor) && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-blue-700 bg-blue-50 font-medium border border-blue-100">
                    filtered
                  </span>
                )}
              </div>

              <div className="overflow-x-auto rounded-xl border border-gray-100">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      {["SN", "Paper Title", "Authors", "DOI", "Year", "Author Regions", "Focus Region", "Domain", "Abstract", "Details"].map((col) => (
                        <th
                          key={col}
                          className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer select-none hover:bg-gray-100 transition-colors whitespace-nowrap"
                          onClick={() => {
                            if (col === "") return;
                            const key = col === "Year" ? "Year" : col;
                            setSortConfig(
                              sortConfig && sortConfig.key === key
                                ? { key, direction: sortConfig.direction === "asc" ? "desc" : "asc" }
                                : { key, direction: "asc" }
                            );
                          }}
                        >
                          <span className="flex items-center gap-1">
                            {col}
                            {sortConfig && col === (sortConfig.key === "Year" ? "Year" : sortConfig.key) && (
                              <span className="text-blue-500">{sortConfig.direction === "asc" ? "↑" : "↓"}</span>
                            )}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {pagedPapers.map((paper, idx) => {
                      const doi = String(paper["DOI"] || "").trim();
                      const doiHref = doi ? (doi.startsWith("http") ? doi : `https://${doi}`) : "";
                      const doiDisplay = doi.replace(/^https?:\/\/(dx\.)?doi\.org\//, "");
                      const authors = String(paper["Authors"] || "").trim();
                      const authorParts = authors.split(";").map((a) => a.trim()).filter(Boolean);
                      const authorDisplay = authorParts.length > 3
                        ? `${authorParts.slice(0, 2).join("; ")}; +${authorParts.length - 2} more`
                        : authors;
                      const regions = String(paper["Author Regions"] || "").trim();
                      const regionParts = regions.split(";").map((r) => r.trim()).filter(Boolean);
                      const regionDisplay = regionParts.length > 4
                        ? `${regionParts.slice(0, 4).join("; ")} +${regionParts.length - 4}`
                        : regions;
                      return (
                        <tr
                          key={paper["SN"]}
                          className={`hover:bg-blue-50 transition-colors align-top ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/40"}`}
                        >
                          <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{paper["SN"]}</td>
                          <td className="px-4 py-3 text-gray-900 font-medium" style={{ maxWidth: 240, minWidth: 160 }}>
                            <span className="line-clamp-3 text-sm">{paper["Paper Title"]}</span>
                          </td>
                          <td className="px-4 py-3 text-gray-500 text-xs" style={{ maxWidth: 180 }}>
                            {authorDisplay}
                          </td>
                          <td className="px-4 py-3" style={{ maxWidth: 120, minWidth: 80 }}>
                            {doiHref ? (
                              <a
                                href={doiHref}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={doi}
                                className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs font-medium whitespace-nowrap overflow-hidden"
                                style={{ maxWidth: 110 }}
                              >
                                <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                                <span className="truncate">{doiDisplay.slice(0, 18)}{doiDisplay.length > 18 ? "…" : ""}</span>
                              </a>
                            ) : ""}
                          </td>
                          <td className="px-4 py-3 text-gray-600 whitespace-nowrap text-sm">{(String(paper["Year"] || "") || "").trim()}</td>
                          <td className="px-4 py-3 text-gray-500 text-xs" style={{ maxWidth: 160 }}>
                            {regionDisplay}
                          </td>
                          <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{paper["Focus Region"]}</td>
                          <td className="px-4 py-3" style={{ minWidth: 140 }}>
                            {paper["Domain"] && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                                {paper["Domain"]}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-400 text-xs" style={{ maxWidth: 160 }}>
                            <span className="line-clamp-2">
                              {(paper["Abstract"] || "").slice(0, 80)}
                              {(paper["Abstract"] || "").length > 80 ? "…" : ""}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <button
                              className="text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline"
                              onClick={() => setModalPaper(paper)}
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {pagedPapers.length === 0 && (
                      <tr>
                        <td colSpan={10} className="px-4 py-12 text-center">
                          <div className="flex flex-col items-center gap-2 text-gray-400">
                            <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                            </svg>
                            <span className="text-sm">No papers found.</span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex justify-between items-center mt-5 pt-4 border-t border-gray-100">
                <button
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Previous
                </button>
                <span className="text-sm text-gray-500">
                  Page <strong className="text-gray-900">{currentPage}</strong> of <strong className="text-gray-900">{totalPages}</strong>
                </span>
                <button
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              {/* Paper detail modal */}
              {modalPaper && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                  <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
                    <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-5">
                      <div className="flex justify-between items-start gap-3">
                        <h3 className="text-base font-semibold text-white leading-snug">{modalPaper["Paper Title"]}</h3>
                        <button
                          className="p-1 text-blue-200 hover:text-white transition-colors flex-shrink-0"
                          onClick={() => setModalPaper(null)}
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-gray-50 rounded-xl p-3">
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Serial No.</p>
                          <p className="text-sm text-gray-900 mt-0.5">{modalPaper["SN"]}</p>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-3">
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Year</p>
                          <p className="text-sm text-gray-900 mt-0.5">{(String(modalPaper["Year"] || "") || "").trim()}</p>
                        </div>
                      </div>
                      <div className="bg-gray-50 rounded-xl p-3">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Authors</p>
                        <p className="text-sm text-gray-900 mt-0.5">{modalPaper["Authors"]}</p>
                      </div>
                      <div className="bg-gray-50 rounded-xl p-3">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Author Regions</p>
                        <p className="text-sm text-gray-900 mt-0.5">{String(modalPaper["Author Regions"] || "") || "—"}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-gray-50 rounded-xl p-3">
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Domain</p>
                          <p className="text-sm text-gray-900 mt-0.5">{modalPaper["Domain"] || "—"}</p>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-3">
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Focus Region</p>
                          <p className="text-sm text-gray-900 mt-0.5">{modalPaper["Focus Region"] || "Not specified"}</p>
                        </div>
                      </div>
                      {modalPaper["Abstract"] && (
                        <div className="bg-gray-50 rounded-xl p-3">
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Abstract</p>
                          <p className="text-sm text-gray-600 leading-relaxed">{modalPaper["Abstract"]}</p>
                        </div>
                      )}
                    </div>
                    <div className="border-t border-gray-100 p-4 flex justify-end">
                      <button
                        className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                        onClick={() => exportCSV([modalPaper], `paper_${modalPaper["SN"] || "detail"}.csv`)}
                      >
                        Export This Paper
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default BiasResearchDashboard;
