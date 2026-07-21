import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { AnalyticsSummary } from "@/lib/analytics";

export interface ExportMeta {
  /** Who the report is for, shown in the header. */
  name: string;
  /** Human date the report was generated (e.g. "July 21, 2026"). */
  generatedOn: string;
  /** First and last logged dates covered, if any. */
  rangeStart?: string | null;
  rangeEnd?: string | null;
}

const fmt = (v: number | null, suffix = ""): string => (v === null ? "—" : `${v}${suffix}`);

const trendLabel = (t: "up" | "down" | null): string => (t === "up" ? "↑ up" : t === "down" ? "↓ down/same" : "—");

/** The high-level "summary card" rows, shared by the CSV and PDF exports. */
function summaryRows(a: AnalyticsSummary): [string, string][] {
  const rows: [string, string][] = [
    ["Days logged", `${a.daysLogged} of ${a.totalDays}`],
    ["Weeks tracked", String(a.weeks)],
    ["Star weeks", `${a.starWeeks} of ${a.weeks}`],
  ];
  if (a.weight) {
    const dir = a.weight.change === 0 ? "" : a.weight.change < 0 ? " (down)" : " (up)";
    rows.push(
      ["Starting weight", `${a.weight.start} kg`],
      ["Latest weight", `${a.weight.latest} kg`],
      ["Net weight change", `${a.weight.change > 0 ? "+" : ""}${a.weight.change} kg${dir}`],
      ["Lowest / highest", `${a.weight.min} / ${a.weight.max} kg`],
    );
  }
  rows.push(
    ["Avg calories / day", fmt(a.averages.calories, " kcal")],
    ["Avg protein / day", fmt(a.averages.protein, " g")],
    ["Avg water / day", fmt(a.averages.water, " glasses")],
    ["Avg steps / day", fmt(a.averages.steps)],
  );
  return rows;
}

const WEEKLY_HEAD = ["Week", "Weight (kg)", "Trend", "Cal", "Prot (g)", "Water", "Steps", "Exercise", "Star"];

function weeklyBody(a: AnalyticsSummary): string[][] {
  return a.weekly.map((w) => [
    `Wk ${w.week}`,
    fmt(w.weight),
    trendLabel(w.weightTrend),
    fmt(w.calories),
    fmt(w.protein),
    fmt(w.water),
    fmt(w.steps),
    `${w.exerciseDays}/${w.totalDays}`,
    w.star ? "★" : "—",
  ]);
}

// ---------------------------------------------------------------------------
// Downloads
// ---------------------------------------------------------------------------

function slugify(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "report";
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** Wrap a CSV field, quoting/escaping only when it contains a comma, quote or newline. */
function csvField(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function exportAnalyticsCsv(a: AnalyticsSummary, meta: ExportMeta): void {
  const lines: string[] = [];
  const row = (cells: string[]) => lines.push(cells.map(csvField).join(","));

  row(["OHDTGM Progress Report"]);
  row(["Name", meta.name]);
  row(["Generated", meta.generatedOn]);
  if (meta.rangeStart && meta.rangeEnd) row(["Date range", `${meta.rangeStart} to ${meta.rangeEnd}`]);
  lines.push("");

  row(["Summary"]);
  for (const [label, value] of summaryRows(a)) row([label, value]);
  lines.push("");

  row(["Weekly breakdown"]);
  row(WEEKLY_HEAD);
  for (const cells of weeklyBody(a)) row(cells);

  const blob = new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  triggerDownload(blob, `${slugify(meta.name)}-progress-${meta.generatedOn.replace(/[^0-9a-z]+/gi, "-")}.csv`);
}

export function exportAnalyticsPdf(a: AnalyticsSummary, meta: ExportMeta): void {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const marginX = 40;
  let y = 48;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("OHDTGM Progress Report", marginX, y);

  y += 20;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90);
  doc.text(`Prepared for ${meta.name}`, marginX, y);
  y += 14;
  doc.text(`Generated ${meta.generatedOn}`, marginX, y);
  if (meta.rangeStart && meta.rangeEnd) {
    y += 14;
    doc.text(`Covering ${meta.rangeStart} – ${meta.rangeEnd}`, marginX, y);
  }
  doc.setTextColor(0);

  // Summary as a two-column key/value table.
  autoTable(doc, {
    startY: y + 16,
    head: [["Summary", ""]],
    body: summaryRows(a),
    theme: "striped",
    headStyles: { fillColor: [122, 152, 60], halign: "left" },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 180 } },
    styles: { fontSize: 10, cellPadding: 5 },
    margin: { left: marginX, right: marginX },
  });

  // Weekly breakdown table, starting under the summary.
  const afterSummary = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 16;
  autoTable(doc, {
    startY: afterSummary + 24,
    head: [WEEKLY_HEAD],
    body: weeklyBody(a),
    theme: "grid",
    headStyles: { fillColor: [60, 120, 130] },
    styles: { fontSize: 9, cellPadding: 4, halign: "center" },
    columnStyles: { 0: { halign: "left", fontStyle: "bold" } },
    margin: { left: marginX, right: marginX },
  });

  doc.save(`${slugify(meta.name)}-progress-${meta.generatedOn.replace(/[^0-9a-z]+/gi, "-")}.pdf`);
}
