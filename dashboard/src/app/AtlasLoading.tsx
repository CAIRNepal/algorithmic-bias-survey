'use client';
export default function AtlasLoading() {
  const base = process.env.NEXT_PUBLIC_BASE_PATH || '';

  const domains = [
    { label: 'Health & Clinical AI',           color: '#e63946' },
    { label: 'General Fairness & Bias',         color: '#2563eb' },
    { label: 'Graph-Based Fairness',            color: '#059669' },
    { label: 'LLMs & NLP',                      color: '#d97706' },
    { label: 'Recommender Systems',             color: '#7c3aed' },
  ];

  return (
    <div
      className="flex flex-col items-center justify-center bg-gradient-to-b from-white via-slate-50 to-white"
      style={{ height: 'calc(100vh - 72px)' }}
    >
      <div className="flex flex-col items-center gap-7 max-w-sm w-full text-center px-8">

        {/* Logo */}
        <img
          src={`${base}/logo-slogan.png`}
          alt="CAIR-Nepal"
          className="h-14 object-contain select-none"
          draggable={false}
        />

        {/* Concentric spinner rings */}
        <div className="relative w-20 h-20">
          {/* Outer track */}
          <div className="absolute inset-0 rounded-full border-4 border-blue-100" />
          {/* Outer spinner */}
          <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-blue-600 animate-spin"
               style={{ animationDuration: '1s' }} />
          {/* Inner track */}
          <div className="absolute inset-3 rounded-full border-2 border-violet-100" />
          {/* Inner spinner (reverse) */}
          <div className="absolute inset-3 rounded-full border-2 border-transparent border-t-violet-500 animate-spin"
               style={{ animationDuration: '0.7s', animationDirection: 'reverse' }} />
          {/* Centre dot */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse" />
          </div>
        </div>

        {/* Title + subtitle */}
        <div className="space-y-1.5">
          <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">
            Bias Research Atlas
          </h2>
          <p className="text-sm text-gray-500 leading-relaxed">
            Generating semantic UMAP of{' '}
            <span className="font-semibold text-blue-600">703 papers</span>{' '}
            on algorithmic bias &amp; fairness…
          </p>
        </div>

        {/* Animated progress bar */}
        <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 via-violet-500 to-blue-500 rounded-full"
            style={{
              backgroundSize: '200% 100%',
              animation: 'shimmer 1.5s infinite linear',
              width: '60%',
            }}
          />
        </div>

        {/* Domain pills */}
        <div className="flex flex-wrap justify-center gap-1.5">
          {domains.map(({ label, color }) => (
            <span
              key={label}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium border border-gray-100 text-gray-500 bg-white shadow-sm"
            >
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
              {label}
            </span>
          ))}
        </div>

        {/* Tech footnote */}
        <p className="text-[10px] text-gray-300 tracking-wide">
          all-MiniLM-L6-v2 · UMAP · HDBSCAN
        </p>
      </div>

      {/* Shimmer keyframe */}
      <style>{`
        @keyframes shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}
