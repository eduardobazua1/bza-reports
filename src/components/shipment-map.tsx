"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";

type LocationData = { name: string; tons: number; shipments: number };

// Known locations
const LOCATIONS: Record<string, { lat: number; lng: number; type: "origin" | "border" | "port" | "destination" }> = {
  "El Paso": { lat: 31.76, lng: -106.44, type: "border" },
  "Laredo": { lat: 27.50, lng: -99.50, type: "border" },
  "Eagle Pass": { lat: 28.71, lng: -100.50, type: "border" },
  "Manzanillo": { lat: 19.05, lng: -104.33, type: "port" },
  "Veracruz": { lat: 19.18, lng: -96.13, type: "port" },
  "Chihuahua": { lat: 28.63, lng: -106.09, type: "destination" },
};

// Each location gets its own color
const locationColors: Record<string, string> = {
  "Laredo": "#3b82f6",
  "Eagle Pass": "#f59e0b",
  "El Paso": "#8b5cf6",
  "Manzanillo": "#22c55e",
  "Veracruz": "#ef4444",
  "Chihuahua": "#ec4899",
};

// Dynamic import to avoid SSR issues with Leaflet
const MapInner = dynamic(() => import("./map-inner"), { ssr: false, loading: () => (
  <div className="h-[400px] bg-muted rounded-lg flex items-center justify-center text-muted-foreground">Loading map...</div>
)});

export function ShipmentMap({ locationData }: { locationData: Record<string, LocationData> }) {
  const markers = Object.entries(LOCATIONS).map(([name, loc]) => {
    const data = locationData[name];
    const color = locationColors[name] || "#94a3b8";
    return { name, ...loc, color, size: 10, tons: data?.tons || 0, shipments: data?.shipments || 0 };
  });

  const activeMarkers = markers.filter((m) => m.tons > 0);

  return (
    <div className="bg-white rounded-md shadow-sm overflow-hidden">
      <div className="p-4 border-b border-border">
        <h3 className="text-sm font-semibold">Shipment Map — By Destination</h3>
        <div className="flex gap-4 mt-2 flex-wrap">
          {activeMarkers.map((m) => (
            <div key={m.name} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full" style={{ background: m.color }} />
              <span className="text-xs text-muted-foreground">{m.name}</span>
            </div>
          ))}
        </div>
      </div>
      <MapInner markers={activeMarkers} />
      {/* Stats below map */}
      <div className="p-4 border-t border-border">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {Object.entries(locationData)
            .filter(([, d]) => d.tons > 0)
            .sort(([, a], [, b]) => b.tons - a.tons)
            .map(([name, data]) => (
              <Link key={name} href={`/invoices?destination=${encodeURIComponent(name)}`} className="text-center p-2 rounded-md hover:shadow-md transition-shadow cursor-pointer block" style={{ background: `${locationColors[name] || "#94a3b8"}10`, borderLeft: `3px solid ${locationColors[name] || "#94a3b8"}` }}>
                <p className="text-xs font-medium text-stone-700">{name}</p>
                <p className="text-sm font-bold text-stone-900">{Math.round(data.tons).toLocaleString()} TN</p>
                <p className="text-xs text-stone-400">{data.shipments} shipments</p>
              </Link>
            ))}
        </div>
      </div>
    </div>
  );
}
