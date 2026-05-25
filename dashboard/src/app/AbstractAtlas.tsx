'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Papa from 'papaparse';

// ── Types ──────────────────────────────────────────────────────────────────────
type AtlasPaper = {
  SN: number;
  title: string;
  DOI: string;
  domain: string;
  cluster: number;
  cluster_label: string;
  year: number;
  authors: string;
  author_regions: string;
  abstract: string;
  keywords: string;
  cited_by_count: number;
  is_oa: string;
  oa_status: string;
  openalex_countries: string;
  openalex_authors: string;
  umap_x: number;
  umap_y: number;
  umap_x3: number;
  umap_y3: number;
  umap_z3: number;
};

// ── Palette (matches main site blue accent + vivid domain colours) ─────────────
const DOMAIN_COLORS: Record<string, string> = {
  'Health & Clinical AI':                    '#e63946',
  'General Fairness & Bias Mitigation':      '#2563eb',
  'Graph-Based Fairness & Bias Mitigation':  '#059669',
  'LLMs & NLP':                              '#d97706',
  'Recommender Systems':                     '#7c3aed',
};

// Tol-bright – colour-vision-friendly
const CLUSTER_PALETTE = [
  '#4477AA','#EE6677','#228833','#CCBB44',
  '#66CCEE','#AA3377','#BBBBBB','#FF7733',
  '#44BB99','#AAAA00','#885566','#77AADD',
  '#117733','#882255',
];

const domainColor  = (d: string)  => DOMAIN_COLORS[d] ?? '#64748b';
const clusterColor = (c: number)  => c < 0 ? '#94a3b8' : CLUSTER_PALETTE[c % CLUSTER_PALETTE.length];

// ── Helpers ────────────────────────────────────────────────────────────────────
const norm = (s: unknown) => String(s ?? '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ');

function pointInPolygon(px: number, py: number, poly: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (((yi > py) !== (yj > py)) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi)
      inside = !inside;
  }
  return inside;
}

