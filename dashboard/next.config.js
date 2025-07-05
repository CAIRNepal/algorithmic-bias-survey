/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production';

const nextConfig = {
  output: 'export',  // <--- Add this line
  basePath: isProd ? '/algorithmic-bias-survey' : '',
  assetPrefix: isProd ? '/algorithmic-bias-survey' : '',
};

module.exports = nextConfig; 
