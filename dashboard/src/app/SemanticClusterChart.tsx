'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import Papa from 'papaparse';

type ClusterPoint = {
  SN: number;
  'Paper Title': string;
  DOI: string;
  Domain: string;
  Year: number;
  umap_x: number;
  umap_y: number;
  umap_x_minilm: number;
  umap_y_minilm: number;
  umap_x_mpnet: number;
  umap_y_mpnet: number;
  umap_x_specter: number;
  umap_y_specter: number;
  cited_by_count: number;
  is_oa: string;
  oa_status: string;
  oa_url: string;
};

type ModelKey = 'minilm' | 'mpnet' | 'specter';

const EMBEDDING_MODELS: { key: ModelKey; label: string; description: string }[] = [
  { key: 'mpnet',   label: 'MPNet-base',   description: 'Best domain separation' },
  { key: 'minilm',  label: 'MiniLM-L6',    description: 'Fast, general purpose' },
  { key: 'specter', label: 'SPECTER',       description: 'Scientific paper trained' },
];

const DOMAIN_COLORS: Record<string, string> = {
  'Health & Clinical AI':                     '#e63946',
  'General Fairness & Bias Mitigation':       '#457b9d',
  'Graph-Based Fairness & Bias Mitigation':   '#2a9d8f',
  'LLMs & NLP':                               '#e9c46a',
  'Recommender Systems':                      '#f4a261',
};
const getColor = (domain: string) => DOMAIN_COLORS[domain] ?? '#adb5bd';

function convexHull(pts: {x: number; y: number}[]): {x: number; y: number}[] {
  if (pts.length < 3) return pts;
  const sorted = [...pts].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (O: {x:number;y:number}, A: {x:number;y:number}, B: {x:number;y:number}) =>
    (A.x - O.x) * (B.y - O.y) - (A.y - O.y) * (B.x - O.x);
  const lower: {x:number;y:number}[] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length-2], lower[lower.length-1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: {x:number;y:number}[] = [];
  for (const p of [...sorted].reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length-2], upper[upper.length-1], p) <= 0) upper.pop();
    upper.push(p);
  }
  upper.pop(); lower.pop();
  return lower.concat(upper);
}

interface TooltipState { x: number; y: number; point: ClusterPoint; }

