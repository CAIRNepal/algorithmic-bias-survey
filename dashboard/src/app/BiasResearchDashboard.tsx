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
  Authors?: string;
  'Pub Year & Author Region'?: string;
  Domain?: string;
  Abstract?: string;
  [key: string]: unknown;
};

const BiasResearchDashboard = () => {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(true);
  const [tooltip, setTooltip] = useState<{ content: string; x: number; y: number } | null>(null);
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [filterRegion, setFilterRegion] = useState('');
  const [filterDomain, setFilterDomain] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [modalPaper, setModalPaper] = useState<Paper | null>(null);
  const pageSize = 10;

  useEffect(() => {
    fetch('papers.csv')
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

  // After parsing:
  const allRows = papers; // All parsed rows
  const validPapers = allRows.filter(paper => {
    const year = (paper['Pub Year & Author Region'] || '').split(' ')[0].trim();
    const region = (paper['Pub Year & Author Region'] || '').split(' ').slice(1).join(' ').trim();
    return year && region;
  });
  const skippedPapers = allRows.filter(paper => !validPapers.includes(paper));

  // For display:
  const totalPapers = allRows.length;
  const skippedCount = skippedPapers.length;

  // Publication Timeline (yearData)
  const yearMap: Record<string, number> = {};
  validPapers.forEach(paper => {
    const year = (paper['Pub Year & Author Region'] || '').split(' ')[0].trim();
    if (year) yearMap[year] = (yearMap[year] || 0) + 1;
  });
  const yearData = Object.entries(yearMap)
    .map(([year, count]) => ({ year: Number(year), count }))
    .sort((a, b) => a.year - b.year);

  // Author Regions (regionData)
  const regionMap: Record<string, number> = {};
  validPapers.forEach(paper => {
    const region = (paper['Pub Year & Author Region'] || '').split(' ').slice(1).join(' ').trim();
    if (region) regionMap[region] = (regionMap[region] || 0) + 1;
  });
  const regionData = Object.entries(regionMap).map(([region, count]) => ({ region, count }));

  // Research Domains (domainData)
  const domainMap: Record<string, number> = {};
  validPapers.forEach(paper => {
    const domain = (paper['Domain'] || '').trim().toLowerCase();
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
    .map(paper => (paper['Pub Year & Author Region'] || '').split(' ')[0].trim())
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
    const region = (paper['Pub Year & Author Region'] || '').split(' ').slice(1).join(' ').trim();
    const domain = (paper['Domain'] || '').trim();
    const title = paper['Paper Title'] || 'Unknown';
    
    if (region && domain) {
      if (!countryDomainMap[region]) {
        countryDomainMap[region] = { domain: '', count: 0, papers: [] };
      }
      countryDomainMap[region].count++;
      countryDomainMap[region].papers.push(title);
      
      // Determine dominant domain for this country
      const countryPapers = validPapers.filter(p => 
        (p['Pub Year & Author Region'] || '').split(' ').slice(1).join(' ').trim() === region
      );
      const domainCounts: Record<string, number> = {};
      countryPapers.forEach(p => {
        const d = (p['Domain'] || '').trim().toLowerCase();
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

  const filteredPapers = papers.filter(paper => {
    const title = (paper['Paper Title'] || '').toLowerCase();
    const author = (paper['Authors'] || '').toLowerCase();
    const domain = (paper['Domain'] || '').toLowerCase();
    const region = (paper['Pub Year & Author Region'] || '').split(' ').slice(1).join(' ').toLowerCase();
    const year = (paper['Pub Year & Author Region'] || '').split(' ')[0];
    const q = searchQuery.toLowerCase();
    return (
      (!searchQuery || title.includes(q) || author.includes(q) || domain.includes(q) || region.includes(q)) &&
      (!filterYear || year === filterYear) &&
      (!filterRegion || region === filterRegion.toLowerCase()) &&
      (!filterDomain || domain === filterDomain.toLowerCase())
    );
  });

  // Sorting logic
  const sortedPapers = [...filteredPapers].sort((a, b) => {
    if (!sortConfig) return 0;
    const aVal = String(a[sortConfig.key] || '').toLowerCase();
    const bVal = String(b[sortConfig.key] || '').toLowerCase();
    if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  // Pagination logic
  const totalPages = Math.ceil(sortedPapers.length / pageSize);
  const pagedPapers = sortedPapers.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // CSV Export logic
  function exportCSV(papersToExport: Paper[], filename: string) {
    const headers = ['SN', 'Paper Title', 'Authors', 'Pub Year & Author Region', 'Domain', 'Abstract'];
    const rows = papersToExport.map(p => headers.map(h => String(p[h] || '').replace(/\n/g, ' ')));
    const csv = [headers.join(','), ...rows.map(r => r.map(f => `"${f.replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, filename);
  }

  return (
    <div className="w-full p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-8 text-gray-800">
          Bias Research Analysis Dashboard
        </h1>
        {loading ? (
          <div className="text-center text-gray-500">Loading data...</div>
        ) : (
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
                          const region = (p['Pub Year & Author Region'] || '').split(' ').slice(1).join(' ').trim();
                          return region === (altName || countryName);
                        });
                        isPresent = countryPapers.some(p => (p['Domain'] || '').trim().toLowerCase() === selectedDomain.toLowerCase());
                        const domainEntry = domainData.find(d => d.domain.toLowerCase() === selectedDomain.toLowerCase());
                        if (isDominant) fillColor = domainEntry ? domainEntry.color : '#f3f4f6';
                        else if (isPresent) fillColor = domainEntry ? `${domainEntry.color}80` : '#e5e7eb'; // lighter color (add alpha)
                      } else if (countryData) {
                        const domainIndex = domainData.findIndex(d => d.domain.toLowerCase() === (countryData?.domain || '').toLowerCase());
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
                          onMouseEnter={(evt) => {
                            if (countryData) {
                              // All domains for this country
                              const countryPapers = validPapers.filter(p => {
                                const region = (p['Pub Year & Author Region'] || '').split(' ').slice(1).join(' ').trim();
                                return region === (altName || countryName);
                              });
                              const domainCounts: Record<string, number> = {};
                              const years: number[] = [];
                              countryPapers.forEach(p => {
                                const d = (p['Domain'] || '').trim();
                                if (d) domainCounts[d] = (domainCounts[d] || 0) + 1;
                                const y = Number((p['Pub Year & Author Region'] || '').split(' ')[0]);
                                if (!isNaN(y)) years.push(y);
                              });
                              const domainList = Object.entries(domainCounts)
                                .sort((a, b) => b[1] - a[1])
                                .map(([d, c]) => `- ${d} (${c})`).join('\n');
                              const uniqueYears = Array.from(new Set(years)).sort((a, b) => a - b);
                              const paperTitles = countryPapers.map(p => p['Paper Title'] || 'Unknown');
                              const shownTitles = paperTitles.slice(0, 10);
                              const moreCount = paperTitles.length - shownTitles.length;
                              let content = `${countryName}\nDomains:\n${domainList}\nYears: ${uniqueYears.join(', ')}\nPapers (${paperTitles.length}):\n${shownTitles.join('\n')}${moreCount > 0 ? `\n...and ${moreCount} more` : ''}`;
                              if (selectedDomain) {
                                if (isDominant) content += `\n(Dominant domain)`;
                                else if (isPresent) content += `\n(Present)`;
                                else content += `\n(Not present)`;
                              }
                              setTooltip({ content, x: evt.clientX, y: evt.clientY });
                            } else {
                              setTooltip({ content: countryName, x: evt.clientX, y: evt.clientY });
                            }
                          }}
                          onMouseLeave={() => {
                            setTooltip(null);
                          }}
                        />
                      );
                    })
                  }
                </Geographies>
              </ZoomableGroup>
            </ComposableMap>
          </div>
          {tooltip && (
            <div
              style={{
                position: 'fixed',
                left: tooltip.x + 10,
                top: tooltip.y - 10,
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                color: 'white',
                padding: '8px 12px',
                borderRadius: '4px',
                fontSize: '12px',
                zIndex: 1000,
                pointerEvents: 'none',
                whiteSpace: 'pre-line',
                maxWidth: '300px'
              }}
            >
              {tooltip.content}
            </div>
          )}
          <div className="mt-4 text-sm text-gray-500">
            <p>• Countries with data are colored by their dominant research domain</p>
            <p>• Gray countries have no research data in this dataset</p>
            <p>• Hover over colored countries to see domain and paper details</p>
          </div>
        </div>

        {/* Key Insights */}
        <div className="bg-white p-6 rounded-lg shadow-lg mt-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-700">Key Insights</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold text-lg mb-2">Research Trends</h3>
              <ul className="space-y-2 text-gray-600">
                <li>• Peak research activity in {peakYear.year} ({peakYear.count} papers)</li>
                <li>• Significant growth from {growthPeriod}</li>
                {llmInsight && <li>• {llmInsight}</li>}
                {fairnessInsight && <li>• {fairnessInsight}</li>}
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-2">Geographic Distribution</h3>
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
              className="border rounded px-3 py-2 w-full md:w-64"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            <select
              className="border rounded px-3 py-2"
              value={filterYear}
              onChange={e => setFilterYear(e.target.value)}
            >
              <option value="">All Years</option>
              {Array.from(new Set(papers.map(p => (p['Pub Year & Author Region'] || '').split(' ')[0].trim()).filter(Boolean))).sort().map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
            <select
              className="border rounded px-3 py-2"
              value={filterRegion}
              onChange={e => setFilterRegion(e.target.value)}
            >
              <option value="">All Regions</option>
              {Array.from(new Set(papers.map(p => (p['Pub Year & Author Region'] || '').split(' ').slice(1).join(' ').trim()).filter(Boolean))).sort().map(region => (
                <option key={region} value={region}>{region}</option>
              ))}
            </select>
            <select
              className="border rounded px-3 py-2"
              value={filterDomain}
              onChange={e => setFilterDomain(e.target.value)}
            >
              <option value="">All Domains</option>
              {Array.from(new Set(papers.map(p => (p['Domain'] || '').trim()).filter(Boolean))).sort().map(domain => (
                <option key={domain} value={domain}>{domain}</option>
              ))}
            </select>
            <button
              className="bg-blue-500 text-white px-4 py-2 rounded shadow hover:bg-blue-600 cursor-pointer"
              onClick={() => exportCSV(sortedPapers, 'papers.csv')}
            >Export CSV</button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full border text-sm">
              <thead>
                <tr className="bg-gray-100">
                  {['SN', 'Paper Title', 'Authors', 'Year', 'Region', 'Domain', 'Abstract', ''].map((col) => (
                    <th
                      key={col}
                      className="p-2 border cursor-pointer select-none"
                      onClick={() => {
                        if (col === '') return;
                        const key = col === 'Year' ? 'Pub Year & Author Region' : col;
                        setSortConfig(sortConfig && sortConfig.key === key ? { key, direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' } : { key, direction: 'asc' });
                      }}
                    >
                      {col}
                      {sortConfig && (col === (sortConfig.key === 'Pub Year & Author Region' ? 'Year' : sortConfig.key)) && (
                        <span>{sortConfig.direction === 'asc' ? ' ▲' : ' ▼'}</span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pagedPapers.map((paper) => (
                  <tr key={paper['SN']} className="hover:bg-gray-50">
                    <td className="p-2 border">{paper['SN']}</td>
                    <td className="p-2 border text-left">{paper['Paper Title']}</td>
                    <td className="p-2 border text-left">{paper['Authors']}</td>
                    <td className="p-2 border">{(paper['Pub Year & Author Region'] || '').split(' ')[0]}</td>
                    <td className="p-2 border">{(paper['Pub Year & Author Region'] || '').split(' ').slice(1).join(' ')}</td>
                    <td className="p-2 border">{paper['Domain']}</td>
                    <td className="p-2 border text-left">{(paper['Abstract'] || '').slice(0, 60)}{(paper['Abstract'] || '').length > 60 ? '…' : ''}</td>
                    <td className="p-2 border">
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
              className="px-3 py-1 rounded border mr-2 cursor-pointer"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            >Prev</button>
            <span>Page {currentPage} of {totalPages}</span>
            <button
              className="px-3 py-1 rounded border ml-2 cursor-pointer"
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
                <div className="mb-2 text-sm text-gray-600">Year: {(modalPaper['Pub Year & Author Region'] || '').split(' ')[0]}</div>
                <div className="mb-2 text-sm text-gray-600">Region: {(modalPaper['Pub Year & Author Region'] || '').split(' ').slice(1).join(' ')}</div>
                <div className="mb-2 text-sm text-gray-600">Domain: {modalPaper['Domain']}</div>
                <div className="mb-2 text-sm text-gray-600">Abstract: {modalPaper['Abstract']}</div>
                <button
                  className="mt-4 bg-blue-500 text-white px-4 py-2 rounded shadow hover:bg-blue-600 cursor-pointer"
                  onClick={() => exportCSV([modalPaper], `paper_${modalPaper['SN'] || 'detail'}.csv`)}
                >Export This Paper</button>
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