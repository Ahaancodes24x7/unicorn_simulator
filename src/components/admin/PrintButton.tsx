"use client";

import { Button } from "../ui";

import { Icon } from "@/components/Icon";
export function PrintButton() {
  return (
    <div className="no-print flex gap-2">
      <a href="/api/admin/export?type=leaderboard" className="inline-flex items-center rounded-lg border border-line-strong px-4 py-2 text-sm font-semibold hover:bg-white/5"><Icon name="download" className="mr-1.5" />CSV</a>
      <Button onClick={() => window.print()}>Print / Save as PDF</Button>
    </div>
  );
}
