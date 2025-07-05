import React, { useMemo, useCallback, useEffect } from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  Node,
  Edge,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
} from 'reactflow';
import 'reactflow/dist/style.css';

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

type AuthorNodeData = {
  label: string;
  region: string;
  affiliation: string;
};

type AuthorNodeProps = {
  data: AuthorNodeData;
};

interface CoAuthorNetworkGraphProps {
  papers: Paper[];
  onAuthorClick?: (author: string) => void;
}

const getColor = (region: string) => {
  // Comprehensive color mapping for all countries in the world
  const colors: Record<string, string> = {
    // Major countries (existing ones with same colors)
    USA: '#2563eb',
    UK: '#9333ea',
    India: '#16a34a',
    China: '#dc2626',
    Canada: '#0ea5e9',
    Australia: '#f59e42',
    Germany: '#eab308',
    France: '#f472b6',
    Spain: '#fbbf24',
    Global: '#64748b',
    
    // Europe
    Italy: '#ef4444',
    Netherlands: '#3b82f6',
    Switzerland: '#10b981',
    Sweden: '#f59e0b',
    Norway: '#8b5cf6',
    Denmark: '#06b6d4',
    Finland: '#84cc16',
    Belgium: '#f97316',
    Austria: '#ec4899',
    Poland: '#6366f1',
    Portugal: '#14b8a6',
    Greece: '#f43f5e',
    Ireland: '#22c55e',
    Czech: '#a855f7',
    Hungary: '#eab308',
    Romania: '#06b6d4',
    Bulgaria: '#f97316',
    Croatia: '#8b5cf6',
    Slovakia: '#10b981',
    Slovenia: '#f59e0b',
    Estonia: '#ef4444',
    Latvia: '#3b82f6',
    Lithuania: '#84cc16',
    Luxembourg: '#ec4899',
    Malta: '#6366f1',
    Cyprus: '#14b8a6',
    Iceland: '#f43f5e',
    Ukraine: '#22c55e',
    Belarus: '#a855f7',
    Moldova: '#eab308',
    Serbia: '#06b6d4',
    Montenegro: '#f97316',
    Bosnia: '#8b5cf6',
    Macedonia: '#10b981',
    Albania: '#f59e0b',
    Kosovo: '#ef4444',
    
    // Asia
    Japan: '#3b82f6',
    SouthKorea: '#10b981',
    Singapore: '#f59e0b',
    Taiwan: '#8b5cf6',
    HongKong: '#06b6d4',
    Thailand: '#f97316',
    Vietnam: '#ec4899',
    Malaysia: '#6366f1',
    Indonesia: '#14b8a6',
    Philippines: '#f43f5e',
    Pakistan: '#22c55e',
    Bangladesh: '#a855f7',
    SriLanka: '#eab308',
    Nepal: '#06b6d4',
    Bhutan: '#f97316',
    Myanmar: '#8b5cf6',
    Cambodia: '#10b981',
    Laos: '#f59e0b',
    Mongolia: '#ef4444',
    Kazakhstan: '#3b82f6',
    Uzbekistan: '#84cc16',
    Kyrgyzstan: '#ec4899',
    Tajikistan: '#6366f1',
    Turkmenistan: '#14b8a6',
    Afghanistan: '#f43f5e',
    Iran: '#22c55e',
    Iraq: '#a855f7',
    Syria: '#eab308',
    Lebanon: '#06b6d4',
    Jordan: '#f97316',
    Israel: '#8b5cf6',
    Palestine: '#10b981',
    SaudiArabia: '#f59e0b',
    UAE: '#ef4444',
    Qatar: '#3b82f6',
    Kuwait: '#84cc16',
    Bahrain: '#ec4899',
    Oman: '#6366f1',
    Yemen: '#14b8a6',
    
    // Americas
    Mexico: '#f43f5e',
    Brazil: '#22c55e',
    Argentina: '#a855f7',
    Chile: '#eab308',
    Colombia: '#06b6d4',
    Peru: '#f97316',
    Venezuela: '#8b5cf6',
    Ecuador: '#10b981',
    Bolivia: '#f59e0b',
    Paraguay: '#ef4444',
    Uruguay: '#3b82f6',
    Guyana: '#84cc16',
    Suriname: '#ec4899',
    FrenchGuiana: '#6366f1',
    Panama: '#14b8a6',
    CostaRica: '#f43f5e',
    Nicaragua: '#22c55e',
    Honduras: '#a855f7',
    ElSalvador: '#eab308',
    Guatemala: '#06b6d4',
    Belize: '#f97316',
    Cuba: '#8b5cf6',
    Jamaica: '#10b981',
    Haiti: '#f59e0b',
    DominicanRepublic: '#ef4444',
    PuertoRico: '#3b82f6',
    Bahamas: '#84cc16',
    Barbados: '#ec4899',
    Trinidad: '#6366f1',
    Grenada: '#14b8a6',
    StLucia: '#f43f5e',
    StVincent: '#22c55e',
    Antigua: '#a855f7',
    Dominica: '#eab308',
    StKitts: '#06b6d4',
    
    // Africa
    SouthAfrica: '#f97316',
    Egypt: '#8b5cf6',
    Nigeria: '#10b981',
    Kenya: '#f59e0b',
    Ethiopia: '#ef4444',
    Morocco: '#3b82f6',
    Algeria: '#84cc16',
    Tunisia: '#ec4899',
    Libya: '#6366f1',
    Sudan: '#14b8a6',
    SouthSudan: '#f43f5e',
    Chad: '#22c55e',
    Niger: '#a855f7',
    Mali: '#eab308',
    BurkinaFaso: '#06b6d4',
    Senegal: '#f97316',
    Guinea: '#8b5cf6',
    SierraLeone: '#10b981',
    Liberia: '#f59e0b',
    IvoryCoast: '#ef4444',
    Ghana: '#3b82f6',
    Togo: '#84cc16',
    Benin: '#ec4899',
    Cameroon: '#6366f1',
    CentralAfricanRepublic: '#14b8a6',
    EquatorialGuinea: '#f43f5e',
    Gabon: '#22c55e',
    Congo: '#a855f7',
    DR_Congo: '#eab308',
    Angola: '#06b6d4',
    Zambia: '#f97316',
    Zimbabwe: '#8b5cf6',
    Botswana: '#10b981',
    Namibia: '#f59e0b',
    Mozambique: '#ef4444',
    Malawi: '#3b82f6',
    Tanzania: '#84cc16',
    Uganda: '#ec4899',
    Rwanda: '#6366f1',
    Burundi: '#14b8a6',
    Somalia: '#f43f5e',
    Djibouti: '#22c55e',
    Eritrea: '#a855f7',
    Madagascar: '#eab308',
    Mauritius: '#06b6d4',
    Seychelles: '#f97316',
    Comoros: '#8b5cf6',
    CapeVerde: '#10b981',
    SaoTome: '#f59e0b',
    GuineaBissau: '#ef4444',
    Gambia: '#3b82f6',
    Mauritania: '#84cc16',
    WesternSahara: '#ec4899',
    
    // Oceania
    NewZealand: '#6366f1',
    Fiji: '#14b8a6',
    PapuaNewGuinea: '#f43f5e',
    SolomonIslands: '#22c55e',
    Vanuatu: '#a855f7',
    NewCaledonia: '#eab308',
    Samoa: '#06b6d4',
    Tonga: '#f97316',
    Kiribati: '#8b5cf6',
    Micronesia: '#10b981',
    MarshallIslands: '#f59e0b',
    Palau: '#ef4444',
    Nauru: '#3b82f6',
    Tuvalu: '#84cc16',
    
    // Middle East
    Turkey: '#ec4899',
    Georgia: '#6366f1',
    Armenia: '#14b8a6',
    Azerbaijan: '#f43f5e',
    
    // Central Asia
    Russia: '#22c55e',
    
    // Special regions
    Unknown: '#8884d8',
    Other: '#64748b',
    Multiple: '#94a3b8',
    International: '#cbd5e1',
  };
  
  // Handle common variations and abbreviations
  const normalizedRegion = region.trim();
  const regionVariations: Record<string, string> = {
    'United States': 'USA',
    'United States of America': 'USA',
    'US': 'USA',
    'United Kingdom': 'UK',
    'Great Britain': 'UK',
    'England': 'UK',
    'Scotland': 'UK',
    'Wales': 'UK',
    'Northern Ireland': 'UK',
    'Czech Republic': 'Czech',
    'Czechia': 'Czech',
    'South Korea': 'SouthKorea',
    'Korea': 'SouthKorea',
    'Democratic Republic of the Congo': 'DR_Congo',
    'DR Congo': 'DR_Congo',
    'Congo DR': 'DR_Congo',
    'Ivory Coast': 'IvoryCoast',
    'Côte d\'Ivoire': 'IvoryCoast',
    'United Arab Emirates': 'UAE',
    'Dominican Rep': 'DominicanRepublic',
    'St. Lucia': 'StLucia',
    'St. Vincent': 'StVincent',
    'St. Kitts': 'StKitts',
    'Central African Rep': 'CentralAfricanRepublic',
    'Equatorial Guinea': 'EquatorialGuinea',
    'Cape Verde': 'CapeVerde',
    'São Tomé': 'SaoTome',
    'Guinea-Bissau': 'GuineaBissau',
    'Western Sahara': 'WesternSahara',
    'Papua New Guinea': 'PapuaNewGuinea',
    'Solomon Islands': 'SolomonIslands',
    'New Caledonia': 'NewCaledonia',
    'Marshall Islands': 'MarshallIslands',
    'Micronesia (Federated States of)': 'Micronesia',
    'Federated States of Micronesia': 'Micronesia',
  };
  
  const mappedRegion = regionVariations[normalizedRegion] || normalizedRegion;
  return colors[mappedRegion] || '#8884d8'; // Default color for unmapped regions
};

