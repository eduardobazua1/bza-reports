"use client";

import { MapContainer, TileLayer, CircleMarker, Popup, Polyline } from "react-leaflet";
import "leaflet/dist/leaflet.css";

type MarkerData = {
  name: string;
  lat: number;
  lng: number;
  type: string;
  color: string;
  size: number;
  tons: number;
  shipments: number;
};

const routes: { from: number[]; to: number[] }[] = [];

export default function MapInner({ markers }: { markers: MarkerData[] }) {
  return (
    <MapContainer
      center={[25, -101]}
      zoom={5}
      minZoom={4}
      maxZoom={12}
      style={{ height: "400px", width: "100%" }}
      scrollWheelZoom={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://carto.com">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
      />

      {/* Route lines */}
      {routes.map((route, i) => (
        <Polyline
          key={i}
          positions={[route.from as [number, number], route.to as [number, number]]}
          pathOptions={{ color: "#f59e0b", weight: 2, dashArray: "8 4", opacity: 0.5 }}
        />
      ))}

      {/* Markers */}
      {markers.map((m) => (
        <CircleMarker
          key={m.name}
          center={[m.lat, m.lng]}
          radius={m.tons > 5000 ? 14 : m.tons > 1000 ? 10 : m.type === "origin" ? 10 : 7}
          pathOptions={{ color: "#fff", weight: 2, fillColor: m.color, fillOpacity: 0.9 }}
        >
          <Popup>
            <div style={{ minWidth: 120 }}>
              <strong>{m.name}</strong>
              {m.tons > 0 && (
                <>
                  <br />{Math.round(m.tons).toLocaleString()} TN
                  <br />{m.shipments} shipments
                </>
              )}
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
