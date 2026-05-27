'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Papa from 'papaparse';
import { ComposableMap, Geographies, Geography, ZoomableGroup } from 'react-simple-maps';

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
  umap_x_mpnet: number;
  umap_y_mpnet: number;
  umap_x_minilm: number;
  umap_y_minilm: number;
  umap_x_specter: number;
  umap_y_specter: number;
  umap_x3: number;
  umap_y3: number;
  umap_z3: number;
  umap_x3_mpnet: number;  umap_y3_mpnet: number;  umap_z3_mpnet: number;
  umap_x3_minilm: number; umap_y3_minilm: number; umap_z3_minilm: number;
  umap_x3_specter: number;umap_y3_specter: number;umap_z3_specter: number;
};

type EmbedModel = 'mpnet' | 'minilm' | 'specter';
const EMBED_MODEL_LABELS: Record<EmbedModel, string> = {
  mpnet:   'MPNet',
  minilm:  'MiniLM',
  specter: 'SPECTER',
};

// ── Palette ────────────────────────────────────────────────────────────────────
const DOMAIN_COLORS: Record<string, string> = {
  'Health & Clinical AI':                    '#e63946',
  'General Fairness & Bias Mitigation':      '#2563eb',
  'Graph-Based Fairness & Bias Mitigation':  '#059669',
  'LLMs & NLP':                              '#d97706',
  'Recommender Systems':                     '#7c3aed',
};

const CLUSTER_PALETTE = [
  '#4477AA','#EE6677','#228833','#CCBB44',
  '#66CCEE','#AA3377','#BBBBBB','#FF7733',
  '#44BB99','#AAAA00','#885566','#77AADD',
  '#117733','#882255',
];

// Country name → Natural Earth GeoJSON name
const ATLAS_TO_GEO: Record<string, string> = {
  'USA':            'United States of America',
  'South Korea':    'Republic of Korea',
  'Czech Republic': 'Czechia',
  'Tanzania':       'United Republic of Tanzania',
  'Russia':         'Russia',
  'Iran':           'Iran',
  'Taiwan':         'Taiwan',
  'Vietnam':        'Vietnam',
  "Ivory Coast":    "Côte d'Ivoire",
};