function hl(text: string, q: string): React.ReactNode {
  if (!q.trim()) return text;
  const re = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return text.split(re).map((p, i) =>
    re.test(p) ? <mark key={i} className="bg-yellow-200 text-yellow-900 rounded-sm px-0.5">{p}</mark> : p
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function AbstractAtlas() {
  const [papers, setPapers]   = useState<AtlasPaper[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [query, setQuery]             = useState('');
  const [activeDomains, setActiveDomains]   = useState<Set<string>>(new Set());
  const [activeClusters, setActiveClusters] = useState<Set<number>>(new Set());
  const [colorMode, setColorMode]     = useState<'domain' | 'cluster'>('domain');
  const [lassoMode, setLassoMode]     = useState(false);
  const [lassoFilter, setLassoFilter] = useState<Set<number> | null>(null);
  const [showMaps, setShowMaps]       = useState(true);

  // Selection / hover
  const [selected, setSelected] = useState<AtlasPaper | null>(null);
  const [hovered, setHovered]   = useState<AtlasPaper | null>(null);
  const [tipPos, setTipPos]     = useState({ x: 0, y: 0, c: '2d' as '2d' | '3d' });

  // 2-D canvas
  const c2ref   = useRef<HTMLCanvasElement>(null);
  const wrap2   = useRef<HTMLDivElement>(null);
  const sz2     = useRef({ w: 0, h: 0 });
  const tx2     = useRef({ tx: 0, ty: 0, scale: 1 });
  const drag2   = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
  const lasso   = useRef<[number, number][]>([]);
  const lassoing = useRef(false);
  const raf2    = useRef(0);

  // 3-D canvas
  const c3ref   = useRef<HTMLCanvasElement>(null);
  const wrap3   = useRef<HTMLDivElement>(null);
  const sz3     = useRef({ w: 0, h: 0 });
  const rot3    = useRef({ x: 0.28, y: -0.42 });
  const zoom3   = useRef(1);
  const drag3   = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
  const raf3    = useRef(0);

  const listRef   = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Render-only refs (avoid stale closures)
  const selRef       = useRef<AtlasPaper | null>(null);
  const hovRef       = useRef<AtlasPaper | null>(null);
  const filtRef      = useRef<Set<number>>(new Set());
  const colorModeRef = useRef<'domain' | 'cluster'>('domain');

  // ── Load CSV ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const base = process.env.NODE_ENV === 'production' ? '/algorithmic-bias-survey' : '';
    Papa.parse(`${base}/atlas_data.csv`, {
      download: true, header: true, dynamicTyping: true, skipEmptyLines: true,
      complete: (res) => {
        setPapers((res.data as AtlasPaper[]).filter(r => typeof r.umap_x === 'number'));
        setLoading(false);
      },
    });
  }, []);

  // ── Derived ─────────────────────────────────────────────────────────────────
  const dataRange = useMemo(() => {
    if (!papers.length) return null;
    const xs = papers.map(p => p.umap_x), ys = papers.map(p => p.umap_y);
    return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
  }, [papers]);

  const dataRange3 = useMemo(() => {
    if (!papers.length) return null;
    const xs = papers.map(p => p.umap_x3).filter(v => typeof v === 'number');
    const ys = papers.map(p => p.umap_y3).filter(v => typeof v === 'number');
    const zs = papers.map(p => p.umap_z3).filter(v => typeof v === 'number');
    if (!xs.length) return null;
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    const cz = (Math.min(...zs) + Math.max(...zs)) / 2;
    const maxR = Math.max(...xs.map((x, i) => Math.hypot(x - cx, ys[i] - cy, zs[i] - cz))) || 1;
    return { cx, cy, cz, maxR };
  }, [papers]);

  const filteredPapers = useMemo(() => {
    const q = norm(query);
    return papers.filter(p => {
      if (activeDomains.size   && !activeDomains.has(p.domain))   return false;
      if (activeClusters.size  && !activeClusters.has(p.cluster)) return false;
      if (lassoFilter && !lassoFilter.has(p.SN)) return false;
      if (!q) return true;
      return norm(p.title).includes(q) || norm(p.abstract).includes(q)
          || norm(p.keywords).includes(q) || norm(p.authors).includes(q);
    });
  }, [papers, query, activeDomains, activeClusters, lassoFilter]);

  const domains   = Object.keys(DOMAIN_COLORS);
  const clusters  = useMemo(() => [...new Set(papers.map(p => p.cluster))].sort((a, b) => a - b), [papers]);
  const clusterLabel = useMemo(() => {
    const m: Record<number, string> = {};
    papers.forEach(p => { m[p.cluster] = p.cluster_label || `Cluster ${p.cluster}`; });
    return m;
  }, [papers]);
  const domainCounts = useMemo(() =>
    Object.fromEntries(domains.map(d => [d, papers.filter(p => p.domain === d).length])),
    [papers, domains]
  );

  // Sync mutable refs before each paint
  filtRef.current      = new Set(filteredPapers.map(p => p.SN));
  selRef.current       = selected;
  hovRef.current       = hovered;
  colorModeRef.current = colorMode;

  // ── Coordinate helpers ───────────────────────────────────────────────────────
  const toScreen2 = useCallback((ux: number, uy: number) => {
    const { w, h } = sz2.current;
    const { tx, ty, scale } = tx2.current;
    const dr = dataRange;
    if (!dr) return { sx: 0, sy: 0 };
    const PAD = 40;
    const bx = PAD + ((ux - dr.minX) / (dr.maxX - dr.minX)) * (w - PAD * 2);
    const by = PAD + (1 - (uy - dr.minY) / (dr.maxY - dr.minY)) * (h - PAD * 2);
    return { sx: bx * scale + tx, sy: by * scale + ty };
  }, [dataRange]);

  const project3 = useCallback((px: number, py: number, pz: number) => {
    const dr = dataRange3;
    if (!dr) return { sx: 0, sy: 0, depth: 0 };
    const { w, h } = sz3.current;
    const nx = (px - dr.cx) / dr.maxR, ny = (py - dr.cy) / dr.maxR, nz = (pz - dr.cz) / dr.maxR;
    const { x: rx, y: ry } = rot3.current;
    const cX = Math.cos(rx), sX = Math.sin(rx), cY = Math.cos(ry), sY = Math.sin(ry);
    const x1 = cY * nx + sY * nz, z1 = -sY * nx + cY * nz;
    const y2 = cX * ny - sX * z1, z2 = sX * ny + cX * z1;
    const DIST = 3.5;
    const sc = DIST / (DIST + z2);
    const S = Math.min(w, h) * 0.38 * zoom3.current;
    return { sx: w / 2 + x1 * S * sc, sy: h / 2 - y2 * S * sc, depth: z2 };
  }, [dataRange3]);

  // ── Color picker ─────────────────────────────────────────────────────────────
  const getColor = (p: AtlasPaper) =>
    colorModeRef.current === 'domain' ? domainColor(p.domain) : clusterColor(p.cluster);

  // ── 2D render ────────────────────────────────────────────────────────────────
  function render2() {
    const canvas = c2ref.current; if (!canvas || !dataRange) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const { w, h } = sz2.current;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#f8fafc'; ctx.fillRect(0, 0, w, h);

    const { scale } = tx2.current;
    const R = Math.max(2.5, Math.min(5 * Math.sqrt(scale), 9));
    const filt = filtRef.current;
    const hasF = filt.size < papers.length;

    // Dim pass
    for (const p of papers) {
      if (hasF && filt.has(p.SN)) continue;
      const { sx, sy } = toScreen2(p.umap_x, p.umap_y);
      ctx.beginPath(); ctx.arc(sx, sy, R * 0.65, 0, Math.PI * 2);
      ctx.fillStyle = getColor(p) + (hasF ? '20' : '80');
      ctx.fill();
    }

    // Active pass
    const active = hasF ? filteredPapers : papers;
    for (const p of active) {
      const { sx, sy } = toScreen2(p.umap_x, p.umap_y);
      const isHov = hovRef.current?.SN === p.SN;
      const isSel = selRef.current?.SN === p.SN;
      const r = isSel ? R * 2 : isHov ? R * 1.6 : R;
      if (isHov || isSel) {
        const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 2.8);
        g.addColorStop(0, getColor(p) + '44'); g.addColorStop(1, 'transparent');
        ctx.beginPath(); ctx.arc(sx, sy, r * 2.8, 0, Math.PI * 2);
        ctx.fillStyle = g; ctx.fill();
      }
      ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fillStyle = isSel ? '#fff' : getColor(p) + (hasF ? 'ee' : 'cc');
      ctx.fill();
      if (isSel || isHov) {
        ctx.strokeStyle = getColor(p); ctx.lineWidth = isSel ? 2.5 : 1.5; ctx.stroke();
      }
    }

    // Lasso outline
    if (lasso.current.length > 1) {
      ctx.beginPath();
      ctx.moveTo(lasso.current[0][0], lasso.current[0][1]);
      lasso.current.slice(1).forEach(([lx, ly]) => ctx.lineTo(lx, ly));
      ctx.closePath();
      ctx.strokeStyle = '#2563eb'; ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 3]); ctx.stroke();
      ctx.fillStyle = '#2563eb15'; ctx.fill();
      ctx.setLineDash([]);
    }
  }

  // ── 3D render ────────────────────────────────────────────────────────────────
  function render3() {
    const canvas = c3ref.current; if (!canvas || !dataRange3) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const { w, h } = sz3.current;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#f0f4f8'; ctx.fillRect(0, 0, w, h);

    const has3d = papers.some(p => typeof p.umap_x3 === 'number');
    if (!has3d) {
      ctx.fillStyle = '#94a3b8'; ctx.font = '13px system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.fillText('3D data not available', w / 2, h / 2); ctx.textAlign = 'left';
      return;
    }

    const filt = filtRef.current; const hasF = filt.size < papers.length;
    const pts = papers
      .filter(p => typeof p.umap_x3 === 'number')
      .map(p => ({ p, ...project3(p.umap_x3, p.umap_y3, p.umap_z3) }))
      .sort((a, b) => b.depth - a.depth);

    for (const { p, sx, sy } of pts) {
      const inF = !hasF || filt.has(p.SN);
      const isHov = hovRef.current?.SN === p.SN;
      const isSel = selRef.current?.SN === p.SN;
      const R = 4.5;
      if (!inF) {
        ctx.beginPath(); ctx.arc(sx, sy, R * 0.55, 0, Math.PI * 2);
        ctx.fillStyle = getColor(p) + '22'; ctx.fill(); continue;
      }
      const r = isSel ? R * 2.2 : isHov ? R * 1.7 : R;
      ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fillStyle = getColor(p) + (isSel ? '' : 'cc'); ctx.fill();
      if (isSel || isHov) {
        ctx.strokeStyle = isSel ? '#1e293b' : getColor(p);
        ctx.lineWidth = isSel ? 2 : 1; ctx.stroke();
      }
    }
  }

  function go2() { cancelAnimationFrame(raf2.current); raf2.current = requestAnimationFrame(render2); }
  function go3() { cancelAnimationFrame(raf3.current); raf3.current = requestAnimationFrame(render3); }

  // Trigger redraws after every React render (refs are always current, no setState in RAF)
  useEffect(() => { go2(); go3(); });

  // ── ResizeObserver ───────────────────────────────────────────────────────────
  useEffect(() => {
    const obs = (ref: React.RefObject<HTMLDivElement | null>, sz: React.MutableRefObject<{w:number;h:number}>, cref: React.RefObject<HTMLCanvasElement | null>, go: () => void) =>
      new ResizeObserver(([e]) => {
        const { width: w, height: h } = e.contentRect;
        sz.current = { w, h };
        if (cref.current) { cref.current.width = w; cref.current.height = h; }
        go();
      });
    const o2 = obs(wrap2, sz2, c2ref, go2); if (wrap2.current) o2.observe(wrap2.current);
    const o3 = obs(wrap3, sz3, c3ref, go3); if (wrap3.current) o3.observe(wrap3.current);
    return () => { o2.disconnect(); o3.disconnect(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [papers, dataRange, dataRange3]);

  // ── Hit detection ────────────────────────────────────────────────────────────
  function hit2(ex: number, ey: number) {
    const { scale } = tx2.current;
    const R = Math.max(2.5, Math.min(5 * Math.sqrt(scale), 9)) + 6;
    let best: AtlasPaper | null = null, bd = Infinity;
    for (const p of filtRef.current.size ? papers.filter(p2 => filtRef.current.has(p2.SN)) : papers) {
      const { sx, sy } = toScreen2(p.umap_x, p.umap_y);
      const d = Math.hypot(ex - sx, ey - sy);
      if (d < R && d < bd) { bd = d; best = p; }
    }
    return best;
  }

  function hit3(ex: number, ey: number) {
    let best: AtlasPaper | null = null, bd = Infinity;
    for (const p of filtRef.current.size ? papers.filter(p2 => filtRef.current.has(p2.SN)) : papers) {
      if (typeof p.umap_x3 !== 'number') continue;
      const { sx, sy } = project3(p.umap_x3, p.umap_y3, p.umap_z3);
      const d = Math.hypot(ex - sx, ey - sy);
      if (d < 12 && d < bd) { bd = d; best = p; }
    }
    return best;
  }

  // ── 2D mouse ─────────────────────────────────────────────────────────────────
  const on2Down = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    const rect = c2ref.current!.getBoundingClientRect();
    const ex = e.clientX - rect.left, ey = e.clientY - rect.top;
    if (lassoMode) { lassoing.current = true; lasso.current = [[ex, ey]]; }
    else drag2.current = { sx: e.clientX, sy: e.clientY, ox: tx2.current.tx, oy: tx2.current.ty };
  };

  const on2Move = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = c2ref.current!.getBoundingClientRect();
    const ex = e.clientX - rect.left, ey = e.clientY - rect.top;
    if (lassoing.current) { lasso.current = [...lasso.current, [ex, ey]]; go2(); return; }
    if (drag2.current) {
      tx2.current.tx = drag2.current.ox + (e.clientX - drag2.current.sx);
      tx2.current.ty = drag2.current.oy + (e.clientY - drag2.current.sy);
      go2(); return;
    }
    const h = hit2(ex, ey);
    setHovered(h);
    if (h) setTipPos({ x: ex, y: ey, c: '2d' });
    if (c2ref.current) c2ref.current.style.cursor = h ? 'pointer' : lassoMode ? 'crosshair' : 'grab';
  };

  const on2Up = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (lassoing.current) {
      lassoing.current = false;
      const poly = lasso.current;
      if (poly.length > 3) {
        const inside = new Set(
          papers.filter(p => {
            const { sx, sy } = toScreen2(p.umap_x, p.umap_y);
            return pointInPolygon(sx, sy, poly);
          }).map(p => p.SN)
        );
        setLassoFilter(inside.size ? inside : null);
      }
      lasso.current = []; go2(); return;
    }
    const wasDrag = drag2.current &&
      (Math.abs(e.clientX - drag2.current.sx) > 4 || Math.abs(e.clientY - drag2.current.sy) > 4);
    drag2.current = null;
    if (!wasDrag) {
      const rect = c2ref.current!.getBoundingClientRect();
      const p = hit2(e.clientX - rect.left, e.clientY - rect.top);
      setSelected(prev => prev?.SN === p?.SN ? null : (p ?? null));
      if (p) scrollListTo(p);
    }
  };

  const on2Wheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const rect = c2ref.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const f = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    const { tx, ty, scale } = tx2.current;
    const ns = Math.min(Math.max(scale * f, 0.2), 25);
    tx2.current = { tx: mx - (mx - tx) * (ns / scale), ty: my - (my - ty) * (ns / scale), scale: ns };
    go2();
  };

  // ── 3D mouse ─────────────────────────────────────────────────────────────────
  const on3Down = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    drag3.current = { sx: e.clientX, sy: e.clientY, ox: rot3.current.x, oy: rot3.current.y };
  };
  const on3Move = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (drag3.current) {
      rot3.current.x = drag3.current.ox + (e.clientY - drag3.current.sy) / sz3.current.h * Math.PI;
      rot3.current.y = drag3.current.oy + (e.clientX - drag3.current.sx) / sz3.current.w * Math.PI * 2;
      go3(); return;
    }
    const rect = c3ref.current!.getBoundingClientRect();
    const ex = e.clientX - rect.left, ey = e.clientY - rect.top;
    const h = hit3(ex, ey);
    setHovered(h); if (h) setTipPos({ x: ex, y: ey, c: '3d' });
    if (c3ref.current) c3ref.current.style.cursor = h ? 'pointer' : 'grab';
  };
  const on3Up = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const wasDrag = drag3.current &&
      (Math.abs(e.clientX - drag3.current.sx) > 4 || Math.abs(e.clientY - drag3.current.sy) > 4);
    drag3.current = null;
    if (!wasDrag) {
      const rect = c3ref.current!.getBoundingClientRect();
      const p = hit3(e.clientX - rect.left, e.clientY - rect.top);
      setSelected(prev => prev?.SN === p?.SN ? null : (p ?? null));
      if (p) scrollListTo(p);
    }
  };
  const on3Wheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    zoom3.current = Math.min(Math.max(zoom3.current * (e.deltaY < 0 ? 1.12 : 1 / 1.12), 0.3), 6);
    go3();
  };

  // ── Scroll list to paper ──────────────────────────────────────────────────────
  function scrollListTo(p: AtlasPaper) {
    setTimeout(() => {
      listRef.current?.querySelector(`[data-sn="${p.SN}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 50);
  }

  // ── Pan 2D to paper ───────────────────────────────────────────────────────────
  function panTo(p: AtlasPaper) {
    const { w, h } = sz2.current;
    const dr = dataRange; if (!dr) return;
    const PAD = 40;
    const bx = PAD + ((p.umap_x - dr.minX) / (dr.maxX - dr.minX)) * (w - PAD * 2);
    const by = PAD + (1 - (p.umap_y - dr.minY) / (dr.maxY - dr.minY)) * (h - PAD * 2);
    const s = tx2.current.scale;
    tx2.current.tx = w / 2 - bx * s;
    tx2.current.ty = h / 2 - by * s;
    go2();
  }

  // ── Keyboard shortcuts ────────────────────────────────────────────────────────
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === 'Escape') { setSelected(null); setQuery(''); setActiveDomains(new Set()); setActiveClusters(new Set()); setLassoFilter(null); lasso.current = []; go2(); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Loading ───────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center h-64 gap-3 text-gray-500 text-sm">
      <div className="w-6 h-6 border-3 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
      Loading atlas…
    </div>
  );

  const hasFilters = !!(activeDomains.size || activeClusters.size || lassoFilter || query);

  return (
    <div className="flex flex-col overflow-hidden bg-white" style={{ height: 'calc(100vh - 72px)' }}>

      {/* ── Toolbar (matches main site white/blue style) ─────────────────────── */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-2.5 flex items-center gap-3 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[220px] max-w-lg">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input ref={searchRef} type="text" value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search title, abstract, keyword… ( press / )"
            className="w-full border border-gray-200 rounded-lg pl-9 pr-8 py-1.5 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200 bg-gray-50"
          />
          {query && <button onClick={() => setQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg></button>}
        </div>

        {/* Domain pills — same blue accent style as main dashboard */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {domains.map(d => (
            <button key={d} onClick={() => setActiveDomains(prev => { const n = new Set(prev); n.has(d) ? n.delete(d) : n.add(d); return n; })}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all"
              style={activeDomains.has(d)
                ? { background: domainColor(d), borderColor: domainColor(d), color: '#fff' }
                : { background: '#fff', borderColor: '#e2e8f0', color: '#475569' }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: activeDomains.has(d) ? '#fff' : domainColor(d) }} />
              {d.replace('Graph-Based ', 'Graph ').replace(' & Bias Mitigation', '')}
              <span className="opacity-70 ml-0.5">{domainCounts[d]}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 ml-auto shrink-0">
          {/* Color mode */}
          <div className="flex border border-gray-200 rounded-lg overflow-hidden text-[11px] font-medium">
            {(['domain', 'cluster'] as const).map(m => (
              <button key={m} onClick={() => setColorMode(m)}
                className={`px-2.5 py-1 capitalize ${colorMode === m ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>{m}</button>
            ))}
          </div>

          {/* Lasso */}
          <button onClick={() => { setLassoMode(v => !v); setLassoFilter(null); lasso.current = []; go2(); }}
            className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium border rounded-lg transition-all ${lassoMode ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-400'}`}>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><ellipse cx="12" cy="12" rx="10" ry="6" strokeDasharray="4 2"/></svg>
            Lasso{lassoFilter ? ` (${lassoFilter.size})` : ''}
          </button>

          {/* Hide maps */}
          <button onClick={() => setShowMaps(v => !v)}
            className="px-2.5 py-1 text-[11px] font-medium border border-gray-200 rounded-lg text-gray-600 hover:border-gray-400 bg-white transition-all">
            {showMaps ? '↑ Hide maps' : '↓ Show maps'}
          </button>

          {hasFilters && (
            <button onClick={() => { setActiveDomains(new Set()); setActiveClusters(new Set()); setLassoFilter(null); setQuery(''); lasso.current = []; go2(); }}
              className="px-2.5 py-1 text-[11px] font-medium border border-red-200 text-red-500 rounded-lg hover:bg-red-50 transition-all bg-white">
              ✕ Reset
            </button>
          )}

          <span className="text-sm font-bold text-blue-800 min-w-[52px] text-right">
            {filteredPapers.length === papers.length ? papers.length : `${filteredPapers.length}/${papers.length}`}
          </span>
        </div>
      </div>

      {/* ── Maps (2D + 3D side-by-side) ─────────────────────────────────────── */}
      {showMaps && (
        <div className="flex-shrink-0 flex border-b border-gray-200" style={{ height: '44%' }}>

          {/* 2D */}
          <div className="flex-1 flex flex-col border-r border-gray-200">
            <div className="flex items-center justify-between px-3 py-1 bg-white border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">2D</span>
                {lassoMode && <span className="text-[10px] text-blue-600 font-medium">Draw lasso to filter</span>}
              </div>
              <button onClick={() => { tx2.current = { tx: 0, ty: 0, scale: 1 }; go2(); }} className="text-[10px] text-gray-400 hover:text-gray-600">↺ reset</button>
            </div>
            <div ref={wrap2} className="flex-1 relative overflow-hidden" style={{ cursor: lassoMode ? 'crosshair' : 'grab' }}>
              <canvas ref={c2ref}
                onMouseDown={on2Down} onMouseMove={on2Move} onMouseUp={on2Up}
                onMouseLeave={() => { drag2.current = null; lassoing.current = false; setHovered(null); }}
                onWheel={on2Wheel}
                className="absolute inset-0 w-full h-full"
              />
              {hovered && tipPos.c === '2d' && (
                <Tooltip paper={hovered} x={tipPos.x} y={tipPos.y} maxW={sz2.current.w} getColor={getColor} />
              )}
            </div>
          </div>

          {/* 3D */}
          <div className="flex-1 flex flex-col">
            <div className="flex items-center justify-between px-3 py-1 bg-white border-b border-gray-100 shrink-0">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">3D — drag to rotate</span>
              <button onClick={() => { rot3.current = { x: 0.28, y: -0.42 }; zoom3.current = 1; go3(); }} className="text-[10px] text-gray-400 hover:text-gray-600">↺ reset</button>
            </div>
            <div ref={wrap3} className="flex-1 relative overflow-hidden">
              <canvas ref={c3ref}
                onMouseDown={on3Down} onMouseMove={on3Move} onMouseUp={on3Up}
                onMouseLeave={() => { drag3.current = null; setHovered(null); }}
                onWheel={on3Wheel}
                className="absolute inset-0 w-full h-full" style={{ cursor: 'grab' }}
              />
              {hovered && tipPos.c === '3d' && (
                <Tooltip paper={hovered} x={tipPos.x} y={tipPos.y} maxW={sz3.current.w} getColor={getColor} />
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Bottom: Filters | List | Detail ─────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Filters sidebar */}
        <aside className="flex-shrink-0 w-48 border-r border-gray-200 overflow-y-auto bg-gray-50/60 p-3 space-y-4">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Filters</p>

          {/* Domain */}
          <div>
            <p className="text-[11px] font-semibold text-gray-600 mb-1.5 flex justify-between">
              Domain {activeDomains.size > 0 && <button onClick={() => setActiveDomains(new Set())} className="text-[10px] text-blue-500">clear</button>}
            </p>
            {domains.map(d => (
              <label key={d} className="flex items-center gap-1.5 py-0.5 cursor-pointer group">
                <input type="checkbox" checked={activeDomains.has(d)} onChange={() => setActiveDomains(prev => { const n = new Set(prev); n.has(d) ? n.delete(d) : n.add(d); return n; })} className="rounded border-gray-300 text-blue-600 focus:ring-blue-400 w-3 h-3" />
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: domainColor(d) }} />
                <span className="text-[10px] text-gray-600 flex-1 leading-tight">{d.replace('Graph-Based ', 'Graph ')}</span>
                <span className="text-[10px] text-gray-400">{domainCounts[d]}</span>
              </label>
            ))}
          </div>

          {/* Cluster */}
          <div>
            <p className="text-[11px] font-semibold text-gray-600 mb-1.5 flex justify-between">
              Cluster {activeClusters.size > 0 && <button onClick={() => setActiveClusters(new Set())} className="text-[10px] text-blue-500">clear</button>}
            </p>
            <div className="max-h-52 overflow-y-auto space-y-0.5">
              {clusters.map(c => (
                <label key={c} className="flex items-center gap-1.5 py-0.5 cursor-pointer">
                  <input type="checkbox" checked={activeClusters.has(c)} onChange={() => setActiveClusters(prev => { const n = new Set(prev); n.has(c) ? n.delete(c) : n.add(c); return n; })} className="rounded border-gray-300 text-blue-600 focus:ring-blue-400 w-3 h-3 shrink-0" />
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: clusterColor(c) }} />
                  <span className="text-[10px] text-gray-600 flex-1 leading-tight truncate">{c < 0 ? 'Unclustered' : (clusterLabel[c] || `C${c}`)}</span>
                  <span className="text-[10px] text-gray-400 shrink-0">{papers.filter(p => p.cluster === c).length}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="pt-2 border-t border-gray-200">
            <p className="text-[10px] text-gray-400 mb-1.5">Colour: <span className="text-blue-600 font-medium">{colorMode}</span></p>
            <p className="text-[10px] text-gray-400">Scroll/wheel to zoom · Drag 2D to pan · Drag 3D to rotate</p>
          </div>
        </aside>

        {/* Paper list */}
        <div className="flex-1 overflow-y-auto" ref={listRef}>
          <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-2 flex items-center justify-between z-10">
            <span className="text-sm font-bold text-gray-700">{filteredPapers.length} {filteredPapers.length === 1 ? 'paper' : 'papers'}</span>
            {hasFilters && <span className="text-[11px] text-blue-600 font-medium">filtered</span>}
          </div>
          {!filteredPapers.length
            ? <div className="p-8 text-center text-gray-400 text-sm">No papers match your filters.</div>
            : <ul className="divide-y divide-gray-100">
                {filteredPapers.map(p => (
                  <li key={p.SN} data-sn={p.SN}
                    onClick={() => { setSelected(prev => prev?.SN === p.SN ? null : p); panTo(p); scrollListTo(p); }}
                    className={`px-4 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors ${selected?.SN === p.SN ? 'bg-blue-50 border-l-2 border-blue-600' : ''}`}>
                    <div className="flex items-start gap-2">
                      <span className="text-[10px] text-gray-300 font-mono shrink-0 mt-0.5 w-8 text-right">{String(p.SN).padStart(4, '0')}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-800 leading-snug mb-0.5 line-clamp-2">
                          {query ? hl(p.title, query) : p.title}
                        </p>
                        <div className="flex items-center gap-1.5 text-[10px]">
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: colorMode === 'domain' ? domainColor(p.domain) : clusterColor(p.cluster) }} />
                          <span className="text-gray-500 truncate">{colorMode === 'domain' ? p.domain.replace('Graph-Based ','Graph ') : (clusterLabel[p.cluster] || `C${p.cluster}`)}</span>
                          <span className="text-gray-400 shrink-0">· {p.year}</span>
                          {p.cited_by_count > 0 && <span className="text-gray-400 ml-auto shrink-0">{p.cited_by_count} cit.</span>}
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
          }
        </div>

        {/* Detail panel */}
        <aside className="flex-shrink-0 w-80 border-l border-gray-200 overflow-y-auto bg-white">
          {selected
            ? <DetailPanel paper={selected} onClose={() => setSelected(null)} getColor={getColor} colorMode={colorMode} clusterLabel={clusterLabel} onKeyword={setQuery} />
            : <div className="flex flex-col items-center justify-center h-full text-gray-400 text-sm text-center p-8 gap-3">
                <svg className="w-10 h-10 text-gray-200" fill="none" stroke="currentColor" strokeWidth="1" viewBox="0 0 24 24">
                  <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z"/>
                </svg>
                <p>Click any point or paper for details</p>
                <p className="text-[11px] text-gray-300">Abstract · Authors · Keywords · DOI</p>
              </div>
          }
        </aside>
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 border-t border-gray-100 bg-gray-50 px-6 py-1.5 flex items-center justify-between text-[10px] text-gray-400">
        <span>Semantic UMAP · <span className="font-medium text-gray-500">all-MiniLM-L6-v2</span> · HDBSCAN clusters · 2D + 3D</span>
        <span>
          <kbd className="px-1.5 py-0.5 bg-white border border-gray-200 rounded text-[10px]">/</kbd> search ·{' '}
          <kbd className="px-1.5 py-0.5 bg-white border border-gray-200 rounded text-[10px]">Esc</kbd> reset
        </span>
      </div>
    </div>
  );
}

// ── Tooltip ──────────────────────────────────────────────────────────────────
function Tooltip({ paper, x, y, maxW, getColor }: { paper: AtlasPaper; x: number; y: number; maxW: number; getColor: (p: AtlasPaper) => string }) {
  return (
    <div className="absolute pointer-events-none z-30 bg-white border border-gray-200 rounded-xl shadow-lg px-3.5 py-3 max-w-[260px]"
      style={{ left: Math.min(x + 14, maxW - 270), top: Math.max(y - 90, 8) }}>
      <p className="text-xs font-semibold text-gray-800 leading-snug mb-1.5 line-clamp-3">{paper.title}</p>
      <div className="flex flex-wrap gap-1 text-[10px]">
        <span className="px-1.5 py-0.5 rounded-full font-medium" style={{ background: getColor(paper) + '22', color: getColor(paper) }}>
          {paper.domain.replace('Graph-Based ', 'Graph ')}
        </span>
        <span className="px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600">{paper.year}</span>
        {paper.cited_by_count > 0 && <span className="px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600">{paper.cited_by_count} cit.</span>}
        {paper.is_oa === 'True' && <span className="px-1.5 py-0.5 rounded-full bg-green-50 text-green-700">🔓 OA</span>}
      </div>
      <p className="text-[10px] text-gray-400 mt-1.5 italic">Click for full details ↗</p>
    </div>
  );
}

// ── Detail panel ──────────────────────────────────────────────────────────────
function DetailPanel({ paper, onClose, getColor, colorMode, clusterLabel, onKeyword }: {
  paper: AtlasPaper; onClose: () => void;
  getColor: (p: AtlasPaper) => string;
  colorMode: 'domain' | 'cluster';
  clusterLabel: Record<number, string>;
  onKeyword: (k: string) => void;
}) {
  const label = colorMode === 'domain'
    ? paper.domain.replace('Graph-Based ', 'Graph ')
    : (clusterLabel[paper.cluster] || `Cluster ${paper.cluster}`);

  return (
    <div className="p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Paper Detail</span>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <span className="font-mono text-[10px] text-gray-400">#{String(paper.SN).padStart(4,'0')}</span>
        <span className="px-2 py-0.5 text-[10px] rounded-full font-semibold"
          style={{ background: getColor(paper) + '20', color: getColor(paper) }}>{label}</span>
        {paper.is_oa === 'True' && <span className="px-2 py-0.5 text-[10px] rounded-full bg-green-50 text-green-700 font-medium">🔓 {paper.oa_status || 'OA'}</span>}
      </div>

      <h3 className="text-sm font-bold text-gray-900 leading-snug mb-4">{paper.title}</h3>

      {/* Meta grid */}
      <div className="space-y-2 mb-4 text-xs">
        <MetaRow label="Year" value={String(paper.year)} />
        {paper.cited_by_count > 0 && <MetaRow label="Citations" value={`${paper.cited_by_count}`} />}
        {paper.authors && (
          <div>
            <span className="font-semibold text-gray-500 text-[11px]">Authors</span>
            <p className="text-gray-700 mt-0.5 leading-relaxed">
              {paper.authors.split(';').slice(0,4).map(a => a.trim()).join(', ')}
              {paper.authors.split(';').length > 4 ? ' et al.' : ''}
            </p>
          </div>
        )}
        {paper.openalex_countries && (
          <div>
            <span className="font-semibold text-gray-500 text-[11px]">Countries</span>
            <p className="text-gray-700 mt-0.5">
              {[...new Set(paper.openalex_countries.split(';').map(c => c.trim()).filter(Boolean))].join(', ')}
            </p>
          </div>
        )}
        {paper.author_regions && (
          <div>
            <span className="font-semibold text-gray-500 text-[11px]">Author Regions</span>
            <p className="text-gray-700 mt-0.5">{[...new Set(paper.author_regions.split(';').map(r => r.trim()).filter(Boolean))].join(', ')}</p>
          </div>
        )}
      </div>

      {/* Keywords */}
      {paper.keywords && (
        <div className="mb-4">
          <p className="text-[11px] font-semibold text-gray-500 mb-1.5">Keywords</p>
          <div className="flex flex-wrap gap-1">
            {paper.keywords.split(';').filter(Boolean).slice(0,10).map(k => (
              <button key={k.trim()} onClick={() => onKeyword(k.trim())}
                className="px-2 py-0.5 text-[10px] bg-blue-50 text-blue-700 border border-blue-100 rounded-full hover:bg-blue-100 transition-colors">
                {k.trim()}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Abstract */}
      {paper.abstract && (
        <div className="mb-4">
          <p className="text-[11px] font-semibold text-gray-500 mb-1.5">Abstract</p>
          <p className="text-xs text-gray-600 leading-relaxed">{paper.abstract}</p>
        </div>
      )}

      {/* DOI link */}
      {paper.DOI && (
        <a href={`https://doi.org/${paper.DOI.replace(/^(https?:\/\/doi\.org\/|doi\.org\/)/, '')}`}
          target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
          Open paper ↗
        </a>
      )}
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-[11px] font-semibold text-gray-500 w-16 shrink-0">{label}</span>
      <span className="text-gray-700">{value}</span>
    </div>
  );
}
