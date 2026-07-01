import React, { useMemo, useCallback, useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
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
  ReactFlowProvider,
  useReactFlow,
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
  'ORC ID'?: string;
  [key: string]: unknown;
};

type AuthorNodeData = {
  label: string;
  region: string;
  affiliation: string;
  paperCount: number;
  nameVariants: string[];
};

type AuthorNodeProps = { data: AuthorNodeData };

interface CoAuthorNetworkGraphProps {
  papers: Paper[];
  onAuthorClick?: (author: string, nameVariants: string[]) => void;
  maxNodes?: number;
}

const REGION_COLORS: Record<string, string> = {
  USA: '#2563eb', 'United States': '#2563eb', US: '#2563eb',
  UK: '#9333ea', 'United Kingdom': '#9333ea', England: '#9333ea',
  India: '#16a34a', China: '#dc2626', Canada: '#0ea5e9', Australia: '#f59e42',
  Germany: '#ca8a04', France: '#f472b6', Spain: '#fbbf24', Italy: '#ef4444',
  Netherlands: '#3b82f6', Switzerland: '#10b981', Sweden: '#8b5cf6',
  Norway: '#7c3aed', Denmark: '#06b6d4', Belgium: '#f97316', Austria: '#ec4899',
  Portugal: '#14b8a6', Greece: '#f43f5e', Poland: '#6366f1', Japan: '#0284c7',
  'South Korea': '#059669', Singapore: '#d97706', Taiwan: '#7c3aed',
  'Hong Kong': '#0891b2', Israel: '#4f46e5', Turkey: '#db2777', Iran: '#16a34a',
  'Saudi Arabia': '#b45309', UAE: '#dc2626', 'United Arab Emirates': '#dc2626',
  Brazil: '#15803d', Mexico: '#be123c', Argentina: '#7e22ce', Chile: '#a16207',
  Colombia: '#0e7490', 'South Africa': '#c2410c', Egypt: '#7c3aed',
  Nigeria: '#047857', Global: '#64748b', Unknown: '#94a3b8',
};

const getColor = (region: string) => REGION_COLORS[(region || '').trim()] || '#8884d8';

// ── Author deduplication helpers ──────────────────────────────────────────────

const ORCID_RE = /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/;