// Custom node with visible author name and affiliation
const AuthorNode = ({ data }: AuthorNodeProps) => (
  <div style={{
    background: getColor(data.region),
    color: '#fff',
    border: '2px solid #fff',
    borderRadius: 8,
    padding: 8,
    fontWeight: 600,
    minWidth: 120,
    textAlign: 'center',
    cursor: 'pointer',
    lineHeight: 1.3,
  }}>
    <div style={{ fontSize: 16, fontWeight: 700 }}>{data.label}</div>
    <div style={{ fontSize: 13, fontWeight: 400, opacity: 0.92 }}>{data.affiliation}</div>
    <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
    <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
  </div>
);

// Move nodeTypes outside the component
const nodeTypes = { author: AuthorNode };

const CoAuthorNetworkGraph: React.FC<CoAuthorNetworkGraphProps> = ({ papers, onAuthorClick }) => {
  // Build nodes and edges from papers
  const { nodes, edges } = useMemo(() => {
    const authorMap = new Map<string, { region: string; affiliation: string }>();
    const edgeMap = new Map<string, { source: string; target: string; count: number }>();

    papers.forEach(paper => {
      const authors = (paper['Authors'] || '').split(';').map((a: string) => a.trim()).filter(Boolean);
      const regions = (paper['Author Regions'] || '').split(';').map((r: string) => r.trim()).filter(Boolean);
      const affiliations = (paper['Affiliations'] || '').split(';').map((a: string) => a.trim()).filter(Boolean);
      authors.forEach((author: string, idx: number) => {
        if (!authorMap.has(author)) {
          authorMap.set(author, {
            region: regions[idx] || 'Unknown',
            affiliation: affiliations[idx] || 'Unknown',
          });
        }
      });
      // Create edges for each pair of co-authors
      for (let i = 0; i < authors.length; i++) {
        for (let j = i + 1; j < authors.length; j++) {
          const key = [authors[i], authors[j]].sort().join('||');
          if (!edgeMap.has(key)) {
            edgeMap.set(key, { source: authors[i], target: authors[j], count: 0 });
          }
          edgeMap.get(key)!.count++;
        }
      }
    });
    // Layout nodes in a circle for simplicity
    const authorList = Array.from(authorMap.keys());
    const angleStep = (2 * Math.PI) / authorList.length;
    const nodes: Node[] = authorList.map((author, idx) => {
      const { region, affiliation } = authorMap.get(author)!;
      return {
        id: author,
        data: {
          label: author,
          region,
          affiliation,
        },
        position: {
          x: 300 + 250 * Math.cos(idx * angleStep),
          y: 300 + 250 * Math.sin(idx * angleStep),
        },
        style: {
          background: getColor(region),
          color: '#fff',
          border: '2px solid #fff',
          borderRadius: 8,
          padding: 8,
          fontWeight: 600,
        },
        type: 'author',
      };
    });
    const edges: Edge[] = Array.from(edgeMap.values()).map(({ source, target, count }) => ({
      id: `${source}-${target}`,
      source,
      target,
      label: count > 1 ? `${count} papers` : undefined,
      animated: count > 2,
      style: { strokeWidth: Math.min(1 + count, 6) },
      labelStyle: { fill: '#333', fontWeight: 600 },
      type: 'default',
    }));
    return { nodes, edges };
  }, [papers]);

  const [rfNodes, setRfNodes, onNodesChange] = useNodesState(nodes);
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState(edges);

  // Update nodes and edges when data changes
  useEffect(() => {
    setRfNodes(nodes);
  }, [nodes, setRfNodes]);
  useEffect(() => {
    setRfEdges(edges);
  }, [edges, setRfEdges]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    if (onAuthorClick) onAuthorClick(node.id as string);
  }, [onAuthorClick]);

  return (
    <div style={{ width: '100%', height: 600, background: '#f8fafc', borderRadius: 12 }}>
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        fitView
        minZoom={0.2}
        maxZoom={2}
        nodeTypes={nodeTypes}
      >
        <MiniMap nodeColor={(n: Node) => getColor((n.data as AuthorNodeData)?.region || 'Global')} />
        <Controls />
        <Background gap={18} size={1} color="#e5e7eb" />
      </ReactFlow>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, margin: '24px auto 0', alignItems: 'center', justifyContent: 'center', maxWidth: 700 }}>
        {Array.from(new Set(nodes.map(n => (n.data as AuthorNodeData).region))).map(region => (
          <div key={region} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ background: getColor(region), width: 18, height: 18, display: 'inline-block', borderRadius: 4, border: '1px solid #ccc' }}></span>
            <span style={{ fontSize: 14, color: '#333' }}>{region}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CoAuthorNetworkGraph; 