const domainColor  = (d: string) => DOMAIN_COLORS[d] ?? '#64748b';
const clusterColor = (c: number) => c < 0 ? '#94a3b8' : CLUSTER_PALETTE[c % CLUSTER_PALETTE.length];
const toGeoName    = (name: string) => ATLAS_TO_GEO[name] ?? name;

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

  // Core filters
  const [query, setQuery]                   = useState('');
  const [activeDomains, setActiveDomains]   = useState<Set<string>>(new Set());
  const [activeClusters, setActiveClusters] = useState<Set<number>>(new Set());
  const [colorMode, setColorMode]           = useState<'domain' | 'cluster'>('domain');
  const [embedModel, setEmbedModel]         = useState<EmbedModel>('mpnet');
  const [lassoMode, setLassoMode]           = useState(false);
  const [lassoFilter, setLassoFilter]       = useState<Set<number> | null>(null);
  const [showMaps, setShowMaps]             = useState(true);
  const [rotate3d, setRotate3d]             = useState(true);
  const rotateRaf = useRef(0);

  // Map view: 'umap' = 2D+3D, 'world' = choropleth, 'collab' = collaboration
  const [mapView, setMapView] = useState<'umap' | 'world' | 'collab'>('umap');

  // Right-panel extra filters
  const [activeCountries, setActiveCountries] = useState<Set<string>>(new Set());
  const [activeAuthors,   setActiveAuthors]   = useState<Set<string>>(new Set());
  const [yearFrom, setYearFrom] = useState(0);
  const [yearTo,   setYearTo]   = useState(0);
  const [oaOnly,   setOaOnly]   = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const [authorSearch,  setAuthorSearch]  = useState('');

  // Selection / hover
  const [selected, setSelected] = useState<AtlasPaper | null>(null);
  const [hovered, setHovered]   = useState<AtlasPaper | null>(null);
  const [tipPos, setTipPos]     = useState({ x: 0, y: 0, c: '2d' as '2d' | '3d' });

  // 2-D canvas refs
  const c2ref    = useRef<HTMLCanvasElement>(null);
  const wrap2    = useRef<HTMLDivElement>(null);
  const sz2      = useRef({ w: 0, h: 0 });
  const tx2      = useRef({ tx: 0, ty: 0, scale: 1 });
  const drag2    = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
  const lasso    = useRef<[number, number][]>([]);
  const lassoing = useRef(false);
  const raf2     = useRef(0);

  // 3-D canvas refs
  const c3ref  = useRef<HTMLCanvasElement>(null);
  const wrap3  = useRef<HTMLDivElement>(null);
  const sz3    = useRef({ w: 0, h: 0 });
  const rot3   = useRef({ x: 0.28, y: -0.42 });
  const zoom3  = useRef(1);
  const drag3  = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
  const raf3   = useRef(0);

  // Render-function refs — always current so stale RAF closures stay fresh
  const render2Ref = useRef<() => void>(() => {});
  const render3Ref = useRef<() => void>(() => {});

  const listRef   = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Render-only refs (avoid stale event-handler closures)
  const selRef       = useRef<AtlasPaper | null>(null);
  const hovRef       = useRef<AtlasPaper | null>(null);
  const filtRef      = useRef<Set<number>>(new Set());
  const colorModeRef  = useRef<'domain' | 'cluster'>('domain');
  const embedModelRef = useRef<EmbedModel>('mpnet');

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
    const xk = `umap_x_${embedModel}` as keyof AtlasPaper;
    const yk = `umap_y_${embedModel}` as keyof AtlasPaper;
    const xs = papers.map(p => (p[xk] ?? p.umap_x) as number);
    const ys = papers.map(p => (p[yk] ?? p.umap_y) as number);
    return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
  }, [papers, embedModel]);

  const dataRange3 = useMemo(() => {
    if (!papers.length) return null;
    const xk = `umap_x3_${embedModel}` as keyof AtlasPaper;
    const yk = `umap_y3_${embedModel}` as keyof AtlasPaper;
    const zk = `umap_z3_${embedModel}` as keyof AtlasPaper;
    const xs = papers.map(p => (p[xk] ?? p.umap_x3) as number).filter(v => typeof v === 'number');
    const ys = papers.map(p => (p[yk] ?? p.umap_y3) as number).filter(v => typeof v === 'number');
    const zs = papers.map(p => (p[zk] ?? p.umap_z3) as number).filter(v => typeof v === 'number');
    if (!xs.length) return null;
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    const cz = (Math.min(...zs) + Math.max(...zs)) / 2;
    const maxR = Math.max(...xs.map((x, i) => Math.hypot(x - cx, ys[i] - cy, zs[i] - cz))) || 1;
    return { cx, cy, cz, maxR };
  }, [papers, embedModel]);

  const filteredPapers = useMemo(() => {
    const q = norm(query);
    return papers.filter(p => {
      if (activeDomains.size  && !activeDomains.has(p.domain))   return false;
      if (activeClusters.size && !activeClusters.has(p.cluster)) return false;
      if (lassoFilter && !lassoFilter.has(p.SN)) return false;
      if (oaOnly && p.is_oa !== 'True') return false;
      if (yearFrom > 0 && p.year < yearFrom) return false;
      if (yearTo   > 0 && p.year > yearTo)   return false;
      if (activeCountries.size) {
        const pC = new Set((p.openalex_countries || '').split(';').map(c => c.trim()).filter(Boolean));
        if (![...activeCountries].some(c => pC.has(c))) return false;
      }
      if (activeAuthors.size) {
        const pA = new Set((p.authors || '').split(';').map(a => a.trim()).filter(Boolean));
        if (![...activeAuthors].some(a => pA.has(a))) return false;
      }
      if (!q) return true;
      return norm(p.title).includes(q) || norm(p.abstract).includes(q)
          || norm(p.keywords).includes(q) || norm(p.authors).includes(q);
    });
  }, [papers, query, activeDomains, activeClusters, lassoFilter, oaOnly, yearFrom, yearTo, activeCountries, activeAuthors]);

  const domains  = Object.keys(DOMAIN_COLORS);
  const clusters = useMemo(() => [...new Set(papers.map(p => p.cluster))].sort((a, b) => a - b), [papers]);

  const clusterLabel = useMemo(() => {
    const m: Record<number, string> = {};
    papers.forEach(p => { m[p.cluster] = p.cluster_label || `Cluster ${p.cluster}`; });
    return m;
  }, [papers]);

  const domainCounts = useMemo(() =>
    Object.fromEntries(domains.map(d => [d, papers.filter(p => p.domain === d).length])),
    [papers, domains]
  );

  // ── Extra derived data for right panel ───────────────────────────────────────
  const allYears = useMemo(() =>
    [...new Set(papers.map(p => p.year).filter(Boolean))].sort((a, b) => a - b), [papers]);
  const minYear = allYears[0] ?? 2015;
  const maxYear = allYears[allYears.length - 1] ?? 2025;

  const countryCounts = useMemo(() => {
    const c: Record<string, number> = {};
    papers.forEach(p =>
      [...new Set((p.openalex_countries || '').split(';').map(x => x.trim()).filter(Boolean))]
        .forEach(country => { c[country] = (c[country] || 0) + 1; })
    );
    return Object.entries(c).sort((a, b) => b[1] - a[1]);
  }, [papers]);

  const authorCounts = useMemo(() => {
    const c: Record<string, number> = {};
    papers.forEach(p =>
      (p.authors || '').split(';').map(a => a.trim()).filter(Boolean)
        .forEach(a => { c[a] = (c[a] || 0) + 1; })
    );
    return Object.entries(c).sort((a, b) => b[1] - a[1]).filter(([, n]) => n > 1);
  }, [papers]);

  const yearDist = useMemo(() => {
    const c: Record<number, number> = {};
    filteredPapers.forEach(p => { c[p.year] = (c[p.year] || 0) + 1; });
    return allYears.map(y => ({ year: y, count: c[y] || 0 }));
  }, [filteredPapers, allYears]);

  // World-map aggregation (respects current filteredPapers)
  // rawNames: the original openalex_countries values that map to this geo
  const worldMapData = useMemo(() => {
    const byCountry: Record<string, { count: number; domains: Record<string, number>; dominant: string; rawNames: string[] }> = {};
    filteredPapers.forEach(p =>
      [...new Set((p.openalex_countries || '').split(';').map(c => c.trim()).filter(Boolean))]
        .forEach(raw => {
          const geo = toGeoName(raw);
          if (!byCountry[geo]) byCountry[geo] = { count: 0, domains: {}, dominant: '', rawNames: [] };
          byCountry[geo].count++;
          byCountry[geo].domains[p.domain] = (byCountry[geo].domains[p.domain] || 0) + 1;
          if (!byCountry[geo].rawNames.includes(raw)) byCountry[geo].rawNames.push(raw);
        })
    );
    Object.values(byCountry).forEach(d => {
      d.dominant = Object.entries(d.domains).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
    });
    return byCountry;
  }, [filteredPapers]);

  // Cross-region collaboration pairs
  const collabData = useMemo(() => {
    const pairs: Record<string, number> = {};
    filteredPapers.forEach(p => {
      const countries = [...new Set((p.openalex_countries || '').split(';').map(c => c.trim()).filter(Boolean))];
      for (let i = 0; i < countries.length; i++)
        for (let j = i + 1; j < countries.length; j++) {
          const key = [countries[i], countries[j]].sort().join(' × ');
          pairs[key] = (pairs[key] || 0) + 1;
        }
    });
    return Object.entries(pairs).sort((a, b) => b[1] - a[1]).slice(0, 30);
  }, [filteredPapers]);

  // Sync mutable refs before each paint
  filtRef.current      = new Set(filteredPapers.map(p => p.SN));
  selRef.current       = selected;
  hovRef.current       = hovered;
  colorModeRef.current  = colorMode;
  embedModelRef.current = embedModel;

  // ── Embedding model coord accessor ───────────────────────────────────────────
  const px  = (p: AtlasPaper) => (p[`umap_x_${embedModelRef.current}`  as keyof AtlasPaper] ?? p.umap_x)  as number;
  const py  = (p: AtlasPaper) => (p[`umap_y_${embedModelRef.current}`  as keyof AtlasPaper] ?? p.umap_y)  as number;
  const px3 = (p: AtlasPaper) => (p[`umap_x3_${embedModelRef.current}` as keyof AtlasPaper] ?? p.umap_x3) as number;
  const py3 = (p: AtlasPaper) => (p[`umap_y3_${embedModelRef.current}` as keyof AtlasPaper] ?? p.umap_y3) as number;
  const pz3 = (p: AtlasPaper) => (p[`umap_z3_${embedModelRef.current}` as keyof AtlasPaper] ?? p.umap_z3) as number;

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
    const DIST = 3.5, sc = DIST / (DIST + z2);
    const S = Math.min(w, h) * 0.38 * zoom3.current;
    return { sx: w / 2 + x1 * S * sc, sy: h / 2 - y2 * S * sc, depth: z2 };
  }, [dataRange3]);

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

    for (const p of papers) {
      if (hasF && filt.has(p.SN)) continue;
      const { sx, sy } = toScreen2(px(p), py(p));
      ctx.beginPath(); ctx.arc(sx, sy, R * 0.65, 0, Math.PI * 2);
      ctx.fillStyle = getColor(p) + (hasF ? '20' : '80'); ctx.fill();
    }

    const active = hasF ? filteredPapers : papers;
    for (const p of active) {
      const { sx, sy } = toScreen2(px(p), py(p));
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
      ctx.fillStyle = isSel ? '#fff' : getColor(p) + (hasF ? 'ee' : 'cc'); ctx.fill();
      if (isSel || isHov) {
        ctx.strokeStyle = getColor(p); ctx.lineWidth = isSel ? 2.5 : 1.5; ctx.stroke();
      }
    }

    if (lasso.current.length > 1) {
      ctx.beginPath();
      ctx.moveTo(lasso.current[0][0], lasso.current[0][1]);
      lasso.current.slice(1).forEach(([lx, ly]) => ctx.lineTo(lx, ly));
      ctx.closePath();
      ctx.strokeStyle = '#2563eb'; ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 3]); ctx.stroke();
      ctx.fillStyle = '#2563eb15'; ctx.fill(); ctx.setLineDash([]);
    }
  }

  // ── 3D render ────────────────────────────────────────────────────────────────
  function render3() {
    const canvas = c3ref.current; if (!canvas || !dataRange3) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const { w, h } = sz3.current;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#f0f4f8'; ctx.fillRect(0, 0, w, h);

    if (!papers.some(p => typeof px3(p) === 'number')) {
      ctx.fillStyle = '#94a3b8'; ctx.font = '13px system-ui,sans-serif';
      ctx.textAlign = 'center'; ctx.fillText('3D data not available', w / 2, h / 2);
      ctx.textAlign = 'left'; return;
    }

    const filt = filtRef.current; const hasF = filt.size < papers.length;
    const pts = papers
      .filter(p => typeof px3(p) === 'number')
      .map(p => ({ p, ...project3(px3(p), py3(p), pz3(p)) }))
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

  // Keep render refs current every React render
  render2Ref.current = render2;
  render3Ref.current = render3;

  function go2() { cancelAnimationFrame(raf2.current); raf2.current = requestAnimationFrame(() => render2Ref.current()); }
  function go3() { cancelAnimationFrame(raf3.current); raf3.current = requestAnimationFrame(() => render3Ref.current()); }

  // Lock body scroll so internal panels scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // 3D auto-rotate — reads render3Ref.current so never stale
  const rotate3dRef = useRef(rotate3d);
  rotate3dRef.current = rotate3d;
  useEffect(() => {
    function loop() {
      if (rotate3dRef.current && !drag3.current) {
        rot3.current.y += 0.006;
        render3Ref.current();
      }
      rotateRaf.current = requestAnimationFrame(loop);
    }
    rotateRaf.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rotateRaf.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Trigger redraws after every React render
  useEffect(() => { go2(); go3(); });

  // ── ResizeObserver ───────────────────────────────────────────────────────────
  useEffect(() => {
    const obs = (
      ref: React.RefObject<HTMLDivElement | null>,
      sz: React.MutableRefObject<{ w: number; h: number }>,
      cref: React.RefObject<HTMLCanvasElement | null>,
      go: () => void,
    ) => new ResizeObserver(([e]) => {
      const { width: w, height: h } = e.contentRect;
      sz.current = { w, h };
      if (cref.current) { cref.current.width = w; cref.current.height = h; }
      go();
    });
    const o2 = obs(wrap2, sz2, c2ref, go2); if (wrap2.current) o2.observe(wrap2.current);
    const o3 = obs(wrap3, sz3, c3ref, go3); if (wrap3.current) o3.observe(wrap3.current);
    return () => { o2.disconnect(); o3.disconnect(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [papers, dataRange, dataRange3, showMaps, mapView]);

  // ── Hit detection ────────────────────────────────────────────────────────────
  function hit2(ex: number, ey: number) {
    const { scale } = tx2.current;
    const R = Math.max(2.5, Math.min(5 * Math.sqrt(scale), 9)) + 6;
    let best: AtlasPaper | null = null, bd = Infinity;
    for (const p of filtRef.current.size ? papers.filter(p2 => filtRef.current.has(p2.SN)) : papers) {
      const { sx, sy } = toScreen2(px(p), py(p));
      const d = Math.hypot(ex - sx, ey - sy);
      if (d < R && d < bd) { bd = d; best = p; }
    }
    return best;
  }

  function hit3(ex: number, ey: number) {
    let best: AtlasPaper | null = null, bd = Infinity;
    for (const p of filtRef.current.size ? papers.filter(p2 => filtRef.current.has(p2.SN)) : papers) {
      if (typeof px3(p) !== 'number') continue;
      const { sx, sy } = project3(px3(p), py3(p), pz3(p));
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
            const { sx, sy } = toScreen2(px(p), py(p));
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

  function scrollListTo(p: AtlasPaper) {
    setTimeout(() => {
      listRef.current?.querySelector(`[data-sn="${p.SN}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 50);
  }

  function panTo(p: AtlasPaper) {
    const { w, h } = sz2.current;
    const dr = dataRange; if (!dr) return;
    const PAD = 40;
    const bx = PAD + ((px(p) - dr.minX) / (dr.maxX - dr.minX)) * (w - PAD * 2);
    const by = PAD + (1 - (py(p) - dr.minY) / (dr.maxY - dr.minY)) * (h - PAD * 2);
    const s = tx2.current.scale;
    tx2.current.tx = w / 2 - bx * s;
    tx2.current.ty = h / 2 - by * s;
    go2();
  }

  function downloadCSV() {
    const cols: (keyof AtlasPaper)[] = ['SN','title','DOI','domain','year','authors','author_regions','keywords','cited_by_count','is_oa','cluster_label'];
    const header = cols.join(',');
    const rows = filteredPapers.map(p => cols.map(c => {
      const v = String(p[c] ?? '').replace(/"/g, '""');
      return v.includes(',') || v.includes('"') || v.includes('\n') ? `"${v}"` : v;
    }).join(','));
    const blob = new Blob([header + '\n' + rows.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `atlas_papers_${filteredPapers.length}.csv`; a.click();
  }

  const resetAll = () => {
    setActiveDomains(new Set()); setActiveClusters(new Set()); setLassoFilter(null); setQuery('');
    setActiveCountries(new Set()); setActiveAuthors(new Set()); setYearFrom(0); setYearTo(0); setOaOnly(false);
    lasso.current = []; go2();
  };

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === 'Escape') resetAll();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64 gap-3 text-gray-500 text-sm">
      <div className="w-6 h-6 border-2 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
      Loading atlas…
    </div>
  );

  const hasFilters = !!(activeDomains.size || activeClusters.size || lassoFilter || query ||
    oaOnly || yearFrom > 0 || yearTo > 0 || activeCountries.size || activeAuthors.size);

  return (
    <div className="flex flex-col overflow-hidden bg-white" style={{ height: 'calc(100vh - 72px)' }}>

      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
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
          {query && (
            <button onClick={() => setQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          )}
        </div>

        {/* Domain pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {domains.map(d => (
            <button key={d}
              onClick={() => setActiveDomains(prev => { const n = new Set(prev); n.has(d) ? n.delete(d) : n.add(d); return n; })}
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
          {/* Map view */}
          <div className="flex border border-gray-200 rounded-lg overflow-hidden text-[11px] font-medium">
            {(['umap', 'world', 'collab'] as const).map(v => (
              <button key={v} onClick={() => setMapView(v)}
                className={`px-2.5 py-1 transition-colors ${mapView === v ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                {v === 'umap' ? 'UMAP' : v === 'world' ? '🌍 World' : '🔗 Collab'}
              </button>
            ))}
          </div>

          {/* Color mode */}
          <div className="flex border border-gray-200 rounded-lg overflow-hidden text-[11px] font-medium">
            {(['domain', 'cluster'] as const).map(m => (
              <button key={m} onClick={() => setColorMode(m)}
                className={`px-2.5 py-1 capitalize ${colorMode === m ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>{m}</button>
            ))}
          </div>

          {/* Embedding model */}
          <div className="flex border border-gray-200 rounded-lg overflow-hidden text-[11px] font-medium">
            {(Object.keys(EMBED_MODEL_LABELS) as EmbedModel[]).map(m => (
              <button key={m} onClick={() => { setEmbedModel(m); }}
                title={m === 'mpnet' ? 'Best domain separation' : m === 'minilm' ? 'Fast, general purpose' : 'Scientific paper trained'}
                className={`px-2.5 py-1 ${embedModel === m ? 'bg-purple-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                {EMBED_MODEL_LABELS[m]}
              </button>
            ))}
          </div>

          {/* Lasso */}
          <button onClick={() => { setLassoMode(v => !v); setLassoFilter(null); lasso.current = []; go2(); }}
            className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium border rounded-lg transition-all ${lassoMode ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-400'}`}>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><ellipse cx="12" cy="12" rx="10" ry="6" strokeDasharray="4 2"/></svg>
            Lasso{lassoFilter ? ` (${lassoFilter.size})` : ''}
          </button>

          {/* Toggle maps */}
          <button onClick={() => setShowMaps(v => !v)}
            className="px-2.5 py-1 text-[11px] font-medium border border-gray-200 rounded-lg text-gray-600 hover:border-gray-400 bg-white transition-all">
            {showMaps ? '↑ Hide maps' : '↓ Show maps'}
          </button>

          {/* Download */}
          <button onClick={downloadCSV}
            className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium border border-gray-200 rounded-lg text-gray-600 hover:border-green-400 hover:text-green-700 bg-white transition-all">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            CSV
          </button>

          {hasFilters && (
            <button onClick={resetAll}
              className="px-2.5 py-1 text-[11px] font-medium border border-red-200 text-red-500 rounded-lg hover:bg-red-50 transition-all bg-white">
              ✕ Reset
            </button>
          )}

          <span className="text-sm font-bold text-blue-800 min-w-[52px] text-right">
            {filteredPapers.length === papers.length ? papers.length : `${filteredPapers.length}/${papers.length}`}
          </span>
        </div>
      </div>

      {/* ── Maps ─────────────────────────────────────────────────────────────── */}
      {showMaps && (
        <div className="flex-shrink-0 flex border-b border-gray-200" style={{ height: '44%' }}>
          {mapView === 'umap' ? (
            <>
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
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">3D</span>
                    <span className="text-[10px] text-gray-400">{rotate3d ? '— auto-rotating' : '— drag to rotate'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setRotate3d(v => !v)}
                      className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border transition-colors ${rotate3d ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white border-gray-200 text-gray-500'}`}>
                      {rotate3d
                        ? <><svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> Pause</>
                        : <><svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24"><polygon points="5,3 19,12 5,21"/></svg> Play</>
                      }
                    </button>
                    <button onClick={() => { rot3.current = { x: 0.28, y: -0.42 }; zoom3.current = 1; go3(); }} className="text-[10px] text-gray-400 hover:text-gray-600">↺</button>
                  </div>
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
            </>
          ) : mapView === 'world' ? (
            <WorldMapPanel
              worldMapData={worldMapData}
              filteredCount={filteredPapers.length}
              activeCountries={activeCountries}
              onCountryClick={rawNames => {
                setActiveCountries(prev => {
                  const n = new Set(prev);
                  // If all rawNames already selected, deselect them (toggle off)
                  const allSelected = rawNames.every(r => n.has(r));
                  rawNames.forEach(r => allSelected ? n.delete(r) : n.add(r));
                  return n;
                });
              }}
            />
          ) : (
            <CollabPanel
              collabData={collabData}
              filteredCount={filteredPapers.length}
              activeCountries={activeCountries}
              onCountryClick={countries => {
                setActiveCountries(prev => {
                  const n = new Set(prev);
                  const allSelected = countries.every(c => n.has(c));
                  countries.forEach(c => allSelected ? n.delete(c) : n.add(c));
                  return n;
                });
              }}
            />
          )}
        </div>
      )}

      {/* ── Bottom: Filters | List | Detail/Filters ──────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left filter sidebar */}
        <aside className="flex-shrink-0 w-48 border-r border-gray-200 overflow-y-auto bg-gray-50/60 p-3 space-y-4">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Filters</p>

          <div>
            <p className="text-[11px] font-semibold text-gray-600 mb-1.5 flex justify-between">
              Domain {activeDomains.size > 0 && <button onClick={() => setActiveDomains(new Set())} className="text-[10px] text-blue-500">clear</button>}
            </p>
            {domains.map(d => (
              <label key={d} className="flex items-center gap-1.5 py-0.5 cursor-pointer">
                <input type="checkbox" checked={activeDomains.has(d)}
                  onChange={() => setActiveDomains(prev => { const n = new Set(prev); n.has(d) ? n.delete(d) : n.add(d); return n; })}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-400 w-3 h-3" />
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: domainColor(d) }} />
                <span className="text-[10px] text-gray-600 flex-1 leading-tight">{d.replace('Graph-Based ', 'Graph ')}</span>
                <span className="text-[10px] text-gray-400">{domainCounts[d]}</span>
              </label>
            ))}
          </div>

          <div>
            <p className="text-[11px] font-semibold text-gray-600 mb-1.5 flex justify-between">
              Cluster {activeClusters.size > 0 && <button onClick={() => setActiveClusters(new Set())} className="text-[10px] text-blue-500">clear</button>}
            </p>
            <div className="max-h-52 overflow-y-auto space-y-0.5">
              {clusters.map(c => (
                <label key={c} className="flex items-center gap-1.5 py-0.5 cursor-pointer">
                  <input type="checkbox" checked={activeClusters.has(c)}
                    onChange={() => setActiveClusters(prev => { const n = new Set(prev); n.has(c) ? n.delete(c) : n.add(c); return n; })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-400 w-3 h-3 shrink-0" />
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: clusterColor(c) }} />
                  <span className="text-[10px] text-gray-600 flex-1 leading-tight break-words">{c < 0 ? 'Unclustered' : (clusterLabel[c] || `C${c}`)}</span>
                  <span className="text-[10px] text-gray-400 shrink-0">{papers.filter(p => p.cluster === c).length}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="pt-2 border-t border-gray-200">
            <p className="text-[10px] text-gray-400 mb-1">Colour: <span className="text-blue-600 font-medium">{colorMode}</span></p>
            <p className="text-[10px] text-gray-400">Wheel: zoom · Drag 2D: pan · Drag 3D: rotate</p>
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

        {/* Right panel: detail when selected, else filter/analytics panel */}
        <aside className="flex-shrink-0 w-[500px] border-l border-gray-200 overflow-y-auto bg-white">
          {selected
            ? <DetailPanel
                paper={selected}
                allPapers={papers}
                onClose={() => setSelected(null)}
                getColor={getColor}
                colorMode={colorMode}
                clusterLabel={clusterLabel}
                onKeyword={setQuery}
                onSelectPaper={(p) => { setSelected(p); panTo(p); scrollListTo(p); }}
                embedModel={embedModel}
              />
            : <RightFilterPanel
                countryCounts={countryCounts}
                authorCounts={authorCounts}
                yearDist={yearDist}
                minYear={minYear}
                maxYear={maxYear}
                yearFrom={yearFrom}
                yearTo={yearTo}
                oaOnly={oaOnly}
                activeCountries={activeCountries}
                activeAuthors={activeAuthors}
                countrySearch={countrySearch}
                authorSearch={authorSearch}
                onYearFrom={setYearFrom}
                onYearTo={setYearTo}
                onOaOnly={setOaOnly}
                onToggleCountry={c => setActiveCountries(prev => { const n = new Set(prev); n.has(c) ? n.delete(c) : n.add(c); return n; })}
                onToggleAuthor={a => setActiveAuthors(prev => { const n = new Set(prev); n.has(a) ? n.delete(a) : n.add(a); return n; })}
                onCountrySearch={setCountrySearch}
                onAuthorSearch={setAuthorSearch}
                filteredCount={filteredPapers.length}
                totalCount={papers.length}
                onDownload={downloadCSV}
              />
          }
        </aside>
      </div>

      {/* Footer */}
      <footer className="flex-shrink-0 bg-gray-900 text-white px-8 py-5">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-center sm:text-left">
            <p className="text-gray-300 text-xs leading-relaxed">
              This work is part of{' '}
              <span className="font-semibold text-white">
                Towards FAIR AI: A Survey of Regional Trends and Knowledge Graph-Enhanced Bias Mitigation
              </span>
            </p>
            <p className="text-gray-400 text-xs mt-0.5">Abhash Shrestha · Tek Raj Chhetri · Sanju Tiwari</p>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-gray-500">
            <span>Semantic UMAP · <span className="text-gray-400">all-MiniLM-L6-v2</span> · HDBSCAN</span>
            <span className="text-gray-700">·</span>
            <span>&copy; {new Date().getFullYear()}</span>
            <a href="https://cair-nepal.org" className="text-gray-400 hover:text-white transition-colors underline" target="_blank" rel="noopener noreferrer">cair-nepal.org</a>
            <span className="text-gray-700">·</span>
            <a href="https://www.apache.org/licenses/LICENSE-2.0" className="text-gray-400 hover:text-white transition-colors underline" target="_blank" rel="noopener noreferrer">Apache 2.0</a>
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-2 pt-2 border-t border-gray-800 flex items-center justify-center gap-4 text-[10px] text-gray-600">
          <kbd className="px-1.5 py-0.5 bg-gray-800 border border-gray-700 rounded">/</kbd> search ·{' '}
          <kbd className="px-1.5 py-0.5 bg-gray-800 border border-gray-700 rounded">Esc</kbd> reset ·{' '}
          <span>drag to pan · scroll to zoom · lasso to multi-select</span>
        </div>
      </footer>
    </div>
  );
}

// ── Tooltip ───────────────────────────────────────────────────────────────────
function Tooltip({ paper, x, y, maxW, getColor }: {
  paper: AtlasPaper; x: number; y: number; maxW: number; getColor: (p: AtlasPaper) => string;
}) {
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

// ── WorldMapPanel ─────────────────────────────────────────────────────────────
function WorldMapPanel({
  worldMapData,
  filteredCount,
  activeCountries,
  onCountryClick,
}: {
  worldMapData: Record<string, { count: number; domains: Record<string, number>; dominant: string; rawNames: string[] }>;
  filteredCount: number;
  activeCountries: Set<string>;
  onCountryClick: (rawNames: string[]) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [tip, setTip] = useState<{ country: string; count: number; dominant: string; x: number; y: number } | null>(null);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50 text-gray-400 text-sm gap-2">
        <div className="w-4 h-4 border-2 border-gray-200 border-t-gray-400 rounded-full animate-spin" />
        Loading map…
      </div>
    );
  }

  const selectedCount = Object.values(worldMapData).filter(d => d.rawNames.some(r => activeCountries.has(r))).length;

  return (
    <div className="flex-1 relative bg-slate-50 overflow-hidden">
      <div className="absolute top-2 left-3 z-10 flex items-center gap-2">
        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
          Geographic Distribution · {filteredCount} papers
        </span>
        {activeCountries.size > 0 && (
          <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">
            {selectedCount} countr{selectedCount !== 1 ? 'ies' : 'y'} selected — click to deselect
          </span>
        )}
      </div>
      {activeCountries.size === 0 && (
        <div className="absolute top-2 right-3 z-10 text-[10px] text-gray-400">
          Click a country to filter papers
        </div>
      )}
      <ComposableMap projection="geoEqualEarth" projectionConfig={{ scale: 147 }} style={{ width: '100%', height: '100%' }}>
        <ZoomableGroup>
          <Geographies geography="https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json">
            {({ geographies }) => geographies.map(geo => {
              const name: string = geo.properties.NAME || geo.properties.name || '';
              const data = worldMapData[name];
              const base = data ? domainColor(data.dominant) : '#e2e8f0';
              const isSelected = data ? data.rawNames.some(r => activeCountries.has(r)) : false;
              const fillColor = data
                ? isSelected ? base : base + 'bb'
                : activeCountries.size > 0 ? '#f1f5f9' : base;
              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill={fillColor}
                  stroke={isSelected ? '#1e40af' : '#fff'}
                  strokeWidth={isSelected ? 1.5 : 0.5}
                  style={{
                    default: { outline: 'none' },
                    hover: { fill: data ? base : '#cbd5e1', outline: 'none', cursor: data ? 'pointer' : 'default' },
                    pressed: { fill: data ? base + 'dd' : '#cbd5e1', outline: 'none' },
                  }}
                  onMouseEnter={() => {
                    if (data) setTip({ country: name, count: data.count, dominant: data.dominant, x: 0, y: 0 });
                  }}
                  onMouseMove={(e: React.MouseEvent) => {
                    if (data) setTip(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null);
                  }}
                  onMouseLeave={() => setTip(null)}
                  onClick={() => {
                    if (data) onCountryClick(data.rawNames);
                  }}
                />
              );
            })}
          </Geographies>
        </ZoomableGroup>
      </ComposableMap>

      {/* Domain legend */}
      <div className="absolute bottom-2 left-3 flex flex-wrap gap-1.5 max-w-lg">
        {Object.entries(DOMAIN_COLORS).map(([d, c]) => (
          <span key={d} className="flex items-center gap-1 text-[9px] text-gray-600 bg-white/90 px-1.5 py-0.5 rounded-full border border-gray-100 shadow-sm">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: c }} />
            {d.replace('Graph-Based ', 'Graph ').replace(' & Bias Mitigation', '')}
          </span>
        ))}
      </div>

      {/* Tooltip */}
      {tip && (
        <div className="fixed pointer-events-none z-50 bg-gray-900/90 text-white text-[11px] px-3 py-2 rounded-lg shadow-lg"
          style={{ left: tip.x + 14, top: tip.y - 60 }}>
          <div className="font-semibold mb-0.5">{tip.country}</div>
          <div className="text-gray-300">{tip.count} contribution{tip.count !== 1 ? 's' : ''}</div>
          <div className="mt-0.5 font-medium" style={{ color: domainColor(tip.dominant) }}>
            {tip.dominant.replace('Graph-Based ', 'Graph ')}
          </div>
          <div className="mt-1 text-gray-400 italic">Click to filter papers</div>
        </div>
      )}
    </div>
  );
}

// ── CollabPanel ───────────────────────────────────────────────────────────────
function CollabPanel({ collabData, filteredCount, activeCountries, onCountryClick }: {
  collabData: [string, number][];
  filteredCount: number;
  activeCountries: Set<string>;
  onCountryClick: (countries: string[]) => void;
}) {
  const max = collabData[0]?.[1] || 1;
  return (
    <div className="flex-1 overflow-y-auto bg-slate-50">
      <div className="sticky top-0 bg-slate-50 border-b border-gray-200 px-4 py-2 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Cross-Region Collaboration</p>
          <p className="text-[11px] text-gray-500">{filteredCount} papers · top country co-authorship pairs</p>
        </div>
        {activeCountries.size > 0 && (
          <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">
            {activeCountries.size} selected
          </span>
        )}
      </div>
      {collabData.length > 0 && (
        <p className="text-[10px] text-gray-400 px-4 pt-3 pb-1">Click a pair to filter papers to that collaboration</p>
      )}
      <div className="p-4 pt-1 grid grid-cols-1 gap-2">
        {collabData.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-8">No cross-region collaborations in current filter.</p>
        )}
        {collabData.map(([pair, count]) => {
          const [a, b] = pair.split(' × ');
          const isSelected = activeCountries.has(a) && activeCountries.has(b);
          const isPartial = (activeCountries.has(a) || activeCountries.has(b)) && !isSelected;
          return (
            <button
              key={pair}
              onClick={() => onCountryClick([a, b])}
              className={`flex items-center gap-3 rounded-xl px-4 py-2.5 border shadow-sm w-full text-left transition-all ${
                isSelected
                  ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-200'
                  : isPartial
                  ? 'bg-blue-50/50 border-blue-200'
                  : 'bg-white border-gray-100 hover:bg-blue-50/40 hover:border-blue-200'
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 mb-1.5">
                  <span className={activeCountries.has(a) ? 'text-blue-700' : ''}>{a}</span>
                  <span className="text-gray-300 font-normal">×</span>
                  <span className={activeCountries.has(b) ? 'text-blue-700' : ''}>{b}</span>
                  {isSelected && <span className="ml-auto text-[10px] text-blue-500">✓ filtered</span>}
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${isSelected ? 'bg-blue-600' : 'bg-blue-400'}`}
                    style={{ width: `${(count / max) * 100}%` }} />
                </div>
              </div>
              <span className={`text-base font-bold shrink-0 w-8 text-right ${isSelected ? 'text-blue-700' : 'text-blue-500'}`}>{count}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── RightFilterPanel ──────────────────────────────────────────────────────────
type RightFilterPanelProps = {
  countryCounts: [string, number][];
  authorCounts: [string, number][];
  yearDist: { year: number; count: number }[];
  minYear: number; maxYear: number;
  yearFrom: number; yearTo: number;
  oaOnly: boolean;
  activeCountries: Set<string>; activeAuthors: Set<string>;
  countrySearch: string; authorSearch: string;
  onYearFrom: (y: number) => void; onYearTo: (y: number) => void;
  onOaOnly: (v: boolean) => void;
  onToggleCountry: (c: string) => void;
  onToggleAuthor: (a: string) => void;
  onCountrySearch: (s: string) => void;
  onAuthorSearch: (s: string) => void;
  filteredCount: number; totalCount: number;
  onDownload: () => void;
};

function RightFilterPanel({
  countryCounts, authorCounts, yearDist, minYear, maxYear,
  yearFrom, yearTo, oaOnly,
  activeCountries, activeAuthors,
  countrySearch, authorSearch,
  onYearFrom, onYearTo, onOaOnly,
  onToggleCountry, onToggleAuthor,
  onCountrySearch, onAuthorSearch,
  filteredCount, totalCount, onDownload,
}: RightFilterPanelProps) {
  const maxBar = Math.max(...yearDist.map(d => d.count), 1);
  const visibleCountries = countryCounts.filter(([c]) =>
    !countrySearch || c.toLowerCase().includes(countrySearch.toLowerCase())
  );
  const visibleAuthors = authorCounts.filter(([a]) =>
    !authorSearch || a.toLowerCase().includes(authorSearch.toLowerCase())
  );

  return (
    <div className="divide-y divide-gray-100">

      {/* Header */}
      <div className="sticky top-0 bg-white z-10 px-4 pt-4 pb-3 border-b border-gray-100">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Filters &amp; Analytics</span>
          <button onClick={onDownload}
            className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-semibold bg-green-50 border border-green-200 text-green-700 rounded-lg hover:bg-green-100 transition-colors">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Download {filteredCount} papers
          </button>
        </div>
        <p className="text-[11px] text-gray-400">
          {filteredCount === totalCount ? `${totalCount} papers total` : `${filteredCount} of ${totalCount} papers`} · Click any point or paper for full details
        </p>
      </div>

      {/* Publication Timeline */}
      <div className="px-4 py-4">
        <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-3">Publication Timeline</p>
        <div className="flex items-end gap-0.5" style={{ height: 64 }}>
          {yearDist.map(({ year, count }) => (
            <div key={year} className="flex-1 flex flex-col items-center justify-end h-full gap-0.5 cursor-pointer group"
              onClick={() => { onYearFrom(year); onYearTo(year); }}>
              <div className="w-full rounded-t-sm transition-all group-hover:opacity-80"
                style={{
                  height: `${Math.max(2, (count / maxBar) * 52)}px`,
                  background: count > 0 ? '#3b82f6' : '#e2e8f0',
                }}
                title={`${year}: ${count} papers`}
              />
              <span className="text-[7px] text-gray-400 leading-none">{String(year).slice(2)}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 mt-3">
          <span className="text-[10px] text-gray-500 shrink-0">From</span>
          <select value={yearFrom || minYear} onChange={e => onYearFrom(Number(e.target.value))}
            className="text-[10px] border border-gray-200 rounded px-1.5 py-0.5 flex-1 bg-white text-gray-700 focus:outline-none focus:border-blue-300">
            {Array.from({ length: maxYear - minYear + 1 }, (_, i) => minYear + i).map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <span className="text-[10px] text-gray-500 shrink-0">To</span>
          <select value={yearTo || maxYear} onChange={e => onYearTo(Number(e.target.value))}
            className="text-[10px] border border-gray-200 rounded px-1.5 py-0.5 flex-1 bg-white text-gray-700 focus:outline-none focus:border-blue-300">
            {Array.from({ length: maxYear - minYear + 1 }, (_, i) => minYear + i).map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          {(yearFrom > 0 || yearTo > 0) && (
            <button onClick={() => { onYearFrom(0); onYearTo(0); }} className="text-[10px] text-blue-500 shrink-0 hover:text-blue-700">clear</button>
          )}
        </div>
      </div>

      {/* Open Access toggle */}
      <div className="px-4 py-3">
        <label className="flex items-center gap-3 cursor-pointer">
          <div className={`relative w-9 h-5 rounded-full transition-colors ${oaOnly ? 'bg-green-500' : 'bg-gray-200'}`}
            onClick={() => onOaOnly(!oaOnly)}>
            <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${oaOnly ? 'translate-x-4' : 'translate-x-0'}`} />
          </div>
          <div>
            <span className="text-xs font-medium text-gray-700">Open Access only</span>
            <span className="block text-[10px] text-gray-400">Filter to freely available papers</span>
          </div>
          {oaOnly && <span className="ml-auto text-[10px] bg-green-50 text-green-700 px-1.5 py-0.5 rounded-full border border-green-100">🔓 OA</span>}
        </label>
      </div>

      {/* Country / Location filter */}
      <div className="px-4 py-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Location / Country</p>
            {activeCountries.size > 0 && (
              <p className="text-[10px] text-blue-600">{activeCountries.size} selected</p>
            )}
          </div>
          {activeCountries.size > 0 && (
            <button onClick={() => [...activeCountries].forEach(onToggleCountry)} className="text-[10px] text-blue-500 hover:text-blue-700">clear all</button>
          )}
        </div>
        <div className="relative mb-2">
          <svg className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input type="text" value={countrySearch} onChange={e => onCountrySearch(e.target.value)}
            placeholder="Search countries…"
            className="w-full text-[10px] border border-gray-200 rounded-lg pl-7 pr-2 py-1.5 bg-gray-50 text-gray-700 placeholder-gray-400 focus:outline-none focus:border-blue-300" />
        </div>
        <div className="max-h-44 overflow-y-auto space-y-0.5 pr-1">
          {visibleCountries.slice(0, 50).map(([country, count]) => (
            <label key={country} className="flex items-center gap-2 py-0.5 px-1 cursor-pointer hover:bg-gray-50 rounded">
              <input type="checkbox" checked={activeCountries.has(country)}
                onChange={() => onToggleCountry(country)}
                className="w-3 h-3 rounded border-gray-300 text-blue-600 focus:ring-blue-400 shrink-0" />
              <span className="text-[10px] text-gray-700 flex-1 truncate">{country}</span>
              <div className="flex items-center gap-1 shrink-0">
                <div className="w-10 h-1 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-400 rounded-full" style={{ width: `${(count / (countryCounts[0]?.[1] || 1)) * 100}%` }} />
                </div>
                <span className="text-[10px] text-gray-400 w-6 text-right">{count}</span>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Co-Author filter */}
      <div className="px-4 py-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Co-Authors</p>
            <p className="text-[10px] text-gray-400">Authors with ≥2 papers in corpus</p>
          </div>
          {activeAuthors.size > 0 && (
            <button onClick={() => [...activeAuthors].forEach(onToggleAuthor)} className="text-[10px] text-blue-500 hover:text-blue-700">clear {activeAuthors.size}</button>
          )}
        </div>
        <div className="relative mb-2">
          <svg className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input type="text" value={authorSearch} onChange={e => onAuthorSearch(e.target.value)}
            placeholder="Search authors…"
            className="w-full text-[10px] border border-gray-200 rounded-lg pl-7 pr-2 py-1.5 bg-gray-50 text-gray-700 placeholder-gray-400 focus:outline-none focus:border-blue-300" />
        </div>
        <div className="max-h-48 overflow-y-auto space-y-0.5 pr-1">
          {visibleAuthors.slice(0, 60).map(([author, count]) => (
            <label key={author} className="flex items-center gap-2 py-0.5 px-1 cursor-pointer hover:bg-gray-50 rounded">
              <input type="checkbox" checked={activeAuthors.has(author)}
                onChange={() => onToggleAuthor(author)}
                className="w-3 h-3 rounded border-gray-300 text-blue-600 focus:ring-blue-400 shrink-0" />
              <span className="text-[10px] text-gray-700 flex-1 truncate">{author}</span>
              <div className="flex items-center gap-1 shrink-0">
                <div className="w-10 h-1 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-violet-400 rounded-full" style={{ width: `${Math.min((count / (authorCounts[0]?.[1] || 1)) * 100, 100)}%` }} />
                </div>
                <span className="text-[10px] text-gray-400 w-4 text-right">{count}</span>
              </div>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Detail Panel ──────────────────────────────────────────────────────────────
function DetailPanel({ paper, allPapers, onClose, getColor, colorMode, clusterLabel, onKeyword, onSelectPaper, embedModel }: {
  paper: AtlasPaper;
  allPapers: AtlasPaper[];
  onClose: () => void;
  getColor: (p: AtlasPaper) => string;
  colorMode: 'domain' | 'cluster';
  clusterLabel: Record<number, string>;
  onKeyword: (k: string) => void;
  onSelectPaper: (p: AtlasPaper) => void;
  embedModel: EmbedModel;
}) {
  const dpx = (p: AtlasPaper) => (p[`umap_x_${embedModel}` as keyof AtlasPaper] ?? p.umap_x) as number;
  const dpy = (p: AtlasPaper) => (p[`umap_y_${embedModel}` as keyof AtlasPaper] ?? p.umap_y) as number;
  const label = colorMode === 'domain'
    ? paper.domain.replace('Graph-Based ', 'Graph ')
    : (clusterLabel[paper.cluster] || `Cluster ${paper.cluster}`);

  const authorList = paper.authors
    ? paper.authors.split(';').map(a => a.trim()).filter(Boolean)
    : [];

  const coAuthorStats = React.useMemo(() =>
    authorList.map(author => {
      const authorPapers = allPapers.filter(p =>
        p.authors && p.authors.split(';').some(a => a.trim() === author)
      );
      const uniqueDomains = [...new Set(authorPapers.map(p => p.domain))];
      const uniqueRegions = [...new Set(
        authorPapers.flatMap(p => (p.author_regions || '').split(';').map(r => r.trim()).filter(Boolean))
      )];
      return { author, count: authorPapers.length, domains: uniqueDomains, regions: uniqueRegions };
    }).sort((a, b) => b.count - a.count),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [paper.SN]);

  const maxAuthorCount = Math.max(...coAuthorStats.map(a => a.count), 1);

  const citationPercentile = React.useMemo(() => {
    if (!paper.cited_by_count) return null;
    const sorted = [...allPapers].map(p => p.cited_by_count).sort((a, b) => a - b);
    const idx = sorted.findIndex(c => c >= paper.cited_by_count);
    return Math.round((idx / sorted.length) * 100);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paper.SN, paper.cited_by_count]);

  const related = React.useMemo(() =>
    allPapers
      .filter(p => p.SN !== paper.SN)
      .map(p => ({ p, dist: Math.hypot(dpx(p) - dpx(paper), dpy(p) - dpy(paper)) }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 6),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [paper.SN]);

  const clusterPapers = allPapers.filter(p => p.cluster === paper.cluster && p.cluster >= 0);
  const clusterDomains = Object.entries(
    clusterPapers.reduce((acc, p) => { acc[p.domain] = (acc[p.domain] || 0) + 1; return acc; }, {} as Record<string, number>)
  ).sort((a, b) => b[1] - a[1]);

  return (
    <div className="divide-y divide-gray-100">

      {/* Header */}
      <div className="sticky top-0 bg-white z-10 px-4 pt-4 pb-3 border-b border-gray-100">
        <div className="flex items-start justify-between mb-2">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Paper Detail</span>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors shrink-0 ml-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="flex flex-wrap gap-1 mb-2">
          <span className="font-mono text-[10px] text-gray-400">#{String(paper.SN).padStart(4, '0')}</span>
          <span className="px-2 py-0.5 text-[10px] rounded-full font-semibold"
            style={{ background: getColor(paper) + '20', color: getColor(paper) }}>{label}</span>
          {paper.is_oa === 'True'
            ? <span className="px-2 py-0.5 text-[10px] rounded-full bg-green-50 text-green-700 font-medium">🔓 {paper.oa_status || 'OA'}</span>
            : <span className="px-2 py-0.5 text-[10px] rounded-full bg-gray-100 text-gray-500">🔒 Closed</span>
          }
        </div>
        <h3 className="text-sm font-bold text-gray-900 leading-snug">{paper.title}</h3>
      </div>

      {/* Stats bar */}
      <div className="px-4 py-3 bg-slate-50 flex items-stretch gap-4 text-center">
        <Stat label="Year" value={String(paper.year)} />
        {paper.cited_by_count > 0 && <Stat label="Citations" value={String(paper.cited_by_count)} color="text-blue-700" />}
        {authorList.length > 0 && <Stat label="Authors" value={String(authorList.length)} />}
        {citationPercentile !== null && (
          <div className="flex-1 text-left">
            <div className="text-[10px] text-gray-400 mb-1">Citation percentile</div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${citationPercentile}%` }} />
            </div>
            <div className="text-[10px] text-gray-500 mt-1">Top {100 - citationPercentile}% of corpus</div>
          </div>
        )}
      </div>

      {/* Abstract */}
      <div className="px-4 py-4">
        <Section>Abstract</Section>
        {paper.abstract
          ? <p className="text-xs text-gray-600 leading-relaxed">{paper.abstract}</p>
          : <p className="text-xs text-gray-400 italic">Abstract not available for this paper in our corpus.</p>
        }
      </div>

      {/* Co-Author Analysis */}
      {coAuthorStats.length > 0 && (
        <div className="px-4 py-4">
          <Section>Co-Author Analysis <span className="text-gray-300 font-normal">— click name to filter</span></Section>
          <div className="space-y-3">
            {coAuthorStats.map(({ author, count, domains, regions }) => (
              <div key={author} className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <button onClick={() => onKeyword(author)}
                    className="text-xs font-semibold text-blue-700 hover:underline hover:text-blue-900 text-left leading-tight">
                    {author}
                  </button>
                  <div className="text-[10px] text-gray-400 mt-0.5">
                    {count} paper{count !== 1 ? 's' : ''} in corpus
                    {regions.length > 0 && <> · {regions.slice(0, 2).join(', ')}</>}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {domains.slice(0, 3).map(d => (
                      <span key={d} className="px-1.5 py-0.5 text-[9px] rounded-full font-medium"
                        style={{ background: domainColor(d) + '18', color: domainColor(d) }}>
                        {d.replace('Graph-Based ', '').replace(' & Bias Mitigation', '')}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="shrink-0 text-right pt-0.5">
                  <span className="text-xs font-bold text-gray-600">{count}</span>
                  <div className="w-14 h-1.5 bg-gray-100 rounded-full mt-1.5">
                    <div className="h-full bg-blue-400 rounded-full" style={{ width: `${(count / maxAuthorCount) * 100}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Geography */}
      {(paper.openalex_countries || paper.author_regions) && (
        <div className="px-4 py-4">
          <Section>Geography</Section>
          <div className="space-y-1.5 text-xs">
            {paper.openalex_countries && (
              <div>
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Countries </span>
                <span className="text-gray-700">{[...new Set(paper.openalex_countries.split(';').map(c => c.trim()).filter(Boolean))].join(' · ')}</span>
              </div>
            )}
            {paper.author_regions && (
              <div>
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Regions </span>
                <span className="text-gray-700">{[...new Set(paper.author_regions.split(';').map(r => r.trim()).filter(Boolean))].join(' · ')}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Keywords */}
      {paper.keywords && (
        <div className="px-4 py-4">
          <Section>Keywords <span className="text-gray-300 font-normal">— click to search</span></Section>
          <div className="flex flex-wrap gap-1">
            {paper.keywords.split(';').filter(Boolean).slice(0, 12).map(k => (
              <button key={k.trim()} onClick={() => onKeyword(k.trim())}
                className="px-2 py-0.5 text-[10px] bg-blue-50 text-blue-700 border border-blue-100 rounded-full hover:bg-blue-100 transition-colors">
                {k.trim()}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Cluster context */}
      {paper.cluster >= 0 && clusterPapers.length > 0 && (
        <div className="px-4 py-4">
          <Section>Cluster: {clusterLabel[paper.cluster] || `#${paper.cluster}`}</Section>
          <p className="text-[10px] text-gray-400 mb-2">{clusterPapers.length} papers share this semantic cluster</p>
          <div className="space-y-1.5">
            {clusterDomains.map(([d, n]) => (
              <div key={d} className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: domainColor(d) }} />
                <span className="text-[10px] text-gray-600 flex-1 truncate">{d.replace('Graph-Based ', 'Graph ')}</span>
                <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${(n / clusterPapers.length) * 100}%`, background: domainColor(d) }} />
                </div>
                <span className="text-[10px] text-gray-400 w-5 text-right shrink-0">{n}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Related papers */}
      {related.length > 0 && (
        <div className="px-4 py-4">
          <Section>Semantically Related <span className="text-gray-300 font-normal">— nearest in UMAP</span></Section>
          <ul className="space-y-2.5">
            {related.map(({ p, dist }) => (
              <li key={p.SN}>
                <button onClick={() => onSelectPaper(p)} className="text-left w-full group">
                  <div className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: domainColor(p.domain) }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-700 group-hover:text-blue-700 leading-snug line-clamp-2 transition-colors font-medium">{p.title}</p>
                      <div className="flex items-center gap-2 mt-0.5 text-[10px] text-gray-400">
                        <span>{p.year}</span>
                        {p.cited_by_count > 0 && <span>· {p.cited_by_count} cit.</span>}
                        <span className="ml-auto text-gray-200">Δ{dist.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* DOI */}
      {paper.DOI && (
        <div className="px-4 py-4">
          <a href={`https://doi.org/${paper.DOI.replace(/^(https?:\/\/doi\.org\/|doi\.org\/)/, '')}`}
            target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-semibold transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
            Open full paper ↗
          </a>
        </div>
      )}
    </div>
  );
}

function Section({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-2.5">{children}</p>;
}

function Stat({ label, value, color = 'text-gray-800' }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div className={`text-xl font-bold ${color}`}>{value}</div>
      <div className="text-[10px] text-gray-400">{label}</div>
    </div>
  );
}
