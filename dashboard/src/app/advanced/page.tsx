"use client";
import dynamic from "next/dynamic";

const BiasResearchDashboard = dynamic(() => import('../BiasResearchDashboard'), {
  ssr: false,
  loading: () => (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
      <p className="text-gray-500 font-medium">Loading research analytics…</p>
    </div>
  ),
});

export default function AnalyticsPage() {
  return <BiasResearchDashboard />;
}
