"use client";

import Link from "next/link";
import { List, Archive } from "lucide-react";
import { ModelFilterDropdown } from "@/components/model-filter-dropdown";

interface IdeasToolbarProps {
  activeTab: "all" | "archived";
  activeModel: string;
}

export function IdeasToolbar({ activeTab, activeModel }: IdeasToolbarProps) {
  return (
    <>
      {/* Tabs */}
      <div className="mb-4 flex gap-1 rounded-xl border border-slate-800 bg-slate-900/50 p-1">
        <TabLink
          href={activeModel ? `/ideas?model=${activeModel}` : "/ideas"}
          active={activeTab === "all"}
          icon={<List className="size-4" />}
          label="Todas"
        />
        <TabLink
          href={activeModel ? `/ideas?tab=archived&model=${activeModel}` : "/ideas?tab=archived"}
          active={activeTab === "archived"}
          icon={<Archive className="size-4" />}
          label="Archivadas"
        />
      </div>

      {/* Model filter dropdown */}
      <div className="mb-6">
        <ModelFilterDropdown activeModel={activeModel} activeTab={activeTab} />
      </div>
    </>
  );
}

function TabLink({
  href,
  active,
  icon,
  label,
}: {
  href: string;
  active: boolean;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      className={`flex-1 flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
        active
          ? "bg-slate-800 text-white shadow-sm"
          : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
      }`}
    >
      {icon}
      {label}
    </Link>
  );
}
