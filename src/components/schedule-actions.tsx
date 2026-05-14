"use client";

import { useState, useTransition } from "react";
import { createScheduledReport, markScheduleSent, cancelSchedule, createTemplate, deleteTemplate, updateTemplate } from "@/server/schedule-actions";
import { useRouter } from "next/navigation";

type Template = { id: number; name: string; format: string; description: string | null; isSystem: boolean; columns: string };
type Client = { id: number; name: string; contactEmail: string | null };
type OverdueItem = { id: number; clientName: string; clientEmail: string; templateName: string; templateFormat: string; sendDate: string; notes: string | null; clientId: number; templateId: number };
type UpcomingItem = { id: number; clientName: string; templateName: string; sendDate: string; notes: string | null };
type SentItem = { id: number; clientName: string; templateName: string; sendDate: string; sentAt: string | null };

const availableColumns = [
  { key: "currentLocation", label: "Current Location" },
  { key: "lastLocationUpdate", label: "Last Update" },
  { key: "poNumber", label: "PO # (BZA)" },
  { key: "clientPoNumber", label: "Client PO #" },
  { key: "invoiceNumber", label: "Invoice #" },
  { key: "salesDocument", label: "Sales Document" },
  { key: "vehicleId", label: "Vehicle ID" },
  { key: "blNumber", label: "BL Number" },
  { key: "quantityTons", label: "Quantity (TN)" },
  { key: "sellPrice", label: "Price" },
  { key: "billingDocument", label: "Billing Doc." },
  { key: "item", label: "Product" },
  { key: "shipmentDate", label: "Ship Date" },
  { key: "shipmentStatus", label: "Status" },
  { key: "terms", label: "Terms" },
  { key: "transportType", label: "Transport Type" },
  { key: "licenseFsc", label: "License #" },
  { key: "chainOfCustody", label: "Chain of Custody" },
  { key: "inputClaim", label: "Input Claim" },
  { key: "outputClaim", label: "Output Claim" },
];

