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
          <div className="text-2xl font-bold text-blue-800 leading-tight tracking-wider">Bias Research Dashboard</div>
          <div className="text-xs text-gray-500">Empowering Fairness & Transparency in AI Research</div>
        </div>
      </div>
      {/* Main Nav */}
      <nav className="flex items-center gap-2 text-blue-700 font-medium text-lg">
        <a href="#" className="px-3 py-2 hover:text-blue-900 transition">Home</a>
        <div className="relative">
          <button
            className={`px-3 py-2 flex items-center gap-1 hover:text-blue-900 transition`}
            onMouseEnter={() => setShowResearchDropdown(true)}
            onMouseLeave={() => setShowResearchDropdown(false)}
            onFocus={() => setShowResearchDropdown(true)}
            onBlur={() => setShowResearchDropdown(false)}
            type="button"
          >
            Research <span className="ml-1">▼</span>
          </button>
          {showResearchDropdown && (
            <div className="absolute left-0 mt-2 bg-white border rounded shadow-lg min-w-[220px] z-50" onMouseEnter={() => setShowResearchDropdown(true)} onMouseLeave={() => setShowResearchDropdown(false)}>
              <a href="#" className="block px-4 py-2 hover:bg-blue-50">Projects</a>
              <a href="#" className="block px-4 py-2 hover:bg-blue-50">Publications</a>
              <div className="border-t my-1" />
              {/* Analytics submenu here */}
              <div className="px-4 py-2 font-semibold text-blue-800">Bias Research Dashboard</div>
              <div className="pl-4 pb-2">
                {/* Analytics submenu content */}
              </div>
            </div>
          )}
        </div>
        <a href="#" className="ml-2 px-5 py-2 rounded bg-blue-600 text-white font-semibold shadow hover:bg-blue-700 transition">Donate</a>
      </nav>
    </div>
  );
};

export default AppHeader; 