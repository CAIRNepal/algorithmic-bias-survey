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
  LineChart,
  Line,
  AreaChart,
  Area,
  ComposedChart,
  Cell,
} from "recharts";
import { useState, useMemo, useEffect } from "react";
import CoAuthorNetworkGraph from "./CoAuthorNetworkGraph";
import SemanticClusterChart from "./SemanticClusterChart";
import Select from "react-select";
import html2canvas from "html2canvas";

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

type YearData = {
  year: number;
  count: number;
  domains: Set<string>;
};

type DomainData = {
  domain: string;
  count: number;
  papers: Paper[];
};

type RegionData = {
  region: string;
  count: number;
  domains: Set<string>;
};

type AuthorData = {
  name: string;
  papers: number;
  domains: Set<string>;
  regions: Set<string>;
  collaborations: Set<string>;
  primaryRegion: string;
};

const AdvancedAnalytics = ({ papers }: { papers: Paper[] }) => {
  // Multi-select filters for collaborations
  const [selectedAuthors, setSelectedAuthors] = useState<string[]>([]);
  const [selectedDomains, setSelectedDomains] = useState<string[]>([]);
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [selectedInstitutions, setSelectedInstitutions] = useState<string[]>(
    []
  );

  // State for pagination
  const [authorStatsPage, setAuthorStatsPage] = useState(1);
  const [instStatsPage, setInstStatsPage] = useState(1);
  const statsPageSize = 10;

  const [authorStatsExpanded, setAuthorStatsExpanded] = useState(false);
  const [institutionStatsExpanded, setInstitutionStatsExpanded] = useState(false);

  // Network graph controls
  const [networkMaxNodes, setNetworkMaxNodes] = useState(50);

  // Author search in network section
  const [networkAuthorSearch, setNetworkAuthorSearch] = useState("");
  const [networkSearchOpen, setNetworkSearchOpen] = useState(false);

  // Author detail modal (co-author network click)
  const [selectedNetworkAuthor, setSelectedNetworkAuthor] = useState<{ name: string; variants: string[] } | null>(null);

  // Papers table pagination
  const [papersPage, setPapersPage] = useState(1);
  const paperPageSize = 15;

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

  // Process papers - only use CSV fields
  const processedPapers = papers.map((paper) => ({
    ...paper,
    year: Number(paper["Year"]) || 0,
    authors: String(paper["Authors"] || "")
      .split(";")
      .map((a: string) => a.trim())
      .filter(Boolean),
    affiliations: String(paper["Affiliations"] || "")
      .split(";")
      .map((a: string) => a.trim())
      .filter(Boolean),
    authorRegions: String(paper["Author Regions"] || "")
      .split(";")
      .map((r: string) => r.trim())
      .filter(Boolean),
    domain: String(paper["Domain"] || "").trim(),
    focusRegion: String(paper["Focus Region"] || "").trim(),
  }));

  // Get all unique authors, domains, regions, and institutions for filter options
  const allAuthors = useMemo(() => {
    const set = new Set<string>();
    papers.forEach((paper) => {
      String(paper["Authors"] || "")
        .split(";")
        .map((a) => a.trim())
        .forEach((a) => a && set.add(a));
    });
    return Array.from(set).sort();
  }, [papers]);
  const allDomains = useMemo(() => {
    const set = new Set<string>();
    papers.forEach((paper) => {
      const d = String(paper["Domain"] || "").trim();
      if (d) set.add(d);
    });
    return Array.from(set).sort();
  }, [papers]);
  const allRegions = useMemo(() => {
    const set = new Set<string>();
    papers.forEach((paper) => {
      String(paper["Author Regions"] || "")
        .split(";")
        .map((r) => r.trim())
        .forEach((r) => r && set.add(r));
    });
    return Array.from(set).sort();
  }, [papers]);
  const allInstitutions = useMemo(() => {
    const set = new Set<string>();
    papers.forEach((paper) => {
      String(paper["Affiliations"] || "")
        .split(";")
        .map((a) => a.trim())
        .forEach((a) => a && set.add(a));
    });
    return Array.from(set).sort();
  }, [papers]);

  // Filter processedPapers for collaborations tab
  const filteredPapers = useMemo(() => {
    return processedPapers.filter((paper) => {
      // Author filter: at least one selected author is in this paper
      const authorMatch =
        selectedAuthors.length === 0 ||
        paper.authors.some((a: string) => selectedAuthors.includes(a));
      // Domain filter: paper domain is in selected domains
      const domainMatch =
        selectedDomains.length === 0 || selectedDomains.includes(paper.domain);
      // Region filter: at least one author region is in selected regions
      const regionMatch =
        selectedRegions.length === 0 ||
        paper.authorRegions.some((r: string) => selectedRegions.includes(r));
      // Institution filter: at least one affiliation is in selected institutions
      const institutionMatch =
        selectedInstitutions.length === 0 ||
        paper.affiliations.some((aff: string) =>
          selectedInstitutions.includes(aff)
        );
      return authorMatch && domainMatch && regionMatch && institutionMatch;
    });
  }, [
    processedPapers,
    selectedAuthors,
    selectedDomains,
    selectedRegions,
    selectedInstitutions,
  ]);

  // Year analysis
  const yearData = processedPapers.reduce(
    (acc: Record<number, YearData>, paper) => {
      const year = paper.year;
      if (year) {
        if (!acc[year]) acc[year] = { year, count: 0, domains: new Set() };
        acc[year].count++;
        acc[year].domains.add(paper.domain || "Unknown");
      }
      return acc;
    },
    {}
  );

  const yearDataArray = Object.values(yearData)
    .map((year) => ({
      ...year,
      domains: year.domains.size,
    }))
    .sort((a, b) => a.year - b.year);

  // Domain analysis
  const domainAnalysis = processedPapers.reduce(
    (acc: Record<string, DomainData>, paper) => {
      const domain = paper.domain || "Unknown";
      if (!acc[domain]) {
        acc[domain] = { domain, count: 0, papers: [] };
      }
      acc[domain].count++;
      acc[domain].papers.push(paper);
      return acc;
    },
    {}
  );

  // Prepare data for multi-line domain evolution chart
  const domainYearCounts: Record<string, Record<string, number>> = {};
  filteredPapers.forEach((p) => {
    const year = String(p.year);
    const domain = p.domain || "Unknown";
    if (!domainYearCounts[domain]) domainYearCounts[domain] = {};
    if (!domainYearCounts[domain][year]) domainYearCounts[domain][year] = 0;
    domainYearCounts[domain][year]++;
  });
  const allYears = Array.from(
    new Set(filteredPapers.map((p) => String(p.year)))
  ).sort();
  const allLineDomains = Object.keys(domainYearCounts);
  const domainLineData = allYears.map((year) => {
    const row: Record<string, number | string> = { year };
    allLineDomains.forEach((domain) => {
      row[domain] = domainYearCounts[domain][year] || 0;
    });
    return row;
  });

  // Region analysis
  const regionAnalysis = processedPapers.reduce(
    (acc: Record<string, RegionData>, paper) => {
      const region = paper.focusRegion || "Unknown";
      if (!acc[region]) {
        acc[region] = { region, count: 0, domains: new Set() };
      }
      acc[region].count++;
      acc[region].domains.add(paper.domain || "Unknown");
      return acc;
    },
    {}
  );

  // Author analysis with regions
  const authorAnalysis = filteredPapers.reduce(
    (acc: Record<string, AuthorData>, paper) => {
      const authors = paper.authors;
      const authorRegions = paper.authorRegions;
      authors.forEach((author: string, idx: number) => {
        const authorRegion = authorRegions[idx] || "Unknown";
        if (!acc[author]) {
          acc[author] = {
            name: author,
            papers: 0,
            domains: new Set(),
            regions: new Set(),
            collaborations: new Set(),
            primaryRegion: authorRegion,
          };
        }
        acc[author].papers++;
        acc[author].domains.add(paper.domain || "Unknown");
        acc[author].regions.add(authorRegion);
        // Track collaborations
        authors.forEach((otherAuthor: string) => {
          if (otherAuthor !== author) {
            acc[author].collaborations.add(otherAuthor);
          }
        });
      });
      return acc;
    },
    {}
  );

  const authorDataArrayFull = Object.values(authorAnalysis)
    .map((author) => ({
      name: author.name,
      papers: author.papers,
      domainCount: author.domains.size,
      regionCount: author.regions.size,
      collaborationCount: author.collaborations.size,
      primaryRegion: author.primaryRegion,
    }))
    .sort((a: { papers: number }, b: { papers: number }) => b.papers - a.papers);

  // Top 15 for charts; full list for the statistics table
  const authorDataArray = authorDataArrayFull.slice(0, 15);

  // Author region analysis
  const authorRegionAnalysis = filteredPapers.reduce(
    (
      acc: Record<
        string,
        {
          region: string;
          authors: Set<string>;
          papers: number;
          domains: Set<string>;
        }
      >,
      paper
    ) => {
      const authors = paper.authors;
      const authorRegions = paper.authorRegions;
      authors.forEach((author: string, idx: number) => {
        const authorRegion = authorRegions[idx] || "Unknown";
        if (!acc[authorRegion]) {
          acc[authorRegion] = {
            region: authorRegion,
            authors: new Set(),
            papers: 0,
            domains: new Set(),
          };
        }
        acc[authorRegion].authors.add(author);
        acc[authorRegion].papers++;
        acc[authorRegion].domains.add(paper.domain || "Unknown");
      });
      return acc;
    },
    {}
  );

  const authorRegionDataArray = Object.values(authorRegionAnalysis)
    .map((region) => ({
      region: region.region,
      authorCount: region.authors.size,
      paperCount: region.papers,
      domainCount: region.domains.size,
    }))
    .sort((a, b) => b.paperCount - a.paperCount)
    .slice(0, 15);

  // Robust cross-region collaboration analysis
  const crossRegionCollaboration = filteredPapers.reduce(
    (
      acc: Record<
        string,
        {
          regions: string;
          papers: number;
          domains: Set<string>;
        }
      >,
      paper
    ) => {
      const authors = paper.authors;
      const authorRegions = paper.authorRegions
        .map((r: string) => r.trim()) // Don't convert to lowercase here!
        .filter((r) => r && r !== "unknown" && r !== "Unknown");

      // Map author index to region, skip if missing
      const regionMap = authors.map((_, idx) => authorRegions[idx] || "");

      // Unique region pairs in this paper
      const seenPairs = new Set<string>();
      for (let i = 0; i < regionMap.length; i++) {
        for (let j = i + 1; j < regionMap.length; j++) {
          const region1 = regionMap[i];
          const region2 = regionMap[j];
          if (region1 && region2 && region1 !== region2) {
            // Create a normalized pair for comparison (lowercase for sorting)
            const normalizedPair = [
              region1.toLowerCase(),
              region2.toLowerCase(),
            ]
              .sort()
              .join(" ↔ ");
            // But store the original casing
            const originalPair = [region1, region2].sort().join(" ↔ ");

            if (!seenPairs.has(normalizedPair)) {
              seenPairs.add(normalizedPair);
              if (!acc[originalPair]) {
                acc[originalPair] = {
                  regions: originalPair,
                  papers: 0,
                  domains: new Set(),
                };
              }
              acc[originalPair].papers++;
              acc[originalPair].domains.add(paper.domain || "Unknown");
            }
          }
        }
      }
      return acc;
    },
    {}
  );

  const crossRegionDataArray = Object.values(crossRegionCollaboration)
    .map((collab) => ({
      regions: collab.regions, // Keep original casing
      papers: collab.papers,
      domainCount: collab.domains.size,
    }))
    .sort((a, b) => b.papers - a.papers)
    .slice(0, 10);

  // Affiliation analysis
  const affiliationAnalysis = filteredPapers.reduce(
    (
      acc: Record<
        string,
        {
          name: string;
          papers: number;
          domains: Set<string>;
          collaborators: Set<string>;
        }
      >,
      paper
    ) => {
      paper.affiliations.forEach((affiliation: string) => {
        if (!acc[affiliation]) {
          acc[affiliation] = {
            name: affiliation,
            papers: 0,
            domains: new Set(),
            collaborators: new Set(),
          };
        }
        acc[affiliation].papers++;
        acc[affiliation].domains.add(paper.domain || "Unknown");
        // Add other affiliations as collaborators
        paper.affiliations.forEach((otherAffiliation: string) => {
          if (otherAffiliation !== affiliation) {
            acc[affiliation].collaborators.add(otherAffiliation);
          }
        });
      });
      return acc;
    },
    {}
  );

  const affiliationDataArray = Object.values(affiliationAnalysis)
    .map((aff) => ({
      name: aff.name,
      papers: aff.papers,
      collaboratorCount: aff.collaborators.size,
      domainCount: aff.domains.size,
    }))
    .sort((a, b) => b.papers - a.papers)
    .slice(0, 15);

  // Collaboration patterns
  const collaborationPatterns = processedPapers.reduce(
    (
      acc: Record<
        string,
        {
          type: string;
          count: number;
          papers: Paper[];
        }
      >,
      paper
    ) => {
      const authorCount = paper.authors.length || 1;
      const collaborationType =
        authorCount === 1
          ? "Solo"
          : authorCount === 2
          ? "Duo"
          : authorCount <= 5
          ? "Small Team"
          : "Large Team";

      if (!acc[collaborationType]) {
        acc[collaborationType] = {
          type: collaborationType,
          count: 0,
          papers: [],
        };
      }

      acc[collaborationType].count++;
      acc[collaborationType].papers.push(paper);

      return acc;
    },
    {}
  );

  const collaborationData = Object.values(collaborationPatterns).sort(
    (a, b) => b.count - a.count
  );

  // Domain colors for stacked bar chart
  const DOMAIN_COLORS = [
    "#2563eb", "#dc2626", "#16a34a", "#ca8a04", "#9333ea",
    "#f59e42", "#10b981", "#f43f5e", "#06b6d4", "#8b5cf6",
    "#ec4899", "#14b8a6", "#f97316", "#84cc16",
  ];

  // Author × domain stacked bar data (top 12 authors)
  const authorDomainChartData = (() => {
    const domains = new Set<string>();
    const perAuthor: Record<string, Record<string, number>> = {};
    authorDataArray.slice(0, 12).forEach((author) => {
      perAuthor[author.name] = {};
      filteredPapers.forEach((p) => {
        const aName = author.name.trim().toLowerCase();
        const pAuthors = p.authors.map((a: string) => a.trim().toLowerCase());
        if (pAuthors.includes(aName)) {
          const d = p.domain || "Unknown";
          domains.add(d);
          perAuthor[author.name][d] = (perAuthor[author.name][d] || 0) + 1;
        }
      });
    });
    const domainList = Array.from(domains).sort();
    const rows = authorDataArray.slice(0, 12).map((author) => {
      const row: Record<string, string | number> = { name: author.name };
      domainList.forEach((d) => { row[d] = perAuthor[author.name]?.[d] || 0; });
      return row;
    });
    return { rows, domains: domainList };
  })();

  // Author × domain rows for the full table (all authors)
  const authorDomainTableRows = authorDataArrayFull.flatMap((author) => {
    const domainCounts: Record<string, number> = {};
    filteredPapers.forEach((p) => {
      const aName = author.name.trim().toLowerCase();
      const pAuthors = p.authors.map((a: string) => a.trim().toLowerCase());
      if (pAuthors.includes(aName)) {
        const d = p.domain || "Unknown";
        domainCounts[d] = (domainCounts[d] || 0) + 1;
      }
    });
    return Object.entries(domainCounts).map(([domain, count]) => ({
      author: author.name,
      domain,
      count,
    }));
  }).sort((a, b) => b.count - a.count || a.author.localeCompare(b.author));

  // Author detail for network click modal
  const authorDetail = useMemo(() => {
    if (!selectedNetworkAuthor) return null;
    const { name, variants } = selectedNetworkAuthor;
    const variantSet = new Set(variants.map((v) => v.trim()));
    const authorPapers = filteredPapers.filter((p) =>
      p.authors.some((a: string) => variantSet.has(a.trim()))
    );
    const domains = [...new Set(authorPapers.map((p) => p.domain).filter(Boolean))];
    const regions = [
      ...new Set(
        authorPapers.flatMap((p) => {
          const idx = p.authors.findIndex((a: string) => variantSet.has(a.trim()));
          return idx >= 0 && p.authorRegions[idx] ? [p.authorRegions[idx]] : [];
        })
      ),
    ];
    const collaborators = [
      ...new Set(
        authorPapers.flatMap((p) =>
          p.authors.filter((a: string) => !variantSet.has(a.trim()))
        )
      ),
    ].slice(0, 20);
    return { name, papers: authorPapers, domains, regions, collaborators };
  }, [selectedNetworkAuthor, filteredPapers]);

  // Year-over-year growth rate
  const yearGrowthData = yearDataArray.map((d, idx) => ({
    year: d.year,
    count: d.count,
    growth:
      idx === 0
        ? 0
        : Number(
            (
              ((d.count - yearDataArray[idx - 1].count) /
                yearDataArray[idx - 1].count) *
              100
            ).toFixed(1)
          ),
  }));

  // Author productivity distribution (buckets by paper count)
  const authorProductivityData = (() => {
    const buckets: Record<string, number> = { "1": 0, "2": 0, "3": 0, "4+": 0 };
    Object.values(authorAnalysis).forEach((a) => {
      const key = a.papers >= 4 ? "4+" : String(a.papers);
      buckets[key] = (buckets[key] || 0) + 1;
    });
    return [
      { label: "1 paper", count: buckets["1"] },
      { label: "2 papers", count: buckets["2"] },
      { label: "3 papers", count: buckets["3"] },
      { label: "4+ papers", count: buckets["4+"] },
    ];
  })();

  // Solo vs collaborative trend over time
  const soloVsCollabByYear = yearDataArray.map((yd) => {
    const yp = processedPapers.filter((p) => p.year === yd.year);
    return {
      year: yd.year,
      solo: yp.filter((p) => p.authors.length === 1).length,
      collaborative: yp.filter((p) => p.authors.length > 1).length,
    };
  });

  // Key metrics
  const metrics = {
    totalPapers: processedPapers.length,
    totalAuthors: Object.keys(authorAnalysis).length,
    totalAffiliations: Object.keys(affiliationAnalysis).length,
    uniqueDomains: Object.keys(domainAnalysis).length,
    uniqueRegions: Object.keys(regionAnalysis).length,
    uniqueAuthorRegions: Object.keys(authorRegionAnalysis).length,
    collaborativePapers: processedPapers.filter((p) => p.authors.length > 1)
      .length,
    crossRegionPapers: Object.values(crossRegionCollaboration).reduce(
      (sum: number, collab) => sum + collab.papers,
      0
    ),
    recentPapers: processedPapers.filter((p) => p.year >= 2020).length,
  };

  // Custom legend for better readability
  const customLegend = (labels: { color: string; value: string }[]) => (
    <div
      style={{
        display: "flex",
        gap: 24,
        justifyContent: "center",
        marginTop: 12,
      }}
    >
      {labels.map((label) => (
        <div
          key={label.value}
          style={{
            display: "flex",
            alignItems: "center",
            fontSize: 15,
            fontWeight: 500,
          }}
        >
          <span
            style={{
              background: label.color,
              width: 18,
              height: 18,
              display: "inline-block",
              borderRadius: 4,
              marginRight: 8,
            }}
          ></span>
          <span style={{ color: "#222" }}>{label.value}</span>
        </div>
      ))}
    </div>
  );

  // Reset authorStatsPage when filters change
  useEffect(() => {
    setAuthorStatsPage(1);
  }, [selectedAuthors, selectedDomains, selectedRegions, selectedInstitutions]);

  // Reset papersPage when filters change
  useEffect(() => {
    setPapersPage(1);
  }, [selectedAuthors, selectedDomains, selectedRegions, selectedInstitutions]);

  return (
    <div className="w-full p-6 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-2xl font-bold text-center mb-8 text-gray-800">
          Research Analytics Dashboard
        </h2>

        {/* Key Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-6 rounded-lg shadow-lg">
            <h3 className="text-lg font-semibold">Total Papers</h3>
            <p className="text-3xl font-bold">{metrics.totalPapers}</p>
            <p className="text-sm opacity-90">Research Publications</p>
          </div>
          <div className="bg-gradient-to-r from-green-500 to-green-600 text-white p-6 rounded-lg shadow-lg">
            <h3 className="text-lg font-semibold">Unique Authors</h3>
            <p className="text-3xl font-bold">{metrics.totalAuthors}</p>
            <p className="text-sm opacity-90">Researchers</p>
          </div>
          <div className="bg-gradient-to-r from-purple-500 to-purple-600 text-white p-6 rounded-lg shadow-lg">
            <h3 className="text-lg font-semibold">Institutions</h3>
            <p className="text-3xl font-bold">{metrics.totalAffiliations}</p>
            <p className="text-sm opacity-90">Organizations</p>
          </div>
          <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white p-6 rounded-lg shadow-lg">
            <h3 className="text-lg font-semibold">Research Domains</h3>
            <p className="text-3xl font-bold">{metrics.uniqueDomains}</p>
            <p className="text-sm opacity-90">Diverse Coverage</p>
          </div>
        </div>

        {/* Key Insights Summary */}
        <div className="bg-white p-6 rounded-lg shadow-lg">
          <h3 className="text-xl font-semibold mb-4 text-gray-700">
            Key Research Insights
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold text-lg mb-3 text-gray-700">
                Research Overview
              </h4>
              <ul className="space-y-2 text-gray-600">
                <li>• {metrics.totalPapers} research papers analyzed</li>
                <li>• {metrics.totalAuthors} unique authors contributing</li>
                <li>
                  • {metrics.uniqueDomains} different research domains covered
                </li>
                <li>
                  • {metrics.uniqueRegions} geographic regions represented
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-lg mb-3 text-gray-700">
                Collaboration Insights
              </h4>
              <ul className="space-y-2 text-gray-600">
                <li>
                  • {metrics.collaborativePapers} collaborative papers (
                  {(
                    (metrics.collaborativePapers / metrics.totalPapers) *
                    100
                  ).toFixed(1)}
                  %)
                </li>
                <li>• {metrics.totalAffiliations} institutions involved</li>
                <li>
                  • {metrics.uniqueAuthorRegions} unique author regions
                  represented
                </li>
                <li>
                  • {metrics.crossRegionPapers} cross-region collaborative
                  papers
                </li>
                <li>• {metrics.recentPapers} papers from 2020 onwards</li>
                <li>
                  •{" "}
                  {collaborationData.length > 0
                    ? collaborationData[0].type
                    : "N/A"}{" "}
                  is the most common collaboration pattern
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-gray-100 rounded-lg p-4 mb-6 flex flex-wrap gap-4 items-end">
          <div className="min-w-[220px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Authors
            </label>
            <Select
              isMulti
              options={allAuthors.map((a) => ({ value: a, label: a }))}
              value={selectedAuthors.map((a) => ({ value: a, label: a }))}
              onChange={(opts) => setSelectedAuthors(opts.map((o) => o.value))}
              classNamePrefix="react-select"
              placeholder="Select authors..."
            />
          </div>
          <div className="min-w-[220px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Domains
            </label>
            <Select
              isMulti
              options={allDomains.map((d) => ({ value: d, label: d }))}
              value={selectedDomains.map((d) => ({ value: d, label: d }))}
              onChange={(opts) => setSelectedDomains(opts.map((o) => o.value))}
              classNamePrefix="react-select"
              placeholder="Select domains..."
            />
          </div>
          <div className="min-w-[220px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Author Regions
            </label>
            <Select
              isMulti
              options={allRegions.map((r) => ({ value: r, label: r }))}
              value={selectedRegions.map((r) => ({ value: r, label: r }))}
              onChange={(opts) => setSelectedRegions(opts.map((o) => o.value))}
              classNamePrefix="react-select"
              placeholder="Select regions..."
            />
          </div>
          <div className="min-w-[220px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Institutions
            </label>
            <Select
              isMulti
              options={allInstitutions.map((i) => ({ value: i, label: i }))}
              value={selectedInstitutions.map((i) => ({ value: i, label: i }))}
              onChange={(opts) =>
                setSelectedInstitutions(opts.map((o) => o.value))
              }
              classNamePrefix="react-select"
              placeholder="Select institutions..."
            />
          </div>
          <button
            className="ml-4 bg-gray-400 text-white px-4 py-2 rounded hover:bg-gray-500"
            onClick={() => {
              setSelectedAuthors([]);
              setSelectedDomains([]);
              setSelectedRegions([]);
              setSelectedInstitutions([]);
            }}
          >
            Clear Filters
          </button>
        </div>

        {/* Research Evolution Timeline */}
        <div className="bg-white p-6 rounded-lg shadow-lg mb-8">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold text-gray-700">
              Research Evolution Timeline
            </h3>
            <button
              className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 flex items-center gap-2 shadow-md"
              onClick={() =>
                downloadChartAsImage(
                  "evolution-chart",
                  "research-evolution-timeline"
                )
              }
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              Download
            </button>
          </div>
          <div id="evolution-chart">
            <ResponsiveContainer width="100%" height={400}>
              <AreaChart data={yearDataArray}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="year" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="count"
                  stackId="1"
                  stroke="#8884d8"
                  fill="#8884d8"
                  name="Publications"
                />
                <Line
                  type="monotone"
                  dataKey="domains"
                  stroke="#82ca9d"
                  strokeWidth={3}
                  name="Unique Domains"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Domain Evolution */}

        <div className="bg-white p-6 rounded-lg shadow-lg mb-8">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold text-gray-700">
              Domain Evolution Over Time
            </h3>
            <button
              className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 flex items-center gap-2 shadow-md"
              onClick={() =>
                downloadChartAsImage(
                  "domain-evolution-chart",
                  "domain-evolution-over-time"
                )
              }
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              Download
            </button>
          </div>
          <div id="domain-evolution-chart">
            <ResponsiveContainer width="100%" height={400} minWidth={700}>
              <LineChart
                data={domainLineData}
                margin={{ left: 30, right: 30, bottom: 60 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="year" />
                <YAxis />
                <Tooltip />
                <Legend />
                {allLineDomains.map((domain, idx) => (
                  <Line
                    key={domain}
                    type="monotone"
                    dataKey={domain}
                    stroke={
                      [
                        "#2563eb",
                        "#dc2626",
                        "#16a34a",
                        "#ca8a04",
                        "#9333ea",
                        "#eab308",
                        "#f59e42",
                        "#10b981",
                      ][idx % 8]
                    }
                    strokeWidth={2}
                    name={domain}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Authors */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-xl font-semibold text-gray-700">
                Top Authors by Publications
              </h3>
              <button
                className="bg-green-600 text-white px-3 py-1 rounded-lg text-xs font-medium hover:bg-green-700 flex items-center gap-1 shadow-md"
                onClick={() =>
                  downloadChartAsImage("authors-chart", "top-authors")
                }
              >
                <svg
                  className="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                Download
              </button>
            </div>
            <div className="text-gray-500 text-sm mb-2">
              Shows the most prolific authors in the filtered dataset. "Papers"
              is the number of papers authored; "Collaborations" is the number
              of unique co-authors. Each author's domains are shown below their
              name.
              <br />
              <span className="text-xs">
                Selecting an author, domain, region, or institution above will
                update this chart and all others below.
              </span>
            </div>
            <div id="authors-chart">
              <ResponsiveContainer width="100%" height={450}>
                <BarChart
                  data={authorDataArray.filter(
                    (a) =>
                      selectedAuthors.length === 0 ||
                      selectedAuthors.includes(a.name)
                  )}
                  margin={{ bottom: 150 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="name"
                    angle={-45}
                    textAnchor="end"
                    height={150}
                    tick={{ fontSize: 10 }}
                    interval={0}
                  />
                  <YAxis />
                  <Tooltip
                    formatter={(value, name, props) => {
                      const author = props.payload.name;
                      const domains = Array.from(
                        new Set(
                          filteredPapers
                            .filter((p) => p.authors.includes(author))
                            .map((p) => p.domain)
                        )
                      ).filter(Boolean);
                      return [
                        value,
                        `${name} (Domains: ${domains.join(", ")})`,
                      ];
                    }}
                  />
                  <Bar dataKey="papers" fill="#2563eb" name="Papers" />
                  <Bar
                    dataKey="collaborationCount"
                    fill="#16a34a"
                    name="Collaborations"
                  />
                </BarChart>
              </ResponsiveContainer>
              {customLegend([
                { color: "#2563eb", value: "Papers" },
                { color: "#16a34a", value: "Collaborations" },
              ])}
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-lg">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-xl font-semibold text-gray-700">
                Top Institutions
              </h3>
              <button
                className="bg-green-600 text-white px-3 py-1 rounded-lg text-xs font-medium hover:bg-green-700 flex items-center gap-1 shadow-md"
                onClick={() =>
                  downloadChartAsImage("institutions-chart", "top-institutions")
                }
              >
                <svg
                  className="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                Download
              </button>
            </div>
            <div className="text-gray-500 text-sm mb-2">
              Shows the institutions most represented in the filtered dataset.
              "Papers" is the number of papers with at least one author from the
              institution; "Collaborators" is the number of unique collaborating
              institutions. Domains of collaboration:{" "}
              <span className="font-semibold text-gray-700">
                {[...new Set(filteredPapers.flatMap((p) => p.domain))].join(
                  ", "
                ) || "N/A"}
              </span>
              .
              <br />
              <span className="text-xs">
                This chart updates with your filter selections above and is
                related to the co-author network below.
              </span>
            </div>
            <div id="institutions-chart">
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={affiliationDataArray}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="name"
                    angle={-45}
                    textAnchor="end"
                    height={120}
                    tick={{ fontSize: 11 }}
                    interval={0}
                  />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="papers" fill="#f59e42" name="Papers" />
                  <Bar
                    dataKey="collaboratorCount"
                    fill="#eab308"
                    name="Collaborators"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Author Domain Statistics */}
        <div className="bg-white p-6 rounded-lg shadow-lg mt-6 mb-2">
          <div className="flex justify-between items-center mb-2">
            <div>
              <h3 className="text-xl font-semibold text-gray-700">Author Domain Statistics</h3>
              <p className="text-sm text-gray-500 mt-0.5">
                Domain breakdown across all{" "}
                <span className="font-semibold text-gray-700">{authorDataArrayFull.length}</span>{" "}
                authors in the filtered dataset
              </p>
            </div>
            <button
              className="bg-green-600 text-white px-3 py-1 rounded-lg text-xs font-medium hover:bg-green-700 flex items-center gap-1 shadow-md"
              onClick={() => downloadChartAsImage("author-domain-chart", "author-domain-statistics")}
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download
            </button>
          </div>
          <p className="text-gray-500 text-sm mb-4">
            Stacked bar showing the domain mix for the top 12 most prolific authors. Expand the table below for all authors.
          </p>
          <div id="author-domain-chart">
            <ResponsiveContainer width="100%" height={420}>
              <BarChart
                layout="vertical"
                data={authorDomainChartData.rows}
                margin={{ left: 10, right: 20, top: 10, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={160}
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v: string) =>
                    v.length > 22 ? v.slice(0, 20) + "…" : v
                  }
                />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {authorDomainChartData.domains.map((domain, idx) => (
                  <Bar
                    key={domain}
                    dataKey={domain}
                    stackId="a"
                    fill={DOMAIN_COLORS[idx % DOMAIN_COLORS.length]}
                    name={domain}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Collapsible full table */}
          <div className="mt-6 border-t border-gray-100 pt-4">
            <h4
              className="text-base font-semibold mb-2 text-gray-600 cursor-pointer flex items-center hover:text-gray-900 select-none"
              onClick={() => setAuthorStatsExpanded(!authorStatsExpanded)}
            >
              <span className={`mr-2 transition-transform inline-block ${authorStatsExpanded ? "rotate-90" : ""}`}>▶</span>
              Full breakdown table — all {authorDomainTableRows.length} author × domain rows
            </h4>
            {authorStatsExpanded && (() => {
              const filteredRows =
                selectedAuthors.length === 0
                  ? authorDomainTableRows
                  : authorDomainTableRows.filter((r) => selectedAuthors.includes(r.author));
              const totalPages = Math.ceil(filteredRows.length / statsPageSize);
              const pagedRows = filteredRows.slice(
                (authorStatsPage - 1) * statsPageSize,
                authorStatsPage * statsPageSize
              );
              return (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="p-2 text-left font-semibold text-gray-700">Author</th>
                        <th className="p-2 text-left font-semibold text-gray-700">Domain</th>
                        <th className="p-2 text-left font-semibold text-gray-700"># Papers</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedRows.map((row, idx) => (
                        <tr
                          key={`${row.author}-${row.domain}`}
                          className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}
                        >
                          <td className="p-2 text-gray-800">{row.author}</td>
                          <td className="p-2">
                            <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-medium">
                              {row.domain}
                            </span>
                          </td>
                          <td className="p-2 text-gray-700 font-medium">{row.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-xs text-gray-500">
                      Showing {Math.min((authorStatsPage - 1) * statsPageSize + 1, filteredRows.length)}–
                      {Math.min(authorStatsPage * statsPageSize, filteredRows.length)} of {filteredRows.length}
                    </span>
                    <div className="flex gap-1 items-center">
                      <button
                        className="px-3 py-1 rounded bg-gray-200 text-sm disabled:opacity-40 hover:bg-gray-300"
                        disabled={authorStatsPage === 1}
                        onClick={() => setAuthorStatsPage((p) => Math.max(1, p - 1))}
                      >
                        ← Prev
                      </button>
                      <span className="px-2 text-sm text-gray-600">
                        {authorStatsPage} / {totalPages || 1}
                      </span>
                      <button
                        className="px-3 py-1 rounded bg-gray-200 text-sm disabled:opacity-40 hover:bg-gray-300"
                        disabled={authorStatsPage >= totalPages}
                        onClick={() => setAuthorStatsPage((p) => Math.min(totalPages, p + 1))}
                      >
                        Next →
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* After the Top Institutions chart, add a statistics table for institution-domain-paper count */}
        <div className="mt-6">
          <h4
            className="text-lg font-semibold mb-2 text-gray-700 cursor-pointer flex items-center hover:text-gray-900"
            onClick={() =>
              setInstitutionStatsExpanded(!institutionStatsExpanded)
            }
          >
            <span
              className={`mr-2 transition-transform ${
                institutionStatsExpanded ? "rotate-90" : ""
              }`}
            >
              ▶
            </span>
            Institution Domain Statistics
          </h4>
          {institutionStatsExpanded && (
            <div className="overflow-x-auto">
              {(() => {
                const rows = affiliationDataArray
                  .filter(
                    (i) =>
                      selectedInstitutions.length === 0 ||
                      selectedInstitutions.includes(i.name)
                  )
                  .flatMap((inst) => {
                    const domainCounts: Record<string, number> = {};
                    filteredPapers.forEach((p) => {
                      const affs = Array.isArray(p.affiliations)
                        ? p.affiliations
                        : [];
                      if (affs.includes(inst.name)) {
                        const domain = String(p.domain);
                        if (!domainCounts[domain]) domainCounts[domain] = 0;
                        domainCounts[domain]!++;
                      }
                    });
                    return Object.entries(domainCounts).map(
                      ([domain, count]) => ({
                        institution: inst.name,
                        domain,
                        count,
                      })
                    ) as {
                      institution: string;
                      domain: string;
                      count: number;
                    }[];
                  })
                  .sort(
                    (a, b) =>
                      a.institution.localeCompare(b.institution) ||
                      a.domain.localeCompare(b.domain)
                  );
                const totalPages = Math.ceil(rows.length / statsPageSize);
                const pagedRows = rows.slice(
                  (instStatsPage - 1) * statsPageSize,
                  instStatsPage * statsPageSize
                );
                return (
                  <>
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="p-2 text-left">Institution</th>
                          <th className="p-2 text-left">Domain</th>
                          <th className="p-2 text-left"># Papers</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pagedRows.map(
                          (
                            row: {
                              institution: string;
                              domain: string;
                              count: number;
                            },
                            idx: number
                          ) => (
                            <tr
                              key={`${row.institution}-${row.domain}`}
                              className={idx % 2 === 0 ? "" : "bg-gray-50"}
                            >
                              <td className="p-2">{row.institution}</td>
                              <td className="p-2">{row.domain}</td>
                              <td className="p-2">{row.count}</td>
                            </tr>
                          )
                        )}
                      </tbody>
                    </table>
                    <div className="flex justify-between items-center mt-2">
                      <button
                        className="px-3 py-1 rounded bg-gray-200"
                        disabled={instStatsPage === 1}
                        onClick={() =>
                          setInstStatsPage((p) => Math.max(1, p - 1))
                        }
                      >
                        Prev
                      </button>
                      <span className="text-xs">
                        Page {instStatsPage} of {totalPages || 1}
                      </span>
                      <button
                        className="px-3 py-1 rounded bg-gray-200"
                        disabled={
                          instStatsPage === totalPages || totalPages === 0
                        }
                        onClick={() =>
                          setInstStatsPage((p) => Math.min(totalPages, p + 1))
                        }
                      >
                        Next
                      </button>
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </div>

        {/* Semantic Cluster Visualization */}
        <div className="bg-white p-6 rounded-lg shadow-lg mb-8">
          <div className="mb-4">
            <h3 className="text-xl font-semibold text-gray-700">Semantic Landscape</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Each dot is a paper — papers closer together are semantically similar based on their abstracts.
              Hover to preview · click for details · filter by cluster or domain.
            </p>
          </div>
          <SemanticClusterChart />
        </div>

        {/* Co-Author Network Visualization */}
        <div className="bg-white p-6 rounded-lg shadow-lg mb-8">
          <div className="flex flex-wrap justify-between items-center mb-2 gap-3">
            <h3 className="text-xl font-semibold text-gray-700">
              Co-Author Network
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 font-medium">Show top:</span>
              {([50, 100, 200, 500, 0] as const).map((n) => (
                <button
                  key={n}
                  className={`px-3 py-1 rounded text-sm font-medium border transition-colors ${
                    networkMaxNodes === n
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                  }`}
                  onClick={() => setNetworkMaxNodes(n)}
                >
                  {n === 0 ? "All" : n}
                </button>
              ))}
            </div>
          </div>
          <div className="text-gray-500 text-sm mb-3">
            Visualizes the collaboration network among authors in the filtered
            dataset. Each node is an author (color = region); edges represent
            co-authorship. Click any node to see author details. Collaboration
            domains:{" "}
            <span className="font-semibold text-gray-700">
              {[...new Set(filteredPapers.flatMap((p) => p.domain))].join(
                ", "
              ) || "N/A"}
            </span>
            .
          </div>

          {/* Author search */}
          {(() => {
            const networkAuthors = [
              ...new Set(
                filteredPapers.flatMap((p) =>
                  p.authors.map((a: string) => a.trim())
                )
              ),
            ].sort();
            const query = networkAuthorSearch.trim().toLowerCase();
            const matches =
              query.length >= 1
                ? networkAuthors.filter((a) => a.toLowerCase().includes(query)).slice(0, 12)
                : [];
            return (
              <div className="relative mb-4 max-w-sm">
                <div className="flex items-center gap-2 border border-gray-300 rounded-lg px-3 py-2 bg-white focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-colors">
                  <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                  </svg>
                  <input
                    type="text"
                    className="flex-1 outline-none text-sm text-gray-800 placeholder-gray-400 bg-transparent"
                    placeholder={`Search ${networkAuthors.length} authors…`}
                    value={networkAuthorSearch}
                    onChange={(e) => {
                      setNetworkAuthorSearch(e.target.value);
                      setNetworkSearchOpen(true);
                    }}
                    onFocus={() => setNetworkSearchOpen(true)}
                    onBlur={() => setTimeout(() => setNetworkSearchOpen(false), 150)}
                  />
                  {networkAuthorSearch && (
                    <button
                      className="text-gray-400 hover:text-gray-600"
                      onMouseDown={(e) => { e.preventDefault(); setNetworkAuthorSearch(""); setNetworkSearchOpen(false); }}
                    >
                      ×
                    </button>
                  )}
                </div>
                {networkSearchOpen && matches.length > 0 && (
                  <ul className="absolute z-20 top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                    {matches.map((author) => (
                      <li key={author}>
                        <button
                          className="w-full text-left px-4 py-2 text-sm text-gray-800 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setSelectedNetworkAuthor({ name: author, variants: [author] });
                            setNetworkAuthorSearch("");
                            setNetworkSearchOpen(false);
                          }}
                        >
                          {author}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })()}

          <CoAuthorNetworkGraph
            papers={filteredPapers}
            maxNodes={networkMaxNodes === 0 ? 99999 : networkMaxNodes}
            onAuthorClick={(author, variants) => setSelectedNetworkAuthor({ name: author, variants: variants || [author] })}
          />
        </div>

        {/* Author Detail Modal */}
        {authorDetail && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
            onClick={() => setSelectedNetworkAuthor(null)}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-bold text-white">{authorDetail.name}</h2>
                  <p className="text-blue-100 text-sm mt-0.5">
                    {authorDetail.papers.length} paper{authorDetail.papers.length !== 1 ? "s" : ""} in filtered dataset
                  </p>
                </div>
                <button
                  onClick={() => setSelectedNetworkAuthor(null)}
                  className="text-white/70 hover:text-white text-2xl leading-none mt-0.5"
                >
                  ×
                </button>
              </div>

              {/* Body */}
              <div className="overflow-y-auto p-6 space-y-5">
                {/* Meta chips */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Regions</p>
                    <div className="flex flex-wrap gap-1.5">
                      {authorDetail.regions.length > 0
                        ? authorDetail.regions.map((r) => (
                            <span key={r} className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                              {r}
                            </span>
                          ))
                        : <span className="text-gray-400 text-sm">Unknown</span>}
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Domains</p>
                    <div className="flex flex-wrap gap-1.5">
                      {authorDetail.domains.map((d) => (
                        <span key={d} className="px-2 py-0.5 bg-violet-100 text-violet-800 rounded-full text-xs font-medium">
                          {d}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Collaborators */}
                {authorDetail.collaborators.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                      Top Collaborators ({authorDetail.collaborators.length}{authorDetail.collaborators.length === 20 ? "+" : ""})
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {authorDetail.collaborators.map((c) => (
                        <button
                          key={c}
                          className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-medium hover:bg-emerald-100 transition-colors"
                          onClick={() => setSelectedNetworkAuthor({ name: c, variants: [c] })}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Papers list */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Papers
                  </p>
                  <div className="space-y-2">
                    {authorDetail.papers
                      .slice()
                      .sort((a, b) => b.year - a.year)
                      .map((p, idx) => (
                        <div key={idx} className="border border-gray-100 rounded-lg p-3 bg-gray-50/60">
                          <p className="text-sm font-medium text-gray-800 leading-snug">{p["Paper Title"]}</p>
                          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                            <span className="text-xs text-gray-500">{p.year}</span>
                            <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">{p.domain}</span>
                            {p["DOI"] && (
                              <a
                                href={`https://doi.org/${p["DOI"]}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-600 hover:underline"
                              >
                                DOI ↗
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Author Regions Analysis */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-xl font-semibold text-gray-700">
                Author Regions Distribution
              </h3>
              <button
                className="bg-green-600 text-white px-3 py-1 rounded-lg text-xs font-medium hover:bg-green-700 flex items-center gap-1 shadow-md"
                onClick={() =>
                  downloadChartAsImage(
                    "author-regions-chart",
                    "author-regions-distribution"
                  )
                }
              >
                <svg
                  className="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                Download
              </button>
            </div>
            <div className="text-gray-500 text-sm mb-2">
              Shows the distribution of author regions (countries) in the
              filtered dataset. Updates with your filter selections above.
            </div>
            <div id="author-regions-chart">
              <ResponsiveContainer width="100%" height={450}>
                <BarChart
                  data={authorRegionDataArray}
                  margin={{ bottom: 120, left: 20, right: 20, top: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="region"
                    angle={-45}
                    textAnchor="end"
                    height={120}
                    interval={0}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="paperCount" fill="#8884d8" name="Papers" />
                  <Bar dataKey="authorCount" fill="#82ca9d" name="Authors" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Cross Regions Collaborations Analysis */}
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-xl font-semibold text-gray-700">
                Cross-Region Collaborations
              </h3>
              <button
                className="bg-green-600 text-white px-3 py-1 rounded-lg text-xs font-medium hover:bg-green-700 flex items-center gap-1 shadow-md"
                onClick={() =>
                  downloadChartAsImage(
                    "cross-region-chart",
                    "cross-region-collaborations"
                  )
                }
              >
                <svg
                  className="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                Download
              </button>
            </div>
            <div className="text-gray-500 text-sm mb-2">
              Shows the number of papers co-authored by researchers from
              different regions in the filtered dataset. Updates with your
              filter selections above.
            </div>
            <div id="cross-region-chart">
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={crossRegionDataArray}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="regions"
                    angle={-45}
                    textAnchor="end"
                    height={100}
                  />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="papers" fill="#ff7300" name="Joint Papers" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Collaboration Patterns + Growth Rate */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Collaboration Pattern Distribution */}
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-xl font-semibold text-gray-700">
                Collaboration Patterns
              </h3>
              <button
                className="bg-green-600 text-white px-3 py-1 rounded-lg text-xs font-medium hover:bg-green-700 flex items-center gap-1 shadow-md"
                onClick={() =>
                  downloadChartAsImage("collab-pattern-chart", "collaboration-patterns")
                }
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download
              </button>
            </div>
            <div className="text-gray-500 text-sm mb-3">
              Breakdown by team size: Solo (1 author), Duo (2), Small Team (3–5), Large Team (6+).
            </div>
            <div id="collab-pattern-chart">
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={collaborationData} margin={{ bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="type" />
                  <YAxis />
                  <Tooltip formatter={(v) => [`${v} papers`]} />
                  <Bar dataKey="count" name="Papers" radius={[6, 6, 0, 0]}>
                    {collaborationData.map((_, idx) => (
                      <Cell
                        key={idx}
                        fill={["#2563eb", "#16a34a", "#9333ea", "#f59e42"][idx % 4]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {collaborationData.map((d, idx) => (
                  <div key={d.type} className="flex items-center gap-2 text-sm text-gray-600">
                    <span
                      className="w-3 h-3 rounded-sm flex-shrink-0"
                      style={{ background: ["#2563eb", "#16a34a", "#9333ea", "#f59e42"][idx % 4] }}
                    />
                    <span className="font-medium">{d.type}:</span>
                    <span>{d.count} papers ({processedPapers.length > 0 ? ((d.count / processedPapers.length) * 100).toFixed(1) : 0}%)</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Year-over-Year Growth Rate */}
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-xl font-semibold text-gray-700">
                Year-over-Year Growth
              </h3>
              <button
                className="bg-green-600 text-white px-3 py-1 rounded-lg text-xs font-medium hover:bg-green-700 flex items-center gap-1 shadow-md"
                onClick={() =>
                  downloadChartAsImage("yoy-growth-chart", "yoy-growth-rate")
                }
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download
              </button>
            </div>
            <div className="text-gray-500 text-sm mb-3">
              Annual publication count and percentage growth rate vs. prior year.
            </div>
            <div id="yoy-growth-chart">
              <ResponsiveContainer width="100%" height={320}>
                <ComposedChart data={yearGrowthData} margin={{ bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="year" />
                  <YAxis yAxisId="left" orientation="left" />
                  <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `${v}%`} />
                  <Tooltip
                    formatter={(value, name) =>
                      name === "Growth %" ? [`${value}%`, name] : [value, name]
                    }
                  />
                  <Legend />
                  <Bar yAxisId="left" dataKey="count" fill="#2563eb" name="Publications" radius={[4, 4, 0, 0]} />
                  <Line yAxisId="right" type="monotone" dataKey="growth" stroke="#dc2626" strokeWidth={2} dot={{ r: 3 }} name="Growth %" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Author Productivity + Solo vs Collaborative Trend */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Author Productivity Distribution */}
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-xl font-semibold text-gray-700">
                Author Productivity
              </h3>
              <button
                className="bg-green-600 text-white px-3 py-1 rounded-lg text-xs font-medium hover:bg-green-700 flex items-center gap-1 shadow-md"
                onClick={() =>
                  downloadChartAsImage("productivity-chart", "author-productivity")
                }
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download
              </button>
            </div>
            <div className="text-gray-500 text-sm mb-3">
              How many authors published 1, 2, 3, or 4+ papers in the corpus. Most research corpora follow a power-law distribution.
            </div>
            <div id="productivity-chart">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={authorProductivityData} margin={{ bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis />
                  <Tooltip formatter={(v) => [`${v} authors`]} />
                  <Bar dataKey="count" name="Authors" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Solo vs Collaborative Trend */}
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-xl font-semibold text-gray-700">
                Solo vs. Collaborative Trend
              </h3>
              <button
                className="bg-green-600 text-white px-3 py-1 rounded-lg text-xs font-medium hover:bg-green-700 flex items-center gap-1 shadow-md"
                onClick={() =>
                  downloadChartAsImage("solo-collab-chart", "solo-vs-collaborative")
                }
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download
              </button>
            </div>
            <div className="text-gray-500 text-sm mb-3">
              Single-author vs. multi-author papers per year — shows whether collaboration is growing over time.
            </div>
            <div id="solo-collab-chart">
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={soloVsCollabByYear} margin={{ bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="year" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Area type="monotone" dataKey="collaborative" stackId="1" stroke="#2563eb" fill="#2563eb" fillOpacity={0.6} name="Collaborative" />
                  <Area type="monotone" dataKey="solo" stackId="1" stroke="#f59e42" fill="#f59e42" fillOpacity={0.6} name="Solo" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* All Papers Table */}
        <div className="bg-white p-6 rounded-lg shadow-lg mb-8">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-xl font-semibold text-gray-700">All Papers</h3>
            <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full font-medium">
              {filteredPapers.length} papers
            </span>
          </div>
          <div className="text-gray-500 text-sm mb-4">
            Full list of papers in the filtered dataset, sorted by year (newest first). Use the filters above to narrow results.
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-100">
                  <th className="p-3 text-left font-semibold text-gray-700">Paper Title</th>
                  <th className="p-3 text-left font-semibold text-gray-700">Authors</th>
                  <th className="p-3 text-left font-semibold text-gray-700">Regions</th>
                  <th className="p-3 text-left font-semibold text-gray-700">Year</th>
                  <th className="p-3 text-left font-semibold text-gray-700">Domain</th>
                  <th className="p-3 text-left font-semibold text-gray-700">ORC ID</th>
                  <th className="p-3 text-left font-semibold text-gray-700">DOI</th>
                </tr>
              </thead>
              <tbody>
                {filteredPapers
                  .slice()
                  .sort((a, b) => b.year - a.year)
                  .slice(
                    (papersPage - 1) * paperPageSize,
                    papersPage * paperPageSize
                  )
                  .map((paper, idx) => (
                    <tr
                      key={paper.SN || idx}
                      className={`border-b hover:bg-blue-50 align-top transition-colors ${
                        idx % 2 === 0 ? "bg-white" : "bg-gray-50/40"
                      }`}
                    >
                      <td className="p-3 max-w-xs">
                        <div className="line-clamp-2 text-gray-900 font-medium leading-snug">
                          {paper["Paper Title"]}
                        </div>
                      </td>
                      <td className="p-3 max-w-[200px]">
                        <span className="text-gray-700">
                          {paper.authors.slice(0, 2).join("; ")}
                        </span>
                        {paper.authors.length > 2 && (
                          <span className="text-gray-400 text-xs">
                            {" "}+{paper.authors.length - 2} more
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-xs text-gray-600 max-w-[150px]">
                        {paper.authorRegions.slice(0, 3).join(", ")}
                        {paper.authorRegions.length > 3 && (
                          <span className="text-gray-400">
                            {" "}+{paper.authorRegions.length - 3}
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-gray-700 font-medium whitespace-nowrap">
                        {paper.year}
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-medium whitespace-nowrap">
                          {paper.domain}
                        </span>
                      </td>
                      <td className="p-3 text-xs" style={{ maxWidth: 160 }}>
                        {(() => {
                          const parts = String(paper["ORC ID"] || "").split(";").map(s => s.trim()).filter(s => s && s !== "N/A");
                          if (parts.length === 0) return <span className="text-gray-400">—</span>;
                          return parts.map((id, i) => {
                            const url = id.startsWith("http") ? id : `https://orcid.org/${id}`;
                            return <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block text-blue-500 hover:underline truncate">{id.replace("https://orcid.org/", "")}</a>;
                          });
                        })()}
                      </td>
                      <td className="p-3">
                        {paper["DOI"] ? (
                          <a
                            href={String(paper["DOI"]).startsWith("http") ? String(paper["DOI"]) : `https://doi.org/${paper["DOI"]}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline text-xs block max-w-[130px] truncate"
                            title={String(paper["DOI"])}
                          >
                            {String(paper["DOI"])}
                          </a>
                        ) : (
                          <span className="text-gray-400 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          {/* Pagination */}
          {(() => {
            const total = filteredPapers.length;
            const totalPages = Math.ceil(total / paperPageSize);
            const start = Math.min((papersPage - 1) * paperPageSize + 1, total);
            const end = Math.min(papersPage * paperPageSize, total);
            return (
              <div className="flex items-center justify-between mt-4">
                <span className="text-xs text-gray-500">
                  Showing {start}–{end} of {total} papers
                </span>
                <div className="flex gap-1 items-center">
                  <button
                    className="px-3 py-1 rounded bg-gray-200 text-sm disabled:opacity-40 hover:bg-gray-300 transition-colors"
                    disabled={papersPage === 1}
                    onClick={() => setPapersPage((p) => Math.max(1, p - 1))}
                  >
                    ← Prev
                  </button>
                  <span className="px-3 py-1 text-sm text-gray-600 font-medium">
                    {papersPage} / {totalPages || 1}
                  </span>
                  <button
                    className="px-3 py-1 rounded bg-gray-200 text-sm disabled:opacity-40 hover:bg-gray-300 transition-colors"
                    disabled={papersPage >= totalPages}
                    onClick={() =>
                      setPapersPage((p) => Math.min(totalPages, p + 1))
                    }
                  >
                    Next →
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
};

export default AdvancedAnalytics;
