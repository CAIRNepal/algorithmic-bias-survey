import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === 'production';

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  basePath: isProd ? '/algorithmic-bias-survey' : '',
  assetPrefix: isProd ? '/algorithmic-bias-survey' : '',
};

export default nextConfig; 