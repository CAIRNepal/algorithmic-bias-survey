import React, { useState } from 'react';
import Image from 'next/image';

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || '';

const AppHeader: React.FC = () => {
  const [showResearchDropdown, setShowResearchDropdown] = useState(false);

  return (
    <div className="w-full bg-white border-b shadow-sm flex items-center justify-between px-8 py-3 z-50 relative">
      {/* Left: Logo + Title + Subtitle */}
      <div className="flex items-center gap-4">
        <Image src={`${BASE_PATH}/logo-slogan.png`} alt="CAIR-NEPAL Logo" width={48} height={48} className="object-contain" unoptimized />
        <div>
          <div className="text-2xl font-bold text-blue-800 leading-tight tracking-wider">Bias Atlas</div>
          <div className="text-xs text-gray-500">Empowering Fairness & Transparency in AI Research</div>
        </div>
      </div>
      {/* Main Nav */}
      <nav className="flex items-center gap-1 text-blue-700 font-medium">
        <a href={`${BASE_PATH}/`} className="px-3 py-2 text-sm hover:text-blue-900 transition rounded hover:bg-blue-50">Home</a>
        <a href={`${BASE_PATH}/advanced`} className="px-3 py-2 text-sm hover:text-blue-900 transition rounded hover:bg-blue-50">Advanced Analytics</a>

        {/* Atlas — highlighted link */}
        <a href={`${BASE_PATH}/atlas`}
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded hover:bg-violet-50 hover:text-violet-700 transition text-violet-600">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-60" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500" />
          </span>
          Atlas
        </a>

        <a href="https://cair-nepal.org" target="_blank" rel="noopener noreferrer"
          className="ml-1 px-4 py-2 text-sm rounded bg-blue-600 text-white font-semibold shadow hover:bg-blue-700 transition">
          CAIR-Nepal ↗
        </a>
      </nav>
    </div>
  );
};

export default AppHeader; 
