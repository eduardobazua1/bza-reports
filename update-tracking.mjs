import { createClient } from "@libsql/client";

const db = createClient({
  url: "libsql://bza-reports-eduardobazua1.aws-us-east-1.turso.io",
  authToken: "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzQ1NjUzMTYsImlkIjoiMDE5ZDJjNTQtYTkwMS03YjAyLTlkMDUtNzBiY2Y1ZWMyOTFmIiwicmlkIjoiMjYwZGQ4ZTktN2MyZC00YzJjLWIwNjItMDVhMzc0MDRjZTI2In0.vcdw49G9p8CixQOwZwMptY57ajkP9NqjAIW0uyzOCBakdNvktjmw6uFP1mzKT73XLNDlICsk-opllcDGOOu3Ag"
});

const now = new Date().toISOString();

const updates = [
  { vehicleId: "TBOX 636255", location: "SWEETWATE, TX", eta: "2026-04-02", status: "en_transito" },
  { vehicleId: "TBOX 630499", location: "GOFFS, CA",     eta: "2026-04-05", status: "en_transito" },
  { vehicleId: "TBOX 640123", location: "FRESNO, CA",    eta: "2026-04-08", status: "en_transito" },
  { vehicleId: "TBOX 671178", location: "FRESNO, CA",    eta: "2026-04-08", status: "en_transito" },
  { vehicleId: "TBOX 673258", location: "FRESNO, CA",    eta: "2026-04-08", status: "en_transito" },
  { vehicleId: "TBOX 640169", location: "FRESNO, CA",    eta: "2026-04-07", status: "en_transito" },
  { vehicleId: "TBOX 640378", location: "RIO ESCON, CU", eta: null,         status: "en_transito" },
];

for (const u of updates) {
  const noSpace = u.vehicleId.replace(/\s+/g, "");
  const found = await db.execute({
    sql: `SELECT id, invoice_number, vehicle_id FROM invoices WHERE vehicle_id = ? OR REPLACE(vehicle_id,' ','') = ?`,
    args: [u.vehicleId, noSpace],
  });

  if (found.rows.length === 0) {
    console.log("NOT FOUND: " + u.vehicleId);
    continue;
  }

  const inv = found.rows[0];
  await db.execute({
    sql: `UPDATE invoices SET current_location=?, shipment_status=?, estimated_arrival=?, last_location_update=?, updated_at=? WHERE id=?`,
    args: [u.location, u.status, u.eta ?? null, now, now, inv.id],
  });
  console.log("OK: " + inv.invoice_number + " (" + inv.vehicle_id + ") -> " + u.location + " ETA:" + (u.eta ?? "-"));
}

console.log("Done.");
