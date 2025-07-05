'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { useEffect, useState } from 'react';
import Papa from 'papaparse';
import { ComposableMap, Geographies, Geography, ZoomableGroup } from 'react-simple-maps';
import { saveAs } from 'file-saver';

const DOMAIN_COLORS = ['#2563eb', '#dc2626', '#16a34a', '#ca8a04', '#9333ea', '#eab308', '#f59e42', '#10b981'];

// Define a Paper type for better type safety
type Paper = {
  SN?: string;
  'Paper Title'?: string;
  'Authors'?: string;
  DOI?: string;                  // Added DOI
  'Author Regions'?: string;
  'Affiliations'?: string;
  Year?: string;
  'Focus Region'?: string;       // Added Focus Region
  Domain?: string;
  Abstract?: string;            
  Citations?: string;
  [key: string]: unknown;
};

const BASE_PATH = '/algorithmic-bias-survey';

const BiasResearchDashboard = () => {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(true);
  const [tooltip, setTooltip] = useState<{ content: string; x: number; y: number } | null>(null);
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [filterRegion, setFilterRegion] = useState('');
  const [filterDomain, setFilterDomain] = useState('');
  const [filterAuthor, setFilterAuthor] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [modalPaper, setModalPaper] = useState<Paper | null>(null);
  const pageSize = 10;
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

  // After parsing:
  const allRows = papers; // All parsed rows
  const validPapers = allRows.filter(paper => {
    const year = (String(paper['Year'] || '') || '').trim();
    const region = (String(paper['Focus Region'] || '') || '').trim();
    return year && region;
  });
  const skippedPapers = allRows.filter(paper => !validPapers.includes(paper));

  // For display:
  const totalPapers = allRows.length;
  const skippedCount = skippedPapers.length;

  // Publication Timeline (yearData)
  const yearMap: Record<string, number> = {};
  validPapers.forEach(paper => {
    const year = (String(paper['Year'] || '') || '').trim();
    if (year) yearMap[year] = (yearMap[year] || 0) + 1;
  });
  const yearData = Object.entries(yearMap)
    .map(([year, count]) => ({ year: Number(year), count }))
    .sort((a, b) => a.year - b.year);

  // Author Regions (regionData)
  const regionMap: Record<string, number> = {};
  validPapers.forEach(paper => {
    const region = (String(paper['Focus Region'] || '') || '').trim();
    if (region) regionMap[region] = (regionMap[region] || 0) + 1;
  });
  const regionData = Object.entries(regionMap).map(([region, count]) => ({ region, count }));

  // Research Domains (domainData)
  const domainMap: Record<string, number> = {};
  validPapers.forEach(paper => {
    const domain = (String(paper['Domain'] || '') || '').trim().toLowerCase();
    if (domain) domainMap[domain] = (domainMap[domain] || 0) + 1;
  });
  const domainTotal = Object.values(domainMap).reduce((sum, c) => sum + c, 0);
  const domainData = Object.entries(domainMap).map(([domain, count], i) => ({
    domain,
    count,
    percentage: ((count / domainTotal) * 100).toFixed(1),
    color: DOMAIN_COLORS[i % DOMAIN_COLORS.length],
  }));
  console.log('domainData', domainData);

  // For year range, use all years in papers, not just validPapers
  const allYears = papers
    .map(paper => (String(paper['Year'] || '') || '').trim())
    .filter(year => year)
    .map(Number)
    .filter(year => !isNaN(year));
  const minYear = allYears.length ? Math.min(...allYears) : '';
  const maxYear = allYears.length ? Math.max(...allYears) : '';
  const years = minYear && maxYear ? `${minYear}-${maxYear}` : '';

  // Summary statistics
  const totalDomains = domainData.length;
  const totalRegions = regionData.length;

  // Dynamic Key Insights
  // 1. Peak research activity year
  const peakYear = yearData.reduce((max, curr) => curr.count > max.count ? curr : max, {year: 0, count: 0});
  // 2. Growth period
  const growthPeriod = yearData.length > 1 ? `${yearData[0].year}-${yearData[yearData.length-1].year}` : '';
  // 3. Emerging focus on LLM bias
  const recentLLM = domainData.find(d => d.domain.toLowerCase().includes('llm') || d.domain.toLowerCase().includes('nlp'));
  const llmInsight = recentLLM ? `Emerging focus on ${recentLLM.domain} (${yearData[yearData.length-1]?.year})` : '';
  // 4. Strong foundation in general fairness research
  const fairnessInsight = domainData.length > 0 && domainData[0].domain.toLowerCase().includes('fairness') ? 'Strong foundation in general fairness research' : '';
  // 5. Top region/country
  const topRegion = regionData.length > 0 ? regionData[0] : null;
  // 6. European/Asian presence
  const europeanCountries = ['UK', 'Germany', 'France', 'Italy', 'Spain', 'Switzerland', 'Norway', 'Denmark'];
  const asianCountries = ['China', 'India', 'Hong Kong', 'South Korea', 'Turkey', 'Israel'];
  const hasEurope = regionData.some(r => europeanCountries.includes(r.region));
  const hasAsia = regionData.some(r => asianCountries.includes(r.region));

  // Map data processing
  const countryDomainMap: Record<string, { domain: string; count: number; papers: string[] }> = {};
  
  validPapers.forEach(paper => {
    const region = (String(paper['Focus Region'] || '') || '').trim();
    const domain = (String(paper['Domain'] || '') || '').trim();
    const title = paper['Paper Title'] || 'Unknown';
    
    if (region && domain) {
      if (!countryDomainMap[region]) {
        countryDomainMap[region] = { domain: '', count: 0, papers: [] };
      }
      countryDomainMap[region].count++;
      countryDomainMap[region].papers.push(title);
      
      // Determine dominant domain for this country
      const countryPapers = validPapers.filter(p => 
        (String(p['Focus Region'] || '') || '').trim() === region
      );
      const domainCounts: Record<string, number> = {};
      countryPapers.forEach(p => {
        const d = (String(p['Domain'] || '') || '').trim().toLowerCase();
        if (d) domainCounts[d] = (domainCounts[d] || 0) + 1;
      });
      const dominantDomain = Object.entries(domainCounts).reduce((a, b) => a[1] > b[1] ? a : b)[0];
      countryDomainMap[region].domain = dominantDomain;
    }
  });

  // Country to ISO and GeoJSON name mapping for the map
  const countryToGeoName: Record<string, string> = {
    'USA': 'United States of America',
    'UK': 'United Kingdom',
    'South Korea': 'Republic of Korea',
    'Russia': 'Russian Federation',
    'Iran': 'Iran (Islamic Republic of)',
    'Vietnam': 'Viet Nam',
    'Syria': 'Syrian Arab Republic',
    'Venezuela': 'Venezuela (Bolivarian Republic of)',
    'Tanzania': 'United Republic of Tanzania',
    'Moldova': 'Republic of Moldova',
    'Bolivia': 'Bolivia (Plurinational State of)',
    'Brunei': 'Brunei Darussalam',
    'Laos': "Lao People's Democratic Republic",
    'North Korea': "Democratic People's Republic of Korea",
    'Czech Republic': 'Czechia',
    'Ivory Coast': 'Côte d&#39;Ivoire',
    'Swaziland': 'Eswatini',
    'Cape Verde': 'Cabo Verde',
    'Palestine': 'Palestine, State of',
    // Add more as needed
  };

  // Extract all unique authors for the filter dropdown
  const getAllUniqueAuthors = () => {
    const allAuthors = new Set<string>();
    papers.forEach(paper => {
      const authors = (String(paper['Authors'] || '') || '').split(';').map(a => a.trim()).filter(Boolean);
      authors.forEach(author => allAuthors.add(author));
    });
    return Array.from(allAuthors).sort();
  };

  const uniqueAuthors = getAllUniqueAuthors();

  // For region filter, use all unique author regions:
  const getAllUniqueAuthorRegions = () => {
    const allRegions = new Set<string>();
    papers.forEach(paper => {
      const regions: string[] = String(paper['Author Regions'] || '').split(';').map((r: string) => r.trim()).filter(Boolean);
      regions.forEach((region: string) => allRegions.add(region));
    });
    return Array.from(allRegions).sort();
  };

  const uniqueAuthorRegions = getAllUniqueAuthorRegions();

  // Add useEffect to reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterYear, filterRegion, filterDomain, filterAuthor]);

  const filteredPapers = papers.filter(paper => {
    const title = (String(paper['Paper Title'] || '') || '').toLowerCase().trim();
    const author = (String(paper['Authors'] || '') || '').toLowerCase().trim();
    const doi = (String(paper['DOI'] || '') || '').toLowerCase().trim();
    const domain = (String(paper['Domain'] || '') || '').toLowerCase().trim();
    const region = (String(paper['Focus Region'] || '') || '').trim();
    const year = (String(paper['Year'] || '') || '').trim();
    const q = searchQuery.toLowerCase().trim();
    
    // Check if any author in the paper matches the author filter
    const paperAuthors = (String(paper['Authors'] || '') || '').split(';').map(a => a.trim().toLowerCase());
    const authorMatches = !filterAuthor || paperAuthors.some(a => a.includes(filterAuthor.toLowerCase()));
    
    return (
      (!searchQuery || title.includes(q) || author.includes(q) || domain.includes(q) || region.includes(q) || doi.includes(q)) &&
      (!filterYear || year === filterYear) &&
      (!filterRegion || region === filterRegion.toLowerCase().trim()) &&
      (!filterDomain || domain === filterDomain.toLowerCase().trim()) &&
      authorMatches
    );
  });

  // Sorting logic
  const sortedPapers = [...filteredPapers].sort((a, b) => {
    if (!sortConfig) return 0;
    const aVal = String(a[sortConfig.key] || '') || '';
    const bVal = String(b[sortConfig.key] || '') || '';
    if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  // Pagination logic
  const totalPages = Math.ceil(sortedPapers.length / pageSize);
  const pagedPapers = sortedPapers.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // CSV Export logic
  function exportCSV(papersToExport: Paper[], filename: string) {
    const headers = ['SN', 'Paper Title', 'Authors', 'DOI', 'Year', 'Author Regions', 'Focus Region', 'Domain', '']
    const rows = papersToExport.map(p => headers.map(h => String(p[h] || '').replace(/\n/g, ' ')));
    const csv = [headers.join(','), ...rows.map(r => r.map(f => `"${f.replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, filename);
  }

  return (
    <div className="w-full bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto pt-8">
        {loading ? (
          <div className="text-center text-gray-500">Loading data...</div>
        ) : error ? (
          <div className="text-center text-red-600 font-semibold">{error}</div>
        ) : papers.length === 0 ? (
          <div className="text-center text-red-600 font-semibold">No data found. Please ensure papers.csv is present in the public directory and accessible at /papers.csv.</div>
        ) : (
          <>
            {/* Original dashboard content */}
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* Publication Timeline */}
                <div className="bg-white p-6 rounded-lg shadow-lg">
                  <h2 className="text-xl font-semibold mb-4 text-gray-700">Publication Timeline ({years})</h2>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={yearData} margin={{ right: 30 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="year"
                        type="number"
                        domain={[
                          yearData.length > 0 ? yearData[0].year : 'auto',
                          yearData.length > 0 ? yearData[yearData.length - 1].year : 'auto'
                        ]}
                        tick={{ fontSize: 12 }}
                        interval={0}
                        allowDuplicatedCategory={false}
                        minTickGap={5}
                        padding={{ right: 20 }}
                        label={{ value: 'Year', position: 'insideBottom', offset: -5 }}
                      />
                      <YAxis dataKey="count" tick={{ fontSize: 12 }} label={{ value: 'Count', angle: -90, position: 'insideLeft' }} />
                      <Tooltip />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="count" 
                        stroke="#2563eb" 
                        strokeWidth={3}
                        dot={{ fill: '#2563eb', strokeWidth: 2, r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Domain Distribution Pie Chart */}
                <div className="bg-white p-6 rounded-lg shadow-lg">
                  <h2 className="text-xl font-semibold mb-4 text-gray-700">Research Domain Distribution</h2>
                  <ResponsiveContainer width="100%" height={380}>
                    <PieChart>
                      <Pie
                        data={domainData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ percent }) => percent && percent > 0.04 ? `${(percent * 100).toFixed(1)}%` : ''}
                        outerRadius={110}
                        fill="#8884d8"
                        dataKey="count"
                        nameKey="domain"
                      >
                        {domainData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap justify-center mt-4">
                    {domainData.map((entry) => (
                      <div key={entry.domain} className="flex items-center mr-6 mb-2">
                        <span style={{ backgroundColor: entry.color, width: 16, height: 16, display: 'inline-block', marginRight: 8, borderRadius: 3 }}></span>
                        <span className="text-sm text-gray-700">{entry.domain}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Author Regions Bar Chart */}
              <div className="bg-white p-6 rounded-lg shadow-lg mb-6">
                <h2 className="text-xl font-semibold mb-4 text-gray-700">Author Regions Distribution</h2>
                {regionData.length === 0 ? (
                  <div className="text-gray-500">No data loaded. Check that papers.csv is in the public folder and the header is exactly &apos;Pub Year & Author Region&apos;.</div>
                ) : (
                  <div style={{ width: '100%', overflowX: 'auto' }}>
                    <div style={{ minWidth: 900 }}>
                      <ResponsiveContainer width="100%" height={400}>
                        <BarChart data={regionData} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis
                            dataKey="region"
                            angle={-45}
                            textAnchor="end"
                            interval={0}
                            height={100}
                            label={{ value: 'Country', position: 'insideBottom', offset: -60 }}
                          />
                          <YAxis label={{ value: 'Count', angle: -90, position: 'insideLeft' }} />
                          <Tooltip />
                          <Bar dataKey="count" fill="#16a34a" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </div>

              {/* Summary Statistics Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="bg-blue-500 text-white p-6 rounded-lg shadow-lg">
                  <h3 className="text-lg font-semibold">Total Papers</h3>
                  <p className="text-3xl font-bold">{totalPapers}</p>
                </div>
                <div className="bg-green-500 text-white p-6 rounded-lg shadow-lg">
                  <h3 className="text-lg font-semibold">Years Covered</h3>
                  <p className="text-3xl font-bold">{years}</p>
                </div>
                <div className="bg-purple-500 text-white p-6 rounded-lg shadow-lg">
                  <h3 className="text-lg font-semibold">Research Domains</h3>
                  <p className="text-3xl font-bold">{totalDomains}</p>
                </div>
                <div className="bg-orange-500 text-white p-6 rounded-lg shadow-lg">
                  <h3 className="text-lg font-semibold">Countries/Regions</h3>
                  <p className="text-3xl font-bold">{totalRegions}</p>
                </div>
              </div>
              {skippedCount > 0 && (
                <div className="text-sm text-yellow-700 bg-yellow-100 rounded p-2 mb-4">
                  Note: {skippedCount} papers were skipped in charts due to missing year or region.<br/>
                  Skipped papers: {skippedPapers.map(p => p['SN'] || p['Paper Title']).join(', ')}
                </div>
              )}

              {/* Domain Map Visualization */}
              <div className="bg-white p-6 rounded-lg shadow-lg">
                <h2 className="text-xl font-semibold mb-4 text-gray-700">Research Domain Geographic Distribution</h2>
                <div className="mb-4">
                  <p className="text-sm text-gray-600 mb-2">Countries are colored by their dominant research domain. Hover over countries to see details or click on the domain legend to filter the map.</p>
                  <div className="flex flex-wrap gap-2">
                    {domainData.map((entry) => (
                      <button
                        key={entry.domain}
                        className={`flex items-center text-xs px-2 py-1 rounded ${selectedDomain === entry.domain ? 'ring-2 ring-blue-500' : ''}`}
                        style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                        onClick={() => setSelectedDomain(selectedDomain === entry.domain ? null : entry.domain)}
                        type="button"
                      >
                        <span style={{ backgroundColor: entry.color, width: 12, height: 12, display: 'inline-block', marginRight: 4, borderRadius: 2 }}></span>
                        <span className="text-gray-700">{entry.domain}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ width: '100%', maxWidth: '100%', height: 500, marginBottom: 48, overflow: 'hidden' }}>
                  {/* For mobile, consider using a smaller height via a media query or Tailwind class */}
                  <ComposableMap
                    projection="geoEqualEarth"
                    projectionConfig={{
                      scale: 147
                    }}
                  >
                    <ZoomableGroup>
                      <Geographies geography="https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json">
                        {({ geographies }) =>
                          geographies.map((geo) => {
                            const countryName = geo.properties.name;
                            const altName = Object.keys(countryToGeoName).find(key => countryToGeoName[key] === countryName);
                            const countryData = countryDomainMap[countryName] || (altName ? countryDomainMap[altName] : undefined);
                            let fillColor = '#f3f4f6';
                            let isDominant = false;
                            let isPresent = false;
                            if (countryData && selectedDomain) {
                              // Check if selectedDomain is dominant
                              isDominant = countryData.domain.toLowerCase() === selectedDomain.toLowerCase();
                              // Check if selectedDomain is present at all
                              const countryPapers = validPapers.filter(p => {
                                const region = (String(p['Focus Region'] || '') || '').trim();
                                return region === (altName || countryName);
                              });
                              isPresent = countryPapers.some(p => (String(p['Domain'] || '') || '').trim().toLowerCase() === selectedDomain.toLowerCase());
                              const domainEntry = domainData.find(d => d.domain.toLowerCase() === selectedDomain.toLowerCase());
                              if (isDominant) fillColor = domainEntry ? domainEntry.color : '#f3f4f6';
                              else if (isPresent) fillColor = domainEntry ? `${domainEntry.color}80` : '#e5e7eb'; // lighter color (add alpha)
                            } else if (countryData) {
                              const domainIndex = domainData.findIndex(d => d.domain.toLowerCase() === (String(countryData?.domain) || '').toLowerCase());
                              fillColor = domainData[domainIndex]?.color || '#f3f4f6';
                              isDominant = true;
                            }
                            
                            return (
                              <Geography
                                key={geo.rsmKey}
                                geography={geo}
                                fill={fillColor}
                                stroke="#ffffff"
                                strokeWidth={0.5}
                                style={{
                                  default: { outline: 'none' },
                                  hover: { 
                                    fill: countryData ? '#1f2937' : '#e5e7eb',
                                    outline: 'none',
                                    cursor: 'pointer'
                                  },
                                  pressed: { outline: 'none' }
                                }}
                                onMouseEnter={() => {
                                  if (countryData) {
                                    setTooltip({
                                      content: `${countryName}: ${countryData.count} papers in ${countryData.domain}`,
                                      x: 0,
                                      y: 0
                                    });
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
                        position: 'absolute',
                        left: tooltip.x,
                        top: tooltip.y,
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        color: 'white',
                        padding: '8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        pointerEvents: 'none',
                        zIndex: 1000
                      }}
                    >
                      {tooltip.content}
                    </div>
                  )}
                </div>
              </div>

              {/* Key Insights */}
              <div className="bg-white p-6 rounded-lg shadow-lg mt-6">
                <h2 className="text-xl font-semibold mb-4 text-gray-700">Key Research Insights</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="font-semibold text-lg mb-4 text-gray-700">Research Trends</h3>
                    <ul className="space-y-2 text-gray-600">
                      {peakYear.count > 0 && <li>• Peak activity in {peakYear.year} with {peakYear.count} publications</li>}
                      {growthPeriod && <li>• Research period: {growthPeriod}</li>}
                      {llmInsight && <li>• {llmInsight}</li>}
                      {fairnessInsight && <li>• {fairnessInsight}</li>}
                      <li>• {totalDomains} distinct research domains covered</li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg mb-4 text-gray-700">Geographic Distribution</h3>
                    <ul className="space-y-2 text-gray-600">
                      {topRegion && <li>• {topRegion.region} leads with {Math.round((topRegion.count / totalPapers) * 100)}% of publications</li>}
                      {hasEurope && <li>• Strong European presence (UK, Germany, etc.)</li>}
                      {hasAsia && <li>• Growing Asian contribution (China, India, etc.)</li>}
                      <li>• Global collaborative research trend</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-lg mt-6">
                <h2 className="text-xl font-semibold mb-4 text-gray-700">All Papers</h2>
                <div className="flex flex-wrap gap-4 mb-4">
                  <input
                    type="text"
                    placeholder="Search by title, author, or keyword..."
                    className="border rounded px-3 py-2 bg-white text-black w-full md:w-64"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                  <select
                    className="border rounded px-3 py-2 bg-white text-black"
                    value={filterYear}
                    onChange={e => setFilterYear(e.target.value)}
                  >
                    <option value="">All Years</option>
                    {Array.from(new Set(papers.map(p => (String(p['Year'] || '') || '').trim()).filter(Boolean))).sort().map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                  <select
                    className="border rounded px-3 py-2 bg-white text-black"
                    value={filterRegion}
                    onChange={e => setFilterRegion(e.target.value)}
                  >
                    <option value="">All Author Regions</option>
                    {uniqueAuthorRegions.map((region: string) => (
                      <option key={region} value={region}>{region}</option>
                    ))}
                  </select>
                  <select
                    className="border rounded px-3 py-2 bg-white text-black"
                    value={filterDomain}
                    onChange={e => setFilterDomain(e.target.value)}
                  >
                    <option value="">All Domains</option>
                    {Array.from(new Set(papers.map(p => (String(p['Domain'] || '') || '').trim()).filter(Boolean))).sort().map(domain => (
                      <option key={domain} value={domain}>{domain}</option>
                    ))}
                  </select>
                  <select
                    className="border rounded px-3 py-2 bg-white text-black"
                    value={filterAuthor}
                    onChange={e => setFilterAuthor(e.target.value)}
                  >
                    <option value="">All Authors</option>
                    {uniqueAuthors.map(author => (
                      <option key={author} value={author}>{author}</option>
                    ))}
                  </select>
                  <button
                    className="bg-blue-500 text-white px-4 py-2 rounded shadow hover:bg-blue-600 cursor-pointer"
                    onClick={() => exportCSV(sortedPapers, 'papers.csv')}
                  >Export CSV</button>
                  <button
                    className="bg-gray-500 text-white px-4 py-2 rounded shadow hover:bg-gray-600 cursor-pointer"
                    onClick={() => {
                      setSearchQuery('');
                      setFilterYear('');
                      setFilterRegion('');
                      setFilterDomain('');
                      setFilterAuthor('');
                    }}
                  >Clear Filters</button>
                </div>
                <div className="mb-4 text-sm text-gray-600">
                  Showing {sortedPapers.length} of {papers.length} papers
                  {(searchQuery || filterYear || filterRegion || filterDomain || filterAuthor) && (
                    <span className="ml-2 text-blue-600">
                      (filtered)
                    </span>
                  )}
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full border text-sm">
                    <thead>
                      <tr className="bg-gray-200">
                        {/* {['SN', 'Paper Title', 'Authors', 'Year', 'Region', 'Domain', 'Abstract', ''].map((col) => ( */}
                        {['SN', 'Paper Title', 'Authors', 'DOI', 'Year', 'Author Regions', 'Focus Region', 'Domain', 'Abstract', 'Details'].map((col) => (
                          <th
                            key={col}
                            className="p-2 border cursor-pointer select-none text-gray-900 font-semibold"
                            onClick={() => {
                              if (col === '') return;
                              const key = col === 'Year' ? 'Year' : col;
                              setSortConfig(sortConfig && sortConfig.key === key ? { key, direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' } : { key, direction: 'asc' });
                            }}
                          >
                            {col}
                            {sortConfig && (col === (sortConfig.key === 'Year' ? 'Year' : sortConfig.key)) && (
                              <span>{sortConfig.direction === 'asc' ? ' ▲' : ' ▼'}</span>
                            )}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pagedPapers.map((paper) => (
                        <tr key={paper['SN']} className="hover:bg-gray-50">
                          <td className="p-2 border" style={{color: 'black'}} >{paper['SN']}</td>
                          {/* <td className="p-2 border text-left">{paper['Paper Title']}</td> */}
                          <td className="p-2 border text-left" style={{color: 'black'}}>{paper['Paper Title']}</td>
                          {/* <td className="p-2 border text-left">{paper['Authors']}</td> */}
                          <td className="p-2 border text-left" style={{color: 'black'}} >{paper['Authors']}</td>
                          <td className="p-2 border text-left" style={{borderColor: '#000', borderWidth: '1px'}}>
                          {paper['DOI'] ? (
                             <a 
                               href={paper['DOI'].startsWith('http') ? paper['DOI'] : `https://${paper['DOI']}`}
                               target="_blank" 
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline"
                            >
                              {paper['DOI']}
                            </a>
                            ) : ''}
                          </td>
                          <td className="p-2 border" style={{color: 'black'}} >{(String(paper['Year'] || '') || '').trim()}</td>
                          <td className="p-2 border" style={{color: 'black'}} >{(String(paper['Focus Region'] || '') || '').trim()}</td>
                          <td className="p-2 border" style={{color: 'black'}}>{paper['Focus Region']}</td>
                          <td className="p-2 border" style={{color: 'black'}} >{paper['Domain']}</td>
                          <td className="p-2 border text-left" style={{color: 'black'}} >{(paper['Abstract'] || '').slice(0, 60)}{(paper['Abstract'] || '').length > 60 ? '…' : ''}</td>
                          <td className="p-2 border" style={{color: 'black'}}>
                            <button className="text-blue-600 underline cursor-pointer" onClick={() => setModalPaper(paper)}>View</button>
                          </td>
                        </tr>
                      ))}
                      {pagedPapers.length === 0 && (
                        <tr>
                          <td colSpan={8} className="p-4 text-center text-gray-400">No papers found.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-between items-center mt-4">
                  <button
                    className="px-3 py-1 rounded border mr-2 cursor-pointer bg-white text-gray-900 hover:bg-gray-50 disabled:bg-gray-200 disabled:text-gray-500"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  >Prev</button>
                  <span className="text-gray-900 font-medium">Page {currentPage} of {totalPages}</span>
                  <button
                    className="px-3 py-1 rounded border ml-2 cursor-pointer bg-white text-gray-900 hover:bg-gray-50 disabled:bg-gray-200 disabled:text-gray-500"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  >Next</button>
                </div>
                {modalPaper && (
                  <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-lg p-6 max-w-lg w-full relative">
                      <button
                        className="absolute top-2 right-2 text-gray-500 cursor-pointer"
                        onClick={() => setModalPaper(null)}
                      >&times;</button>
                      <h3 className="text-lg font-bold mb-2">{modalPaper['Paper Title']}</h3>
                      <div className="mb-2 text-sm text-gray-600">SN: {modalPaper['SN']}</div>
                      <div className="mb-2 text-sm text-gray-600">Authors: {modalPaper['Authors']}</div>
                      <div className="mb-2 text-sm text-gray-600">Year: {(String(modalPaper['Year'] || '') || '').trim()}</div>
                      <div className="mb-2 text-sm text-gray-600">Author Regions: {String(modalPaper['Author Regions'] || '') || ''}</div>
                      <div className="mb-2 text-sm text-gray-600">Domain: {modalPaper['Domain']}</div>
                      <div className="mb-2 text-sm text-gray-600">Abstract: {modalPaper['Abstract']}</div>
                      <p><strong>Focus Region:</strong> {modalPaper['Focus Region'] || 'Not specified'}</p>
                      <button
                        className="mt-4 bg-blue-500 text-white px-4 py-2 rounded shadow hover:bg-blue-600 cursor-pointer"
                        onClick={() => exportCSV([modalPaper], `paper_${modalPaper['SN'] || 'detail'}.csv`)}
                      >Export This Paper</button>
                    </div>
                  </div>
                )}
              </div>
            </>
          </>
        )}
      </div>
    </div>
  );
};

export default BiasResearchDashboard; 