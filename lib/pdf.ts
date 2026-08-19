import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { PlanResponse, Task } from "./types";
import type { DevPlanStatus } from "./store";

const STATUS_MARK: Record<DevPlanStatus, string> = {
  todo: "[ ]",
  working: "[~]",
  done: "[x]",
};

function statusOf(task: Task, statuses: Record<string, DevPlanStatus>): DevPlanStatus {
  return statuses[task.id ?? task.title] ?? "todo";
}

export function downloadPlanPdf(
  plan: PlanResponse,
  statuses: Record<string, DevPlanStatus>
): void {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(plan.projectTitle, margin, 18);

  if (plan.tagline) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text(plan.tagline, margin, 24);
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(30);
  const summaryLines = doc.splitTextToSize(plan.summary, pageW - margin * 2);
  doc.text(summaryLines, margin, 31);

  const meta = [
    `Mode: ${plan.mode}${plan.timeLimitHours ? `  |  Budget: ${plan.timeLimitHours} hr(s)` : ""}`,
  ];
  doc.setFontSize(9);
  doc.setTextColor(80);
  doc.text(meta, margin, 31 + summaryLines.length * 4 + 3);

  let y = 31 + summaryLines.length * 4 + 10;

  if (plan.mode === "hackathon" && plan.mustInclude.length) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(0, 128, 0);
    doc.text("Must Include", margin, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(30);
    y += 5;
    for (const m of plan.mustInclude) {
      const lines = doc.splitTextToSize(`• ${m.item} — ${m.why}`, pageW - margin * 2);
      doc.text(lines, margin, y);
      y += lines.length * 4 + 2;
    }
    if (plan.mustAvoid.length) {
      y += 3;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(200, 0, 0);
      doc.text("Must Avoid (time traps)", margin, y);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(30);
      y += 5;
      for (const m of plan.mustAvoid) {
        const lines = doc.splitTextToSize(`• ${m.trap} — ${m.why}`, pageW - margin * 2);
        doc.text(lines, margin, y);
        y += lines.length * 4 + 2;
      }
    }
    y += 4;
  }

  const body = plan.tasks.map((task, i) => [
    String(i + 1),
    STATUS_MARK[statusOf(task, statuses)],
    task.category,
    task.title,
    `${task.estimatedMinutes} min`,
  ]);

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["#", "Status", "Category", "Task", "Est"]],
    body,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [5, 8, 10], textColor: [60, 252, 143] },
    alternateRowStyles: { fillColor: [240, 244, 242] },
  });

  const slug = plan.projectTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  doc.save(`${slug}-devplan.pdf`);
}