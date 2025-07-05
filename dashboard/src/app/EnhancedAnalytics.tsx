"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, AreaChart, Area, Text } from 'recharts';
import { useState, useMemo } from 'react';
import CoAuthorNetworkGraph from './CoAuthorNetworkGraph';

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

const AdvancedAnalytics = ({ papers }: { papers: Paper[] }) => {
  const [selectedView, setSelectedView] = useState('overview');
  // Multi-select filters for collaborations
  const [selectedAuthors, setSelectedAuthors] = useState<string[]>([]);
  const [selectedDomains, setSelectedDomains] = useState<string[]>([]);
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);

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

  // Get all unique authors, domains, and regions for filter options
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
      return authorMatch && domainMatch && regionMatch;
    });
  }, [processedPapers, selectedAuthors, selectedDomains, selectedRegions]);

  // Year analysis
  const yearData = processedPapers.reduce((acc: Record<number, any>, paper) => {
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
  const domainAnalysis = processedPapers.reduce((acc: Record<string, any>, paper) => {
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

  // Region analysis
  const regionAnalysis = processedPapers.reduce((acc: Record<string, any>, paper) => {
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
  const authorAnalysis = processedPapers.reduce((acc: Record<string, any>, paper) => {
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
    .sort((a: any, b: any) => b.papers - a.papers)
    .slice(0, 15);

  // Author region analysis
  const authorRegionAnalysis = processedPapers.reduce((acc: Record<string, any>, paper) => {
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
    .sort((a: any, b: any) => b.paperCount - a.paperCount)
    .slice(0, 15);

  // Cross-region collaboration analysis
  const crossRegionCollaboration = processedPapers.reduce((acc: Record<string, any>, paper) => {
    const authors = paper.authors;
    const authorRegions = paper.authorRegions;
    
    for (let i = 0; i < authors.length; i++) {
      for (let j = i + 1; j < authors.length; j++) {
        const region1 = authorRegions[i] || 'Unknown';
        const region2 = authorRegions[j] || 'Unknown';
        
        if (region1 !== region2) {
          const pair = [region1, region2].sort().join(' ↔ ');
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
    return acc;
  }, {});

  const crossRegionDataArray = Object.values(crossRegionCollaboration)
    .map(collab => ({
      regions: collab.regions,
      papers: collab.papers,
      domainCount: collab.domains.size,
    }))
    .sort((a: any, b: any) => b.papers - a.papers)
    .slice(0, 10);

  // Affiliation analysis
  const affiliationAnalysis = processedPapers.reduce((acc: Record<string, any>, paper) => {
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
    .sort((a: any, b: any) => b.papers - a.papers)
    .slice(0, 15);

  // Collaboration patterns
  const collaborationPatterns = processedPapers.reduce((acc: Record<string, any>, paper) => {
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
    .sort((a: any, b: any) => b.count - a.count);

  // Key metrics
  const metrics = {
    totalPapers: processedPapers.length,
    totalAuthors: Object.keys(authorAnalysis).length,
    totalAffiliations: Object.keys(affiliationAnalysis).length,
    uniqueDomains: Object.keys(domainAnalysis).length,
    uniqueRegions: Object.keys(regionAnalysis).length,
    uniqueAuthorRegions: Object.keys(authorRegionAnalysis).length,
    collaborativePapers: processedPapers.filter(p => p.authors.length > 1).length,
    crossRegionPapers: Object.values(crossRegionCollaboration).reduce((sum: number, collab: any) => sum + collab.papers, 0),
    recentPapers: processedPapers.filter(p => p.year >= 2020).length,
  };

  // Custom XAxis tick for better domain label readability
  const renderDomainTick = (props: any) => {
    const { x, y, payload } = props;
    const domain = String(payload.value || '');
    // Split long domain names into multiple lines
    const words = domain.split(' ');
    let lines = [];
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

  return (
    <div className="w-full p-6 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-2xl font-bold text-center mb-8 text-gray-800">
          Research Analytics Dashboard
        </h2>

        {/* View Navigation */}
        <div className="flex justify-center mb-6">
          <div className="bg-white rounded-lg shadow-lg p-1">
            <button
              className={`px-6 py-3 rounded-md font-semibold transition-colors ${
                selectedView === 'overview'
                  ? 'bg-blue-500 text-white'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
              onClick={() => setSelectedView('overview')}
            >
              Overview
            </button>
            <button
              className={`px-6 py-3 rounded-md font-semibold transition-colors ${
                selectedView === 'trends'
                  ? 'bg-blue-500 text-white'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
              onClick={() => setSelectedView('trends')}
            >
              Trends
            </button>
            <button
              className={`px-6 py-3 rounded-md font-semibold transition-colors ${
                selectedView === 'collaborations'
                  ? 'bg-blue-500 text-white'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
              onClick={() => setSelectedView('collaborations')}
            >
              Collaborations
            </button>
          </div>
        </div>

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

        {selectedView === 'overview' && (
          <>
            {/* Domain Distribution */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <div className="bg-white p-6 rounded-lg shadow-lg">
                <h3 className="text-xl font-semibold mb-4 text-gray-700">Research Domains</h3>
                <ResponsiveContainer width="100%" height={400}>
                  <PieChart>
                    <Pie
                      data={domainDataArray}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ domain, count }) => `${domain} (${count})`}
                      outerRadius={120}
                      fill="#8884d8"
                      dataKey="count"
                    >
                      {domainDataArray.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'][index % 5]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-lg">
                <h3 className="text-xl font-semibold mb-4 text-gray-700">Focus Regions</h3>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={regionDataArray}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="region" angle={-45} textAnchor="end" height={100} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#8884d8" name="Papers" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Collaboration Patterns */}
            <div className="bg-white p-6 rounded-lg shadow-lg mb-8">
              <h3 className="text-xl font-semibold mb-4 text-gray-700">Collaboration Patterns</h3>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={collaborationData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="type" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#8884d8" name="Papers" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}

        {selectedView === 'trends' && (
          <>
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
                <BarChart data={domainDataArray} margin={{ left: 30, right: 30, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="domain" height={60} tick={renderDomainTick} interval={0} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#8884d8" name="Papers" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}

        {selectedView === 'collaborations' && (
          <>
            {/* Filter Bar */}
            <div className="bg-gray-100 rounded-lg p-4 mb-6 flex flex-wrap gap-4 items-end">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Authors</label>
                <select
                  multiple
                  className="w-48 border rounded px-2 py-1"
                  value={selectedAuthors}
                  onChange={e => {
                    const options = Array.from(e.target.selectedOptions).map(o => o.value);
                    setSelectedAuthors(options);
                  }}
                >
                  {allAuthors.map(author => (
                    <option key={author} value={author}>{author}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Domains</label>
                <select
                  multiple
                  className="w-48 border rounded px-2 py-1"
                  value={selectedDomains}
                  onChange={e => {
                    const options = Array.from(e.target.selectedOptions).map(o => o.value);
                    setSelectedDomains(options);
                  }}
                >
                  {allDomains.map(domain => (
                    <option key={domain} value={domain}>{domain}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Author Regions</label>
                <select
                  multiple
                  className="w-48 border rounded px-2 py-1"
                  value={selectedRegions}
                  onChange={e => {
                    const options = Array.from(e.target.selectedOptions).map(o => o.value);
                    setSelectedRegions(options);
                  }}
                >
                  {allRegions.map(region => (
                    <option key={region} value={region}>{region}</option>
                  ))}
                </select>
              </div>
              <button
                className="ml-4 bg-gray-400 text-white px-4 py-2 rounded hover:bg-gray-500"
                onClick={() => {
                  setSelectedAuthors([]);
                  setSelectedDomains([]);
                  setSelectedRegions([]);
                }}
              >
                Clear Filters
              </button>
            </div>

            {/* Top Authors */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <div className="bg-white p-6 rounded-lg shadow-lg">
                <h3 className="text-xl font-semibold mb-4 text-gray-700">Top Authors by Publications</h3>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={authorDataArray.filter(a => selectedAuthors.length === 0 || selectedAuthors.includes(a.name))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="papers" fill="#8884d8" name="Papers" />
                    <Bar dataKey="collaborationCount" fill="#82ca9d" name="Collaborations" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-lg">
                <h3 className="text-xl font-semibold mb-4 text-gray-700">Top Institutions</h3>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={affiliationDataArray}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="papers" fill="#ff7300" name="Papers" />
                    <Bar dataKey="collaboratorCount" fill="#ffc658" name="Collaborators" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Co-Author Network Visualization */}
            <div className="bg-white p-6 rounded-lg shadow-lg mb-8">
              <h3 className="text-xl font-semibold mb-4 text-gray-700">Co-Author Network</h3>
              <CoAuthorNetworkGraph papers={filteredPapers} />
            </div>

            {/* Author Regions Analysis */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <div className="bg-white p-6 rounded-lg shadow-lg">
                <h3 className="text-xl font-semibold mb-4 text-gray-700">Author Regions Distribution</h3>
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
                <h3 className="text-xl font-semibold mb-4 text-gray-700">Cross-Region Collaborations</h3>
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
              <h3 className="text-xl font-semibold mb-4 text-gray-700">Recent Papers</h3>
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
                      .map((paper, index) => (
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
          </>
        )}

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
      </div>
    </div>
  );
};

export default AdvancedAnalytics; 