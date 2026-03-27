import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "BZA. Shipment Portal",
  description: "Track your shipments with BZA International Services",
  manifest: "/manifest-portal.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "BZA. Portal",
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0d3d3b",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return children;
}
