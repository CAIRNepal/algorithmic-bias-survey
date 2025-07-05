"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, AreaChart, Area, Text } from 'recharts';
import { useState, useMemo, useEffect } from 'react';
import CoAuthorNetworkGraph from './CoAuthorNetworkGraph';
import Select from 'react-select';

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

type DomainTickProps = {
  x: number;
  y: number;
  payload: {
    value: string;
  };
};

const AdvancedAnalytics = ({ papers }: { papers: Paper[] }) => {
  // Multi-select filters for collaborations
  const [selectedAuthors, setSelectedAuthors] = useState<string[]>([]);
  const [selectedDomains, setSelectedDomains] = useState<string[]>([]);
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [selectedInstitutions, setSelectedInstitutions] = useState<string[]>([]);

  // State for pagination
  const [authorStatsPage, setAuthorStatsPage] = useState(1);
  const [instStatsPage, setInstStatsPage] = useState(1);
  const statsPageSize = 10;

  // Process papers - only use CSV fields
  const processedPapers = papers.map(paper => ({
    ...paper,
    year: Number(paper['Year']) || 0,
    authors: String(paper['Authors'] || '').split(';').map((a: string) => a.trim()).filter(Boolean),
    affiliations: String(paper['Affiliations'] || '').split(';').map((a: string) => a.trim()).filter(Boolean),
    authorRegions: String(paper['Author Regions'] || '').split(';').map((r: string) => r.trim()).filter(Boolean),
    domain: String(paper['Domain'] || '').trim(),
    focusRegion: String(paper['Focus Region'] || '').trim(),
  }));

  // Get all unique authors, domains, regions, and institutions for filter options
  const allAuthors = useMemo(() => {
    const set = new Set<string>();
    papers.forEach(paper => {
      String(paper['Authors'] || '').split(';').map(a => a.trim()).forEach(a => a && set.add(a));
    });
    return Array.from(set).sort();
  }, [papers]);
  const allDomains = useMemo(() => {
    const set = new Set<string>();
    papers.forEach(paper => {
      const d = String(paper['Domain'] || '').trim();
      if (d) set.add(d);
    });
    return Array.from(set).sort();
  }, [papers]);
  const allRegions = useMemo(() => {
    const set = new Set<string>();
    papers.forEach(paper => {
      String(paper['Author Regions'] || '').split(';').map(r => r.trim()).forEach(r => r && set.add(r));
    });
    return Array.from(set).sort();
  }, [papers]);
  const allInstitutions = useMemo(() => {
    const set = new Set<string>();
    papers.forEach(paper => {
      String(paper['Affiliations'] || '').split(';').map(a => a.trim()).forEach(a => a && set.add(a));
    });
    return Array.from(set).sort();
  }, [papers]);

  // Filter processedPapers for collaborations tab
  const filteredPapers = useMemo(() => {
    return processedPapers.filter(paper => {
      // Author filter: at least one selected author is in this paper
      const authorMatch =
        selectedAuthors.length === 0 ||
        paper.authors.some((a: string) => selectedAuthors.includes(a));
      // Domain filter: paper domain is in selected domains
      const domainMatch =
        selectedDomains.length === 0 ||
        selectedDomains.includes(paper.domain);
      // Region filter: at least one author region is in selected regions
      const regionMatch =
        selectedRegions.length === 0 ||
        paper.authorRegions.some((r: string) => selectedRegions.includes(r));
      // Institution filter: at least one affiliation is in selected institutions
      const institutionMatch =
        selectedInstitutions.length === 0 ||
        paper.affiliations.some((aff: string) => selectedInstitutions.includes(aff));
      return authorMatch && domainMatch && regionMatch && institutionMatch;
    });
  }, [processedPapers, selectedAuthors, selectedDomains, selectedRegions, selectedInstitutions]);

  // Year analysis
  const yearData = processedPapers.reduce((acc: Record<number, YearData>, paper) => {
    const year = paper.year;
    if (year) {
      if (!acc[year]) acc[year] = { year, count: 0, domains: new Set() };
      acc[year].count++;
      acc[year].domains.add(paper.domain || 'Unknown');
    }
    return acc;
  }, {});

  const yearDataArray = Object.values(yearData)
    .map(year => ({
      ...year,
      domains: year.domains.size,
    }))
    .sort((a, b) => a.year - b.year);

  // Domain analysis
  const domainAnalysis = processedPapers.reduce((acc: Record<string, DomainData>, paper) => {
    const domain = paper.domain || 'Unknown';
    if (!acc[domain]) {
      acc[domain] = { domain, count: 0, papers: [] };
    }
    acc[domain].count++;
    acc[domain].papers.push(paper);
    return acc;
  }, {});

  const domainDataArray = Object.values(domainAnalysis)
    .sort((a: any, b: any) => b.count - a.count)
    .slice(0, 10);

  // Prepare data for multi-line domain evolution chart
  const domainYearCounts: Record<string, Record<string, number>> = {};
  filteredPapers.forEach(p => {
    const year = String(p.year);
    const domain = p.domain || 'Unknown';
    if (!domainYearCounts[domain]) domainYearCounts[domain] = {};
    if (!domainYearCounts[domain][year]) domainYearCounts[domain][year] = 0;
    domainYearCounts[domain][year]++;
  });
  const allYears = Array.from(new Set(filteredPapers.map(p => String(p.year)))).sort();
  const allLineDomains = Object.keys(domainYearCounts);
  const domainLineData = allYears.map(year => {
    const row: Record<string, number | string> = { year };
    allLineDomains.forEach(domain => {
      row[domain] = domainYearCounts[domain][year] || 0;
    });
    return row;
  });

  // Region analysis
  const regionAnalysis = processedPapers.reduce((acc: Record<string, RegionData>, paper) => {
    const region = paper.focusRegion || 'Unknown';
    if (!acc[region]) {
      acc[region] = { region, count: 0, domains: new Set() };
    }
    acc[region].count++;
    acc[region].domains.add(paper.domain || 'Unknown');
    return acc;
  }, {});

  const regionDataArray = Object.values(regionAnalysis)
    .map(region => ({
      ...region,
      domains: region.domains.size,
    }))
    .sort((a: any, b: any) => b.count - a.count)
    .slice(0, 10);

  // Author analysis with regions
  const authorAnalysis = filteredPapers.reduce((acc: Record<string, AuthorData>, paper) => {
    const authors = paper.authors;
    const authorRegions = paper.authorRegions;
    authors.forEach((author: string, idx: number) => {
      const authorRegion = authorRegions[idx] || 'Unknown';
      if (!acc[author]) {
        acc[author] = { 
          name: author, 
          papers: 0, 
          domains: new Set(),
          regions: new Set(),
          collaborations: new Set(),
          primaryRegion: authorRegion
        };
      }
      acc[author].papers++;
      acc[author].domains.add(paper.domain || 'Unknown');
      acc[author].regions.add(authorRegion);
      // Track collaborations
      authors.forEach((otherAuthor: string) => {
        if (otherAuthor !== author) {
          acc[author].collaborations.add(otherAuthor);
        }
      });
    });
    return acc;
  }, {});

  const authorDataArray = Object.values(authorAnalysis)
    .map(author => ({
      name: author.name,
      papers: author.papers,
      domainCount: author.domains.size,
      regionCount: author.regions.size,
      collaborationCount: author.collaborations.size,
      primaryRegion: author.primaryRegion,
    }))
    .sort((a: { papers: number }, b: { papers: number }) => b.papers - a.papers)
    .slice(0, 15);

  // Author region analysis
  const authorRegionAnalysis = filteredPapers.reduce((acc: Record<string, {
    region: string;
    authors: Set<string>;
    papers: number;
    domains: Set<string>;
  }>, paper) => {
    const authors = paper.authors;
    const authorRegions = paper.authorRegions;
    authors.forEach((author: string, idx: number) => {
      const authorRegion = authorRegions[idx] || 'Unknown';
      if (!acc[authorRegion]) {
        acc[authorRegion] = { 
          region: authorRegion, 
          authors: new Set(),
          papers: 0,
          domains: new Set()
        };
      }
      acc[authorRegion].authors.add(author);
      acc[authorRegion].papers++;
      acc[authorRegion].domains.add(paper.domain || 'Unknown');
    });
    return acc;
  }, {});

  const authorRegionDataArray = Object.values(authorRegionAnalysis)
    .map(region => ({
      region: region.region,
      authorCount: region.authors.size,
      paperCount: region.papers,
      domainCount: region.domains.size,
    }))
    .sort((a, b) => b.paperCount - a.paperCount)
    .slice(0, 15);

  // Robust cross-region collaboration analysis
  const crossRegionCollaboration = filteredPapers.reduce((acc: Record<string, {
    regions: string;
    papers: number;
    domains: Set<string>;
  }>, paper) => {
    const authors = paper.authors;
    const authorRegions = paper.authorRegions.map((r: string) => r.trim().toLowerCase()).filter(r => r && r !== 'unknown');
    // Map author index to region, skip if missing
    const regionMap = authors.map((_, idx) => authorRegions[idx] || '');
    // Unique region pairs in this paper
    const seenPairs = new Set<string>();
    for (let i = 0; i < regionMap.length; i++) {
      for (let j = i + 1; j < regionMap.length; j++) {
        const region1 = regionMap[i];
        const region2 = regionMap[j];
        if (region1 && region2 && region1 !== region2) {
          const pair = [region1, region2].sort().join(' ↔ ');
          if (!seenPairs.has(pair)) {
            seenPairs.add(pair);
            if (!acc[pair]) {
              acc[pair] = {
                regions: pair,
                papers: 0,
                domains: new Set()
              };
            }
            acc[pair].papers++;
            acc[pair].domains.add(paper.domain || 'Unknown');
          }
        }
      }
    }
    return acc;
  }, {});

  const crossRegionDataArray = Object.values(crossRegionCollaboration)
    .map(collab => ({
      regions: collab.regions
        .split(' ↔ ')
        .map((r: string) => r.charAt(0).toUpperCase() + r.slice(1))
        .join(' ↔ '),
      papers: collab.papers,
      domainCount: collab.domains.size,
    }))
    .sort((a, b) => b.papers - a.papers)
    .slice(0, 10);

  // Affiliation analysis
  const affiliationAnalysis = filteredPapers.reduce((acc: Record<string, {
    name: string;
    papers: number;
    domains: Set<string>;
    collaborators: Set<string>;
  }>, paper) => {
    paper.affiliations.forEach((affiliation: string) => {
      if (!acc[affiliation]) {
        acc[affiliation] = {
          name: affiliation,
          papers: 0,
          domains: new Set(),
          collaborators: new Set()
        };
      }
      acc[affiliation].papers++;
      acc[affiliation].domains.add(paper.domain || 'Unknown');
      // Add other affiliations as collaborators
      paper.affiliations.forEach((otherAffiliation: string) => {
        if (otherAffiliation !== affiliation) {
          acc[affiliation].collaborators.add(otherAffiliation);
        }
      });
    });
    return acc;
  }, {});

  const affiliationDataArray = Object.values(affiliationAnalysis)
    .map(aff => ({
      name: aff.name,
      papers: aff.papers,
      collaboratorCount: aff.collaborators.size,
      domainCount: aff.domains.size,
    }))
    .sort((a, b) => b.papers - a.papers)
    .slice(0, 15);

  // Collaboration patterns
  const collaborationPatterns = processedPapers.reduce((acc: Record<string, {
    type: string;
    count: number;
    papers: Paper[];
  }>, paper) => {
    const authorCount = paper.authors.length || 1;
    const collaborationType = authorCount === 1 ? 'Solo' : 
                             authorCount === 2 ? 'Duo' :
                             authorCount <= 5 ? 'Small Team' : 'Large Team';
    
    if (!acc[collaborationType]) {
      acc[collaborationType] = { type: collaborationType, count: 0, papers: [] };
    }
    
    acc[collaborationType].count++;
    acc[collaborationType].papers.push(paper);
    
    return acc;
  }, {});

  const collaborationData = Object.values(collaborationPatterns)
    .sort((a, b) => b.count - a.count);

  // Key metrics
  const metrics = {
    totalPapers: processedPapers.length,
    totalAuthors: Object.keys(authorAnalysis).length,
    totalAffiliations: Object.keys(affiliationAnalysis).length,
    uniqueDomains: Object.keys(domainAnalysis).length,
    uniqueRegions: Object.keys(regionAnalysis).length,
    uniqueAuthorRegions: Object.keys(authorRegionAnalysis).length,
    collaborativePapers: processedPapers.filter(p => p.authors.length > 1).length,
    crossRegionPapers: Object.values(crossRegionCollaboration).reduce((sum: number, collab) => sum + collab.papers, 0),
    recentPapers: processedPapers.filter(p => p.year >= 2020).length,
  };

  // Custom XAxis tick for better domain label readability
  const renderDomainTick = (props: DomainTickProps) => {
    const { x, y, payload } = props;
    const domain = String(payload.value || '');
    // Split long domain names into multiple lines
    const words = domain.split(' ');
    const lines: string[] = [];
    let currentLine = '';
    words.forEach(word => {
      if ((currentLine + ' ' + word).length > 12) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = currentLine ? currentLine + ' ' + word : word;
      }
    });
    if (currentLine) lines.push(currentLine);
    return (
      <g transform={`translate(${x},${y + 10})`}>
        {lines.map((line, i) => (
          <Text
            key={i}
            x={0}
            y={i * 14}
            textAnchor="end"
            verticalAnchor="start"
            fontSize={12}
            fill="#555"
          >
            {line}
          </Text>
        ))}
      </g>
    );
  };

  // Custom legend for better readability
  const customLegend = (labels: { color: string; value: string }[]) => (
    <div style={{ display: 'flex', gap: 24, justifyContent: 'center', marginTop: 12 }}>
      {labels.map(label => (
        <div key={label.value} style={{ display: 'flex', alignItems: 'center', fontSize: 15, fontWeight: 500 }}>
          <span style={{ background: label.color, width: 18, height: 18, display: 'inline-block', borderRadius: 4, marginRight: 8 }}></span>
          <span style={{ color: '#222' }}>{label.value}</span>
        </div>
      ))}
    </div>
  );

  // Reset authorStatsPage when filters change
  useEffect(() => { setAuthorStatsPage(1); }, [selectedAuthors, selectedDomains, selectedRegions, selectedInstitutions]);

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
          <h3 className="text-xl font-semibold mb-4 text-gray-700">Key Research Insights</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold text-lg mb-3 text-gray-700">Research Overview</h4>
              <ul className="space-y-2 text-gray-600">
                <li>• {metrics.totalPapers} research papers analyzed</li>
                <li>• {metrics.totalAuthors} unique authors contributing</li>
                <li>• {metrics.uniqueDomains} different research domains covered</li>
                <li>• {metrics.uniqueRegions} geographic regions represented</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-lg mb-3 text-gray-700">Collaboration Insights</h4>
              <ul className="space-y-2 text-gray-600">
                <li>• {metrics.collaborativePapers} collaborative papers ({((metrics.collaborativePapers / metrics.totalPapers) * 100).toFixed(1)}%)</li>
                <li>• {metrics.totalAffiliations} institutions involved</li>
                <li>• {metrics.uniqueAuthorRegions} unique author regions represented</li>
                <li>• {metrics.crossRegionPapers} cross-region collaborative papers</li>
                <li>• {metrics.recentPapers} papers from 2020 onwards</li>
                <li>• {collaborationData.length > 0 ? collaborationData[0].type : 'N/A'} is the most common collaboration pattern</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-gray-100 rounded-lg p-4 mb-6 flex flex-wrap gap-4 items-end">
          <div className="min-w-[220px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">Authors</label>
            <Select
              isMulti
              options={allAuthors.map(a => ({ value: a, label: a }))}
              value={selectedAuthors.map(a => ({ value: a, label: a }))}
              onChange={opts => setSelectedAuthors(opts.map(o => o.value))}
              classNamePrefix="react-select"
              placeholder="Select authors..."
            />
          </div>
          <div className="min-w-[220px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">Domains</label>
            <Select
              isMulti
              options={allDomains.map(d => ({ value: d, label: d }))}
              value={selectedDomains.map(d => ({ value: d, label: d }))}
              onChange={opts => setSelectedDomains(opts.map(o => o.value))}
              classNamePrefix="react-select"
              placeholder="Select domains..."
            />
          </div>
          <div className="min-w-[220px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">Author Regions</label>
            <Select
              isMulti
              options={allRegions.map(r => ({ value: r, label: r }))}
              value={selectedRegions.map(r => ({ value: r, label: r }))}
              onChange={opts => setSelectedRegions(opts.map(o => o.value))}
              classNamePrefix="react-select"
              placeholder="Select regions..."
            />
          </div>
          <div className="min-w-[220px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">Institutions</label>
            <Select
              isMulti
              options={allInstitutions.map(i => ({ value: i, label: i }))}
              value={selectedInstitutions.map(i => ({ value: i, label: i }))}
              onChange={opts => setSelectedInstitutions(opts.map(o => o.value))}
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
          <h3 className="text-xl font-semibold mb-4 text-gray-700">Research Evolution Timeline</h3>
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

        {/* Domain Evolution */}
        <div className="bg-white p-6 rounded-lg shadow-lg mb-8">
          <h3 className="text-xl font-semibold mb-4 text-gray-700">Domain Evolution Over Time</h3>
          <ResponsiveContainer width="100%" height={400} minWidth={700}>
            <LineChart data={domainLineData} margin={{ left: 30, right: 30, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="year" />
              <YAxis />
              <Tooltip />
              <Legend />
              {allLineDomains.map((domain, idx) => (
                <Line key={domain} type="monotone" dataKey={domain} stroke={['#2563eb', '#dc2626', '#16a34a', '#ca8a04', '#9333ea', '#eab308', '#f59e42', '#10b981'][idx % 8]} strokeWidth={2} name={domain} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Top Authors */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <h3 className="text-xl font-semibold mb-2 text-gray-700">Top Authors by Publications</h3>
            <div className="text-gray-500 text-sm mb-2">
              Shows the most prolific authors in the filtered dataset. &quot;Papers&quot; is the number of papers authored; &quot;Collaborations&quot; is the number of unique co-authors. Each author&apos;s domains are shown below their name. 
              <br />
              <span className="text-xs">Selecting an author, domain, region, or institution above will update this chart and all others below.</span>
            </div>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={authorDataArray.filter(a => selectedAuthors.length === 0 || selectedAuthors.includes(a.name))}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="name" 
                  angle={-45} 
                  textAnchor="end" 
                  height={100}
                  tick={props => {
                    const author = props.payload.value;
                    // Get all domains for this author from filteredPapers
                    const domains = Array.from(new Set(filteredPapers.filter(p => p.authors.includes(author)).map(p => p.domain))).filter(Boolean);
                    return (
                      <g transform={`translate(${props.x},${props.y + 10})`}>
                        <text x={0} y={0} textAnchor="end" fontSize={14} fontWeight={600} fill="#222">{author}</text>
                        {domains.length > 0 && (
                          <text x={0} y={18} textAnchor="end" fontSize={11} fill="#666">{domains.join(', ')}</text>
                        )}
                      </g>
                    );
                  }}
                />
                <YAxis />
                <Tooltip />
                <Bar dataKey="papers" fill="#2563eb" name="Papers" />
                <Bar dataKey="collaborationCount" fill="#16a34a" name="Collaborations" />
              </BarChart>
            </ResponsiveContainer>
            {customLegend([
              { color: '#2563eb', value: 'Papers' },
              { color: '#16a34a', value: 'Collaborations' },
            ])}
          </div>

          <div className="bg-white p-6 rounded-lg shadow-lg">
            <h3 className="text-xl font-semibold mb-2 text-gray-700">Top Institutions</h3>
            <div className="text-gray-500 text-sm mb-2">
              Shows the institutions most represented in the filtered dataset. &quot;Papers&quot; is the number of papers with at least one author from the institution; &quot;Collaborators&quot; is the number of unique collaborating institutions. Domains of collaboration: <span className="font-semibold text-gray-700">{[...new Set(filteredPapers.flatMap(p => p.domain))].join(', ') || 'N/A'}</span>.
              <br />
              <span className="text-xs">This chart updates with your filter selections above and is related to the co-author network below.</span>
            </div>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={affiliationDataArray}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="papers" fill="#f59e42" name="Papers" />
                <Bar dataKey="collaboratorCount" fill="#eab308" name="Collaborators" />
              </BarChart>
            </ResponsiveContainer>
            {customLegend([
              { color: '#f59e42', value: 'Papers' },
              { color: '#eab308', value: 'Collaborators' },
            ])}
          </div>
        </div>

        {/* After the Top Authors by Publications chart, add a statistics table for author-domain-paper count */}
        <div className="mt-6">
          <h4 className="text-lg font-semibold mb-2 text-gray-700">Author Domain Statistics</h4>
          <div className="overflow-x-auto">
            {(() => {
              const rows = authorDataArray
                .filter(a => selectedAuthors.length === 0 || selectedAuthors.includes(a.name))
                .flatMap(author => {
                  const domainCounts: Record<string, number> = {};
                  filteredPapers.forEach(p => {
                    const domain = String(p.domain);
                    // Compare author names case-insensitively and trimmed
                    const authorName = author.name.trim().toLowerCase();
                    const paperAuthors = Array.isArray(p.authors) ? p.authors.map((a: string) => a.trim().toLowerCase()) : [];
                    if (paperAuthors.includes(authorName)) {
                      if (!domainCounts[domain]) domainCounts[domain] = 0;
                      domainCounts[domain]!++;
                    }
                  });
                  return Object.entries(domainCounts).map(([domain, count]) => ({
                    author: author.name,
                    domain,
                    count,
                  })) as {author: string, domain: string, count: number}[];
                })
                .sort((a, b) => a.author.localeCompare(b.author) || a.domain.localeCompare(b.domain));
              const totalPages = Math.ceil(rows.length / statsPageSize);
              const pagedRows = rows.slice((authorStatsPage - 1) * statsPageSize, authorStatsPage * statsPageSize);
              return (
                <>
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="p-2 text-left">Author</th>
                        <th className="p-2 text-left">Domain</th>
                        <th className="p-2 text-left"># Papers</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedRows.map((row: {author: string, domain: string, count: number}, idx: number) => (
                        <tr key={`${row.author}-${row.domain}`} className={idx % 2 === 0 ? '' : 'bg-gray-50'}>
                          <td className="p-2">{row.author}</td>
                          <td className="p-2">{row.domain}</td>
                          <td className="p-2">{row.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="flex justify-between items-center mt-2">
                    <button className="px-3 py-1 rounded bg-gray-200" disabled={authorStatsPage === 1} onClick={() => setAuthorStatsPage(p => Math.max(1, p - 1))}>Prev</button>
                    <span className="text-xs">Page {authorStatsPage} of {totalPages || 1}</span>
                    <button className="px-3 py-1 rounded bg-gray-200" disabled={authorStatsPage === totalPages || totalPages === 0} onClick={() => setAuthorStatsPage(p => Math.min(totalPages, p + 1))}>Next</button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>

        {/* After the Top Institutions chart, add a statistics table for institution-domain-paper count */}
        <div className="mt-6">
          <h4 className="text-lg font-semibold mb-2 text-gray-700">Institution Domain Statistics</h4>
          <div className="overflow-x-auto">
            {(() => {
              const rows = affiliationDataArray
                .filter(i => selectedInstitutions.length === 0 || selectedInstitutions.includes(i.name))
                .flatMap(inst => {
                  const domainCounts: Record<string, number> = {};
                  filteredPapers.forEach(p => {
                    const affs = Array.isArray(p.affiliations) ? p.affiliations : [];
                    if (affs.includes(inst.name)) {
                      const domain = String(p.domain);
                      if (!domainCounts[domain]) domainCounts[domain] = 0;
                      domainCounts[domain]!++;
                    }
                  });
                  return Object.entries(domainCounts).map(([domain, count]) => ({
                    institution: inst.name,
                    domain,
                    count,
                  })) as {institution: string, domain: string, count: number}[];
                })
                .sort((a, b) => a.institution.localeCompare(b.institution) || a.domain.localeCompare(b.domain));
              const totalPages = Math.ceil(rows.length / statsPageSize);
              const pagedRows = rows.slice((instStatsPage - 1) * statsPageSize, instStatsPage * statsPageSize);
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
                      {pagedRows.map((row: {institution: string, domain: string, count: number}, idx: number) => (
                        <tr key={`${row.institution}-${row.domain}`} className={idx % 2 === 0 ? '' : 'bg-gray-50'}>
                          <td className="p-2">{row.institution}</td>
                          <td className="p-2">{row.domain}</td>
                          <td className="p-2">{row.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="flex justify-between items-center mt-2">
                    <button className="px-3 py-1 rounded bg-gray-200" disabled={instStatsPage === 1} onClick={() => setInstStatsPage(p => Math.max(1, p - 1))}>Prev</button>
                    <span className="text-xs">Page {instStatsPage} of {totalPages || 1}</span>
                    <button className="px-3 py-1 rounded bg-gray-200" disabled={instStatsPage === totalPages || totalPages === 0} onClick={() => setInstStatsPage(p => Math.min(totalPages, p + 1))}>Next</button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>

        {/* Co-Author Network Visualization */}
        <div className="bg-white p-6 rounded-lg shadow-lg mb-8">
          <h3 className="text-xl font-semibold mb-2 text-gray-700">Co-Author Network</h3>
          <div className="text-gray-500 text-sm mb-2">
            Visualizes the collaboration network among authors in the filtered dataset. Each node is an author (hover to see affiliation and region); edges represent co-authorship. The network reflects all filters above. Collaboration domains: <span className="font-semibold text-gray-700">{[...new Set(filteredPapers.flatMap(p => p.domain))].join(', ') || 'N/A'}</span>.
          </div>
          <CoAuthorNetworkGraph papers={filteredPapers} />
        </div>

        {/* Author Regions Analysis */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <h3 className="text-xl font-semibold mb-2 text-gray-700">Author Regions Distribution</h3>
            <div className="text-gray-500 text-sm mb-2">
              Shows the distribution of author regions (countries) in the filtered dataset. Updates with your filter selections above.
            </div>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={authorRegionDataArray}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="region" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="paperCount" fill="#8884d8" name="Papers" />
                <Bar dataKey="authorCount" fill="#82ca9d" name="Authors" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-lg">
            <h3 className="text-xl font-semibold mb-2 text-gray-700">Cross-Region Collaborations</h3>
            <div className="text-gray-500 text-sm mb-2">
              Shows the number of papers co-authored by researchers from different regions in the filtered dataset. Updates with your filter selections above.
            </div>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={crossRegionDataArray}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="regions" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="papers" fill="#ff7300" name="Joint Papers" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Papers Table */}
        <div className="bg-white p-6 rounded-lg shadow-lg mb-8">
          <h3 className="text-xl font-semibold mb-2 text-gray-700">Recent Papers</h3>
          <div className="text-gray-500 text-sm mb-2">
            Table of the most recent papers in the filtered dataset. All columns reflect your current filter selections above.
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="bg-gray-100">
                  <th className="p-3 text-left">Paper Title</th>
                  <th className="p-3 text-left">Authors</th>
                  <th className="p-3 text-left">Author Regions</th>
                  <th className="p-3 text-left">Year</th>
                  <th className="p-3 text-left">Domain</th>
                  <th className="p-3 text-left">Focus Region</th>
                </tr>
              </thead>
              <tbody>
                {filteredPapers
                  .sort((a, b) => b.year - a.year)
                  .slice(0, 10)
                  .map((paper) => (
                    <tr key={paper.SN} className="border-b hover:bg-gray-50">
                      <td className="p-3">{paper['Paper Title']}</td>
                      <td className="p-3">{paper.authors.slice(0, 3).join(', ')}{paper.authors.length > 3 ? '...' : ''}</td>
                      <td className="p-3">{paper.authorRegions.slice(0, 3).join(', ')}{paper.authorRegions.length > 3 ? '...' : ''}</td>
                      <td className="p-3">{paper.year}</td>
                      <td className="p-3">{paper.domain}</td>
                      <td className="p-3">{paper.focusRegion}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdvancedAnalytics; 