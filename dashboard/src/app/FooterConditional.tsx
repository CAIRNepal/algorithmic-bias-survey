'use client';
import { usePathname } from 'next/navigation';

export default function FooterConditional({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Hide layout footer on Atlas page — it has its own footer
  if (pathname === '/' || pathname === '') return null;
  return <>{children}</>;
}
