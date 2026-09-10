"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { GitCommitHorizontal, PanelLeft, User } from "lucide-react";
import { useWorkspaceStore } from "@/lib/store";
import { signOutAction } from "@/server/actions/auth";

const TABS = [
  { href: "/notes", label: "BUFFER", match: "/notes" },
  { href: "/tags", label: "TAGS", match: "/tags" },
  { href: "/graph", label: "GRAPH", match: "/graph" },
] as const;

export function TopNav({ email }: { email: string }) {
  const pathname = usePathname();
  const collapsed = useWorkspaceStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useWorkspaceStore((s) => s.toggleSidebar);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <header
      data-collapsed={collapsed}
      className="fixed top-0 left-sidebar-width right-0 h-14 bg-surface/90 border-b border-outline-variant/30 z-30 flex items-center justify-between px-space-6 backdrop-blur-sm transition-[left] duration-150 data-[collapsed=true]:left-0"
    >
      <div className="flex items-center gap-space-4">
        <button
          onClick={toggleSidebar}
          className="text-on-surface-variant hover:text-on-surface transition-colors -ml-space-2 p-space-1"
          title="Toggle sidebar [Ctrl+B]"
          aria-label="Toggle sidebar"
        >
          <PanelLeft size={16} strokeWidth={1.5} />
        </button>
        <nav className="flex items-center gap-space-4">
          {TABS.map((tab) => {
            const active = pathname.startsWith(tab.match);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`font-label-md text-label-md pb-space-px transition-colors border-b-2 ${
                  active
                    ? "text-on-surface border-primary"
                    : "text-on-surface-variant hover:text-on-surface border-transparent"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="flex items-center gap-space-3">
        <div className="flex items-center gap-space-2 text-on-surface-variant font-label-sm text-label-sm bg-surface-container px-space-2 py-space-1 rounded">
          <GitCommitHorizontal size={14} strokeWidth={1.5} />
          <span>main</span>
        </div>
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="w-8 h-8 rounded-full bg-primary flex items-center justify-center"
            aria-label="Account menu"
          >
            <User size={18} strokeWidth={1.5} className="text-on-primary" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 mt-space-2 w-56 bg-surface-container-high border border-outline-variant shadow-2xl z-50 py-space-2">
              <div className="px-space-3 py-space-2 font-label-sm text-label-sm text-outline border-b border-outline-variant truncate">
                {email}
              </div>
              <Link
                href="/settings"
                className="block px-space-3 py-space-2 font-body-sm text-body-sm text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface"
                onClick={() => setMenuOpen(false)}
              >
                Settings [:set]
              </Link>
              <form action={signOutAction}>
                <button
                  type="submit"
                  className="w-full text-left px-space-3 py-space-2 font-body-sm text-body-sm text-error hover:bg-surface-container-highest"
                >
                  Sign out [:q!]
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
