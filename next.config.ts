import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdfkit", "pdf-parse"],
  outputFileTracingIncludes: {
    "/api/reports/financial/pdf": ["./node_modules/pdfkit/js/data/**/*"],
    "/api/reports/financial/send": ["./node_modules/pdfkit/js/data/**/*"],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
