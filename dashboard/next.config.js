/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === "production";
const nextConfig = {
  output: "export",
  basePath: isProd ? "/algorithmic-bias-survey" : "",
  assetPrefix: isProd ? "/algorithmic-bias-survey" : "",
  eslint: {
    ignoreDuringBuilds: true,
  },
};
module.exports = nextConfig;