function parseOrcid(raw: string): string {
  const s = raw.trim().replace(/^https?:\/\/orcid\.org\//, '');
  return ORCID_RE.test(s) ? s : '';
}

/** Normalized fallback key for authors without a valid ORCID: "lastname_firstinitial" */
function normalizeAuthorName(name: string): string {
  const clean = name.toLowerCase().replace(/[.,]/g, '').trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return clean;
  const lastName = parts[parts.length - 1];
  const firstInitial = parts[0][0] || '';
  return `${lastName}_${firstInitial}`;
}

/** Canonical key: ORCID-based if valid, otherwise normalized name */
function canonicalKey(name: string, orcid: string): string {
  const id = parseOrcid(orcid);
  return id ? `orcid:${id}` : `name:${normalizeAuthorName(name)}`;
}

// ── Node components ───────────────────────────────────────────────────────────

// Full-label node for small/medium graphs
const AuthorNode = ({ data }: AuthorNodeProps) => {
  const size = (data as AuthorNodeData & { size?: string }).size || 'md';
  return (
    <div
      style={{
        background: getColor(data.region),
        color: '#fff',
        border: '2px solid rgba(255,255,255,0.5)',
        borderRadius: 8,
        padding: size === 'lg' ? '8px 14px' : '5px 10px',
        minWidth: size === 'lg' ? 140 : 110,
        maxWidth: size === 'lg' ? 200 : 160,
        textAlign: 'center',
        cursor: 'pointer',
        lineHeight: 1.2,
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        fontWeight: 600,
      }}
    >
      <div style={{ fontSize: size === 'lg' ? 13 : 11, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {data.label}
      </div>
      {data.affiliation && data.affiliation !== 'Unknown' && (
        <div style={{ fontSize: 9, opacity: 0.85, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {data.affiliation}
        </div>
      )}
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
    </div>
  );
};

// Dot node for large graphs — 14px circle, hover tooltip shows name
const DotNode = ({ data }: AuthorNodeProps) => (
  <div
    title={`${data.label}\n${data.region}${data.affiliation && data.affiliation !== 'Unknown' ? '\n' + data.affiliation : ''}`}
    style={{
      width: 14,
      height: 14,
      borderRadius: '50%',
      background: getColor(data.region),
      border: '2px solid rgba(255,255,255,0.75)',
      cursor: 'pointer',
      boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
      transition: 'transform 0.1s',
    }}
    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(2)'; }}
    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
  >
    <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
    <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
  </div>
);

// Region label badge
const RegionLabelNode = ({ data }: { data: { label: string; color: string; count: number } }) => (
  <div
    style={{
      background: data.color,
      color: '#fff',
      borderRadius: 16,
      padding: '3px 12px',
      fontWeight: 700,
      fontSize: 11,
      whiteSpace: 'nowrap',
      boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
      pointerEvents: 'none',
      userSelect: 'none',
    }}
  >
    {data.label} <span style={{ opacity: 0.7, fontWeight: 400 }}>({data.count})</span>
  </div>
);

const nodeTypes = { author: AuthorNode, dotNode: DotNode, regionLabel: RegionLabelNode };

const DEFAULT_MAX_NODES = 50;

// ── Layout builders ───────────────────────────────────────────────────────────

type AuthorMeta = { region: string; affiliation: string; paperCount: number; displayName: string; nameVariants: Set<string> };

/** Circular cluster layout — good for ≤ 200 nodes */
function circularClusterLayout(topAuthors: string[], authorMeta: Map<string, AuthorMeta>): Node[] {
  const total = topAuthors.length;
  const size = total > 80 ? 'md' : 'lg';
  const nodeW = size === 'lg' ? 160 : 120;

  const groups = new Map<string, string[]>();
  topAuthors.forEach((a) => {
    const r = authorMeta.get(a)?.region || 'Unknown';
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r)!.push(a);
  });
  const sorted = Array.from(groups.entries()).sort((a, b) => b[1].length - a[1].length);
  const numR = sorted.length;

  const maxCluster = Math.max(...sorted.map(([, a]) => a.length));
  // Cap inner radius so large clusters (e.g. USA) don't balloon the canvas
  const maxInner = Math.min(Math.max((maxCluster * nodeW) / (2 * Math.PI), 60), 160);
  const outerR = Math.min(Math.max((numR * (maxInner * 1.6 + 60)) / (2 * Math.PI), 220), 650);
  const CX = outerR + 120;
  const CY = outerR + 120;

  const nodes: Node[] = [];
  sorted.forEach(([region, authors], rIdx) => {
    const ang = (2 * Math.PI * rIdx) / numR - Math.PI / 2;
    const cx = CX + outerR * Math.cos(ang);
    const cy = CY + outerR * Math.sin(ang);
    const n = authors.length;
    const innerR = n <= 1 ? 0 : Math.min(Math.max((n * nodeW) / (2 * Math.PI), 50), 160);

    nodes.push({
      id: `__label__${region}`,
      type: 'regionLabel',
      data: { label: region, color: getColor(region), count: n },
      position: { x: cx - 55, y: cy - 13 },
      selectable: false,
      draggable: false,
    });

    authors.forEach((author, idx) => {
      const a = (2 * Math.PI * idx) / Math.max(n, 1) - Math.PI / 2;
      const meta = authorMeta.get(author)!;
      nodes.push({
        id: author,
        type: 'author',
        data: { label: meta.displayName, region: meta.region, affiliation: meta.affiliation, paperCount: meta.paperCount, nameVariants: Array.from(meta.nameVariants), size },
        position: { x: cx + (innerR + 30) * Math.cos(a), y: cy + (innerR + 30) * Math.sin(a) },
      });
    });
  });
  return nodes;
}

/** Grid cluster layout — compact dot grid per region, good for > 200 nodes */
function gridClusterLayout(topAuthors: string[], authorMeta: Map<string, AuthorMeta>): Node[] {
  const groups = new Map<string, string[]>();
  topAuthors.forEach((a) => {
    const r = authorMeta.get(a)?.region || 'Unknown';
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r)!.push(a);
  });
  const sorted = Array.from(groups.entries()).sort((a, b) => b[1].length - a[1].length);

  // Dot grid config — tighter = more compact canvas = higher fit-view zoom
  const PITCH = 16;    // px per grid cell (dot + gap)
  const LABEL_H = 28; // px for region label
  const CLUSTER_PAD = 32; // px gap between clusters
  const MAX_ROW_W = 2000; // wrap to new row after this width

  const nodes: Node[] = [];
  let curX = 0, curY = 0, rowMaxH = 0;

  sorted.forEach(([region, authors]) => {
    const n = authors.length;
    const cols = Math.max(1, Math.ceil(Math.sqrt(n * 1.5)));
    const rows = Math.ceil(n / cols);
    const clusterW = cols * PITCH;
    const clusterH = LABEL_H + rows * PITCH;

    if (curX > 0 && curX + clusterW > MAX_ROW_W) {
      curX = 0;
      curY += rowMaxH + CLUSTER_PAD;
      rowMaxH = 0;
    }

    nodes.push({
      id: `__label__${region}`,
      type: 'regionLabel',
      data: { label: region, color: getColor(region), count: n },
      position: { x: curX, y: curY },
      selectable: false,
      draggable: false,
    });

    authors.forEach((author, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const meta = authorMeta.get(author)!;
      nodes.push({
        id: author,
        type: 'dotNode',
        data: { label: meta.displayName, region: meta.region, affiliation: meta.affiliation, paperCount: meta.paperCount, nameVariants: Array.from(meta.nameVariants) },
        position: { x: curX + col * PITCH, y: curY + LABEL_H + row * PITCH },
      });
    });

    curX += clusterW + CLUSTER_PAD;
    rowMaxH = Math.max(rowMaxH, clusterH);
  });

  return nodes;
}

// ── Inner ReactFlow component ─────────────────────────────────────────────────
interface NetworkFlowProps {
  nodes: Node[];
  edges: Edge[];
  isLarge: boolean;
  onAuthorClick?: (author: string, nameVariants: string[]) => void;
}

const NetworkFlow: React.FC<NetworkFlowProps> = ({ nodes, edges, isLarge, onAuthorClick }) => {
  const { fitView } = useReactFlow();
  // useNodesState initialises from props on first mount (key-based remount handles updates)
  const [rfNodes, , onNodesChange] = useNodesState(nodes);
  const [rfEdges, , onEdgesChange] = useEdgesState(edges);

  // Fire fitView once after mount — delay scales with node count so React has time to paint
  useEffect(() => {
    const delay = nodes.length > 500 ? 1200 : nodes.length > 200 ? 700 : 200;
    const t = setTimeout(() => fitView({ padding: 0.08, duration: 600 }), delay);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    if (node.id.startsWith('__label__')) return;
    if (onAuthorClick) {
      const d = node.data as AuthorNodeData;
      onAuthorClick(d.label, d.nameVariants?.length ? d.nameVariants : [d.label]);
    }
  }, [onAuthorClick]);

  return (
    <ReactFlow
      nodes={rfNodes}
      edges={rfEdges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={onNodeClick}
      fitView
      fitViewOptions={{ padding: 0.08 }}
      minZoom={0.001}
      maxZoom={4}
      nodeTypes={nodeTypes}
      defaultEdgeOptions={{ type: 'default' }}
    >
      <MiniMap
        nodeColor={(n: Node) => {
          if (n.id.startsWith('__label__')) return (n.data as { color: string }).color;
          return getColor((n.data as AuthorNodeData)?.region || 'Unknown');
        }}
        nodeStrokeWidth={0}
        style={{ background: '#f1f5f9' }}
      />
      <Controls />
      <Background gap={isLarge ? 30 : 20} size={1} color="#e9eef4" />
      <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 10, display: 'flex', gap: 6 }}>
        {isLarge && (
          <span style={{ background: 'rgba(255,255,255,0.9)', border: '1px solid #e2e8f0', borderRadius: 6, padding: '4px 10px', fontSize: 11, color: '#64748b' }}>
            Hover dot to see name · click to open detail
          </span>
        )}
        <button
          onClick={() => fitView({ padding: 0.08, duration: 400 })}
          style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, padding: '4px 10px', fontSize: 12, color: '#475569', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}
        >
          ⊡ Fit all
        </button>
      </div>
    </ReactFlow>
  );
};

// ── Outer component ───────────────────────────────────────────────────────────
const CoAuthorNetworkGraph: React.FC<CoAuthorNetworkGraphProps> = ({
  papers,
  onAuthorClick,
  maxNodes = DEFAULT_MAX_NODES,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleDownload = useCallback(async () => {
    if (!containerRef.current) return;
    const canvas = await html2canvas(containerRef.current, {
      scale: 3,
      useCORS: true,
      backgroundColor: '#f8fafc',
    });
    const link = document.createElement('a');
    link.download = 'coauthor_network.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  }, []);

  const { nodes, edges, totalAuthors, isLarge } = useMemo(() => {
    const authorMeta = new Map<string, AuthorMeta>();
    const edgeMap = new Map<string, { source: string; target: string; count: number }>();
    const authorDegree = new Map<string, number>();

    papers.forEach((paper) => {
      const authors = (paper['Authors'] || '').split(';').map((a: string) => a.trim()).filter(Boolean);
      const regions = (paper['Author Regions'] || '').split(';').map((r: string) => r.trim());
      const affiliations = (paper['Affiliations'] || '').split(';').map((a: string) => a.trim());
      const orcids = (paper['ORC ID'] || '').split(';').map((o: string) => o.trim());

      // Resolve canonical keys for all authors in this paper first (needed for edge building)
      const keys = authors.map((author: string, idx: number) =>
        canonicalKey(author, orcids[idx] || '')
      );

      authors.forEach((author: string, idx: number) => {
        const key = keys[idx];
        if (!authorMeta.has(key)) {
          authorMeta.set(key, {
            region: regions[idx] || 'Unknown',
            affiliation: affiliations[idx] || '',
            paperCount: 0,
            displayName: author,
            nameVariants: new Set([author]),
          });
        } else {
          // Merge: accumulate name variants; keep most-used display name (first seen)
          authorMeta.get(key)!.nameVariants.add(author);
          // Fill in region/affiliation if previously unknown
          const m = authorMeta.get(key)!;
          if (m.region === 'Unknown' && regions[idx]) m.region = regions[idx];
          if (!m.affiliation && affiliations[idx]) m.affiliation = affiliations[idx];
        }
        authorMeta.get(key)!.paperCount++;
        authorDegree.set(key, (authorDegree.get(key) || 0) + authors.length - 1);
      });

      for (let i = 0; i < keys.length; i++) {
        for (let j = i + 1; j < keys.length; j++) {
          const edgeKey = [keys[i], keys[j]].sort().join('|||');
          if (!edgeMap.has(edgeKey)) edgeMap.set(edgeKey, { source: keys[i], target: keys[j], count: 0 });
          edgeMap.get(edgeKey)!.count++;
        }
      }
    });

    const totalAuthors = authorMeta.size;
    const topAuthors = Array.from(authorDegree.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxNodes)
      .map(([name]) => name);

    const isLarge = topAuthors.length > 200;
    const nodes = isLarge
      ? gridClusterLayout(topAuthors, authorMeta)
      : circularClusterLayout(topAuthors, authorMeta);

    const topSet = new Set(topAuthors);
    const edgeOpacity = isLarge ? 0.15 : topAuthors.length > 80 ? 0.35 : 0.55;

    const edges: Edge[] = Array.from(edgeMap.values())
      .filter(({ source, target }) => topSet.has(source) && topSet.has(target))
      .map(({ source, target, count }) => {
        const srcRegion = authorMeta.get(source)?.region || 'Unknown';
        const tgtRegion = authorMeta.get(target)?.region || 'Unknown';
        const cross = srcRegion !== tgtRegion;
        return {
          id: `${source}|||${target}`,
          source,
          target,
          animated: !isLarge && count > 2,
          style: {
            strokeWidth: isLarge ? 0.5 : Math.min(1 + count * 0.4, 4),
            stroke: cross ? '#f59e0b' : getColor(srcRegion),
            opacity: edgeOpacity,
          },
          label: !isLarge && count > 1 ? `${count}` : undefined,
          labelStyle: { fill: '#374151', fontSize: 10, fontWeight: 700 },
          labelBgStyle: { fill: 'rgba(255,255,255,0.85)' },
          type: 'default',
        };
      });

    return { nodes, edges, totalAuthors, isLarge };
  }, [papers, maxNodes]);

  const shownAuthors = nodes.filter((n) => !n.id.startsWith('__label__')).length;

  return (
    <div>
      <div className="flex items-center gap-4 mb-2 flex-wrap">
        <p className="text-xs text-gray-500">
          {shownAuthors < totalAuthors ? (
            <>Showing top <strong className="text-gray-700">{shownAuthors}</strong> of <strong className="text-gray-700">{totalAuthors}</strong> authors · grouped by region</>
          ) : (
            <>Showing all <strong className="text-gray-700">{shownAuthors}</strong> authors · grouped by region</>
          )}
          {isLarge && <span className="ml-2 text-amber-600 font-medium">· dot mode active (zoom in to explore)</span>}
        </p>
        {!isLarge && (
          <div className="flex items-center gap-3 text-xs text-gray-400">
            <span className="flex items-center gap-1"><span style={{ display:'inline-block', width:10, height:3, background:'#f59e0b', borderRadius:2 }}/>cross-region</span>
            <span className="flex items-center gap-1"><span style={{ display:'inline-block', width:10, height:3, background:'#2563eb', borderRadius:2 }}/>same region</span>
          </div>
        )}
        <button
          onClick={handleDownload}
          style={{ marginLeft: 'auto', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, padding: '4px 12px', fontSize: 12, color: '#475569', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', gap: 5 }}
        >
          ↓ Download PNG
        </button>
      </div>
      <div ref={containerRef} style={{ width: '100%', height: 680, background: '#f8fafc', borderRadius: 12, border: '1px solid #e5e7eb' }}>
        {/* key forces full remount when layout changes → fitView fires on clean mount */}
        <ReactFlowProvider key={`${shownAuthors}-${isLarge}`}>
          <NetworkFlow nodes={nodes} edges={edges} isLarge={isLarge} onAuthorClick={onAuthorClick} />
        </ReactFlowProvider>
      </div>
    </div>
  );
};

export default CoAuthorNetworkGraph;
