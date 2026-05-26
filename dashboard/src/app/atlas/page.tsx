'use client';
import dynamic from 'next/dynamic';
import AtlasLoading from '../AtlasLoading';

const AbstractAtlas = dynamic(() => import('../AbstractAtlas'), {
  ssr: false,
  loading: AtlasLoading,
});

export default function AtlasPage() {
  return <AbstractAtlas />;
}