export default function SemanticClusterChart() {
  const [points, setPoints]       = useState<ClusterPoint[]>([]);
  const [loading, setLoading]     = useState(true);
  const [tooltip, setTooltip]     = useState<TooltipState | null>(null);
  const [selected, setSelected]   = useState<ClusterPoint | null>(null);
  const [hovered, setHovered]     = useState<number | null>(null);
  const [activeDomains, setActiveDomains] = useState<Set<string>>(new Set());
  const [activeModel, setActiveModel] = useState<ModelKey>('mpnet');
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const base = process.env.NODE_ENV === 'production' ? '/algorithmic-bias-survey' : '';
    Papa.parse(`${base}/semantic_clusters.csv`, {
      download: true, header: true, dynamicTyping: true,
      complete: (result) => {
        setPoints(result.data.filter((r: unknown) => {
          const row = r as Record<string, unknown>;
          return row && typeof row['umap_x'] === 'number';
        }) as ClusterPoint[]);
        setLoading(false);
      },
    });
  }, []);

  const { scaledPoints, W, H } = useMemo(() => {
    if (!points.length) return { scaledPoints: [], W: 800, H: 560 };
    const W = 800, H = 560, PAD = 36;
    const xKey = `umap_x_${activeModel}` as keyof ClusterPoint;
    const yKey = `umap_y_${activeModel}` as keyof ClusterPoint;
    const xs = points.map(p => p[xKey] as number);
    const ys = points.map(p => p[yKey] as number);
    const [minX, maxX] = [Math.min(...xs), Math.max(...xs)];
    const [minY, maxY] = [Math.min(...ys), Math.max(...ys)];
    const scaleX = (v: number) => PAD + ((v - minX) / (maxX - minX)) * (W - PAD * 2);
    const scaleY = (v: number) => H - PAD - ((v - minY) / (maxY - minY)) * (H - PAD * 2);
    return {
      scaledPoints: points.map(p => ({
        ...p,
        sx: scaleX(p[xKey] as number),
        sy: scaleY(p[yKey] as number),
      })),
      W, H,
    };
  }, [points, activeModel]);

  const activePoints = useMemo(() =>
    activeDomains.size ? scaledPoints.filter(p => activeDomains.has(p.Domain)) : scaledPoints,
    [scaledPoints, activeDomains]
  );

  const dimPoints = useMemo(() =>
    activeDomains.size ? scaledPoints.filter(p => !activeDomains.has(p.Domain)) : [],
    [scaledPoints, activeDomains]
  );

  const hullPaths = useMemo(() => {
    if (!activeDomains.size) return [];
    return Array.from(activeDomains).flatMap(domain => {
      const pts = scaledPoints
        .filter(p => p.Domain === domain)
        .map(p => ({ x: (p as typeof p & {sx:number}).sx, y: (p as typeof p & {sy:number}).sy }));
      if (pts.length < 3) return [];
      const hull = convexHull(pts);
      return [{ domain, points: hull.map(p => `${p.x},${p.y}`).join(' ') }];
    });
  }, [scaledPoints, activeDomains]);

  const handleMouseMove = (e: React.MouseEvent<SVGCircleElement>, p: ClusterPoint & { sx: number; sy: number }) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top, point: p });
    setHovered(p.SN);
  };

  const domains = Object.keys(DOMAIN_COLORS);

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
      Loading semantic landscape…
    </div>
  );

  return (
    <div>
      {/* Embedding model selector */}
      <div className="flex flex-wrap gap-1.5 items-center mb-2">
        <span className="text-xs text-gray-500 mr-1">Embedding:</span>
        {EMBEDDING_MODELS.map(m => (
          <button
            key={m.key}
            title={m.description}
            className={`px-2.5 py-0.5 rounded-full text-xs border transition-colors ${
              activeModel === m.key
                ? 'bg-gray-800 text-white border-gray-800'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
            }`}
            onClick={() => { setActiveModel(m.key); setSelected(null); }}
          >{m.label}</button>
        ))}
      </div>

      {/* Domain filter */}
      <div className="flex flex-wrap gap-1.5 items-center mb-3">
        <span className="text-xs text-gray-500 mr-1">Highlight:</span>
        <button
          className={`px-2.5 py-0.5 rounded-full text-xs border transition-colors ${activeDomains.size === 0 ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`}
          onClick={() => setActiveDomains(new Set())}
        >All domains</button>
        {domains.map(d => (
          <button
            key={d}
            className="px-2.5 py-0.5 rounded-full text-xs border transition-colors"
            style={activeDomains.has(d)
              ? { background: getColor(d), color: '#fff', borderColor: getColor(d) }
              : { borderColor: getColor(d), color: getColor(d), background: '#fff' }}
            onClick={() => setActiveDomains(prev => {
              const next = new Set(prev);
              next.has(d) ? next.delete(d) : next.add(d);
              return next;
            })}
          >{d}</button>
        ))}
      </div>

      <div className="flex gap-4">
        {/* SVG */}
        <div className="relative flex-1" style={{ minWidth: 0 }}>
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            className="w-full"
            style={{ background: '#f8f9fa', borderRadius: 8, border: '1px solid #e5e7eb' }}
          >
            {/* Convex hull outlines — only when domains are selected */}
            {hullPaths.map(h => (
              <polygon key={h.domain}
                points={h.points}
                fill={getColor(h.domain)}
                fillOpacity={0.08}
                stroke={getColor(h.domain)}
                strokeWidth={1.5}
                strokeOpacity={0.6}
                strokeDasharray="5 3"
              />
            ))}

            {/* Dimmed points */}
            {dimPoints.map(p => (
              <circle key={p.SN}
                cx={(p as typeof p & { sx: number }).sx}
                cy={(p as typeof p & { sy: number }).sy}
                r={4} fill={getColor(p.Domain)} opacity={0.08} />
            ))}

            {/* Active points */}
            {activePoints.map(p => {
              const isHov = hovered === p.SN;
              const isSel = selected?.SN === p.SN;
              return (
                <circle key={p.SN}
                  cx={p.sx} cy={p.sy}
                  r={isSel ? 8 : isHov ? 7 : 5}
                  fill={getColor(p.Domain)}
                  stroke={isSel ? '#1e293b' : isHov ? '#fff' : 'none'}
                  strokeWidth={isSel ? 2 : 1.5}
                  opacity={0.85}
                  style={{ cursor: 'pointer', transition: 'r 0.1s ease' }}
                  onMouseMove={(e) => handleMouseMove(e, p)}
                  onMouseLeave={() => { setTooltip(null); setHovered(null); }}
                  onClick={() => setSelected(selected?.SN === p.SN ? null : p)}
                />
              );
            })}
          </svg>

          {/* Tooltip */}
          {tooltip && (
            <div
              className="absolute z-20 pointer-events-none bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-xs max-w-xs"
              style={{ left: Math.min(tooltip.x + 12, W - 230), top: tooltip.y - 8 }}
            >
              <p className="font-semibold text-gray-800 leading-snug mb-1">{tooltip.point['Paper Title']}</p>
              <p className="text-gray-500">{tooltip.point.Domain} · {tooltip.point.Year}</p>
              <p className="text-blue-600 mt-0.5">{tooltip.point.cited_by_count} citations · {tooltip.point.is_oa === 'True' ? '🔓 OA' : '🔒 closed'}</p>
              <p className="text-gray-300 mt-1 italic text-xs">Click for details</p>
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="flex flex-col gap-2 shrink-0 w-44">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-0.5">Domain</p>
          {Object.entries(DOMAIN_COLORS).map(([d, c]) => {
            const count = points.filter(p => p.Domain === d).length;
            return (
              <div key={d} className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full shrink-0" style={{ background: c }} />
                <span className="text-xs text-gray-600 leading-tight">{d}</span>
                <span className="text-xs text-gray-400 ml-auto shrink-0">({count})</span>
              </div>
            );
          })}
          <p className="text-xs text-gray-400 leading-snug mt-3">
            {activePoints.length} of {scaledPoints.length} papers
            {activeDomains.size ? ` in ${activeDomains.size} domain${activeDomains.size > 1 ? 's' : ''}` : ' shown'}
          </p>
          <p className="text-xs text-gray-300 leading-snug">
            Papers closer together share similar abstract content.
            Overlap between regions reflects interdisciplinary connections.
          </p>
        </div>
      </div>

      {/* Detail panel */}
      {selected && (
        <div className="mt-4 bg-gray-50 border border-gray-200 rounded-xl p-4 relative">
          <button
            className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 text-lg leading-none"
            onClick={() => setSelected(null)}
          >×</button>
          <p className="text-sm font-semibold text-gray-800 leading-snug mb-2 pr-6">
            {selected['Paper Title']}
          </p>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="px-2 py-0.5 rounded-full text-white" style={{ background: getColor(selected.Domain) }}>
              {selected.Domain}
            </span>
            <span className="px-2 py-0.5 bg-gray-200 text-gray-700 rounded-full">{selected.Year}</span>
            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full">{selected.cited_by_count} citations</span>
            <span className={`px-2 py-0.5 rounded-full ${selected.is_oa === 'True' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              {selected.is_oa === 'True' ? `Open Access (${selected.oa_status})` : 'Closed Access'}
            </span>
            {selected.DOI && (
              <a
                href={`https://doi.org/${selected.DOI.replace(/^(https?:\/\/doi\.org\/|doi\.org\/)/, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100 transition-colors"
              >DOI ↗</a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
