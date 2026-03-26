import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3", "pdfkit", "pdf-parse"],
};

export default nextConfig;