export function ScheduleActions({
  templates, clients, overdue, upcoming, sent,
}: {
  templates: Template[];
  clients: Client[];
  overdue: OverdueItem[];
  upcoming: UpcomingItem[];
  sent: SentItem[];
}) {
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [templateColumns, setTemplateColumns] = useState<Set<string>>(new Set());
  const [expandedTemplate, setExpandedTemplate] = useState<number | null>(null);
  const [editingTemplateId, setEditingTemplateId] = useState<number | null>(null);
  const [editCols, setEditCols] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const saveAsTemplate = fd.get("saveAsTemplate") === "on";
    const templateName = fd.get("templateName") as string;

    startTransition(async () => {
      // Save as template first if checked
      if (saveAsTemplate && templateName) {
        const selectedTemplate = templates.find((t) => t.id === Number(fd.get("templateId")));
        await createTemplate({
          name: templateName,
          description: (fd.get("templateDescription") as string) || undefined,
          format: (selectedTemplate?.format as "excel" | "portal-link") || "excel",
          columns: [],
          defaultReminderEmail: (fd.get("reminderEmail") as string) || undefined,
        });
      }

      await createScheduledReport({
        clientId: Number(fd.get("clientId")),
        templateId: Number(fd.get("templateId")),
        sendDate: fd.get("sendDate") as string,
        reminderEmail: (fd.get("reminderEmail") as string) || undefined,
        notes: (fd.get("notes") as string) || undefined,
      });
      setShowScheduleForm(false);
      router.refresh();
    });
  }

  function handleMarkSent(id: number) {
    startTransition(async () => {
      await markScheduleSent(id);
      router.refresh();
    });
  }

  function handleCancel(id: number) {
    startTransition(async () => {
      await cancelSchedule(id);
      router.refresh();
    });
  }

  function handleSendNow(item: OverdueItem) {
    window.location.href = `/clients/${item.clientId}/send-report`;
  }

  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="space-y-6">
      {/* Overdue alerts */}
      {overdue.length > 0 && (
        <div className="bg-[#0d3d3b] border border-[#0d3d3b] rounded-lg p-4">
          <h3 className="text-sm font-bold text-[#0d3d3b] mb-3">
            {overdue.length} report{overdue.length > 1 ? "s" : ""} pending to send
          </h3>
          <div className="space-y-2">
            {overdue.map((item) => (
              <div key={item.id} className="flex items-center justify-between bg-white rounded-lg p-3 border border-[#0d3d3b]">
                <div>
                  <p className="text-sm font-medium">{item.clientName}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.templateName} &middot; Scheduled: {item.sendDate}
                    {item.notes && <> &middot; {item.notes}</>}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSendNow(item)}
                    className="text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-lg hover:opacity-90"
                  >
                    Send Now
                  </button>
                  <button
                    onClick={() => handleMarkSent(item.id)}
                    disabled={isPending}
                    className="text-xs border border-border px-3 py-1.5 rounded-lg hover:bg-muted"
                  >
                    Mark as Sent
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action button */}
      {!showScheduleForm && (
        <button
          onClick={() => setShowScheduleForm(true)}
          className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90"
        >
          + Schedule Report
        </button>
      )}

      {/* Schedule form */}
      {showScheduleForm && (
        <div className="bg-white rounded-md shadow-sm p-4">
          <h3 className="font-semibold mb-4">Schedule Report</h3>
          <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Client *</label>
              <select name="clientId" required className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background">
                <option value="">Select...</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Template *</label>
              <select name="templateId" required className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background">
                <option value="">Select...</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name} ({t.format})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Send Date *</label>
              <input type="date" name="sendDate" required defaultValue={today} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Remind (email)</label>
              <input type="email" name="reminderEmail" placeholder="your-email@bza.com" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" />
              <p className="text-xs text-muted-foreground mt-1">Will receive a reminder when it's time to send</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Notes</label>
              <input type="text" name="notes" placeholder="E.g.: Weekly report, requested by Juan" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" />
            </div>

            {/* Save as template option */}
            <div className="sm:col-span-2 bg-muted/50 rounded-lg p-3 space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" name="saveAsTemplate" className="rounded" />
                <span className="text-sm font-medium">Save as template</span>
                <span className="text-xs text-muted-foreground">for future use</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 ml-6">
                <input type="text" name="templateName" placeholder="Template name (e.g.: KC Report)" className="border border-border rounded-lg px-3 py-2 text-sm bg-background" />
                <input type="text" name="templateDescription" placeholder="Description (optional)" className="border border-border rounded-lg px-3 py-2 text-sm bg-background" />
              </div>
            </div>

            <div className="sm:col-span-2 flex gap-2">
              <button type="submit" disabled={isPending} className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                {isPending ? "Saving..." : "Schedule"}
              </button>
              <button type="button" onClick={() => setShowScheduleForm(false)} className="border border-border px-4 py-2 rounded-lg text-sm hover:bg-muted">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <div className="bg-white rounded-md shadow-sm">
          <div className="p-4 border-b border-border">
            <h3 className="font-semibold">Upcoming</h3>
          </div>
          <div className="divide-y divide-border">
            {upcoming.map((item) => (
              <div key={item.id} className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{item.clientName}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.templateName} &middot; {item.sendDate}
                    {item.notes && <> &middot; {item.notes}</>}
                  </p>
                </div>
                <button
                  onClick={() => handleCancel(item.id)}
                  disabled={isPending}
                  className="text-xs text-destructive hover:underline"
                >
                  Cancel
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sent history */}
      {sent.length > 0 && (
        <div className="bg-white rounded-md shadow-sm">
          <div className="p-4 border-b border-border">
            <h3 className="font-semibold">Send History</h3>
          </div>
          <div className="divide-y divide-border">
            {sent.map((item) => (
              <div key={item.id} className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{item.clientName}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.templateName} &middot; Sent: {item.sentAt?.split("T")[0] || item.sendDate}
                  </p>
                </div>
                <span className="text-xs bg-stone-100 text-[#0d3d3b] px-2 py-1 rounded-full">Sent</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Templates */}
      <div className="bg-white rounded-md shadow-sm">
        <div className="p-4 border-b border-border">
          <h3 className="font-semibold">Templates</h3>
        </div>
        <div className="divide-y divide-border">
          {templates.map((t) => {
            const isOpen = expandedTemplate === t.id;
            const isEditing = editingTemplateId === t.id;
            const cols: string[] = (() => { try { return JSON.parse(t.columns); } catch { return []; } })();
            const colLabels = cols.map((key) => availableColumns.find((c) => c.key === key)?.label || key);

            return (
              <div key={t.id}>
                {/* Clickable header */}
                <div
                  className="p-4 flex items-center justify-between cursor-pointer hover:bg-muted/30"
                  onClick={() => {
                    if (isEditing) return;
                    setExpandedTemplate(isOpen ? null : t.id);
                    setEditingTemplateId(null);
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-xs">{isOpen ? "▼" : "▶"}</span>
                    <p className="text-sm font-medium">{t.name}</p>
                    <span className="text-xs bg-muted px-2 py-0.5 rounded">{t.format}</span>
                    {t.isSystem && <span className="text-xs text-muted-foreground">(default)</span>}
                  </div>
                  <span className="text-xs text-muted-foreground">{cols.length} columns</span>
                </div>

                {/* Detail view (read-only) */}
                {isOpen && !isEditing && (
                  <div className="px-4 pb-4 space-y-3">
                    {t.description && <p className="text-sm text-muted-foreground">{t.description}</p>}

                    {cols.length > 0 ? (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-2">Included columns:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {colLabels.map((label, i) => (
                            <span key={i} className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">{label}</span>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        {t.format === "portal-link" ? "Sends portal link to client (no attachment)" : "No columns defined"}
                      </p>
                    )}

                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={() => { setEditingTemplateId(t.id); setEditCols(new Set(cols)); }}
                        className="text-xs text-primary border border-primary/30 px-3 py-1.5 rounded-lg hover:bg-primary/5"
                      >
                        Edit
                      </button>
                      {!t.isSystem && (
                        <button
                          onClick={() => {
                            if (!confirm(`Delete template "${t.name}"?`)) return;
                            startTransition(async () => { await deleteTemplate(t.id); router.refresh(); });
                          }}
                          disabled={isPending}
                          className="text-xs text-destructive border border-destructive/30 px-3 py-1.5 rounded-lg hover:bg-destructive/5"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Edit form */}
                {isEditing && (
                  <div className="px-4 pb-4 space-y-3">
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const fd = new FormData(e.currentTarget);
                        startTransition(async () => {
                          await updateTemplate(t.id, {
                            name: fd.get("editName") as string,
                            description: (fd.get("editDescription") as string) || undefined,
                            columns: Array.from(editCols),
                          });
                          setEditingTemplateId(null);
                          setExpandedTemplate(t.id);
                          router.refresh();
                        });
                      }}
                      className="space-y-3"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium mb-1">Name</label>
                          <input name="editName" defaultValue={t.name} required className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1">Description</label>
                          <input name="editDescription" defaultValue={t.description || ""} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" />
                        </div>
                      </div>

                      {t.format !== "portal-link" && (
                        <div>
                          <label className="block text-xs font-medium mb-2">Columns ({editCols.size})</label>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-1">
                            {availableColumns.map((col) => (
                              <label key={col.key} className="flex items-center gap-1.5 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={editCols.has(col.key)}
                                  onChange={() => {
                                    const next = new Set(editCols);
                                    if (next.has(col.key)) next.delete(col.key);
                                    else next.add(col.key);
                                    setEditCols(next);
                                  }}
                                  className="rounded"
                                />
                                <span className="text-xs">{col.label}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex gap-2">
                        <button type="submit" disabled={isPending} className="bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50">
                          {isPending ? "Saving..." : "Save"}
                        </button>
                        <button type="button" onClick={() => { setEditingTemplateId(null); setExpandedTemplate(t.id); }} className="border border-border px-3 py-1.5 rounded-lg text-xs hover:bg-muted">
                          Cancel
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
