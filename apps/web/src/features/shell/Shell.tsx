'use client';

import React, { useState } from 'react';
import './shell.css';
import { Sidebar } from './Sidebar';
import { useShell } from './useShell';
import { HugeiconsIcon } from '@hugeicons/react';
import { TerminalIcon } from '@hugeicons/core-free-icons';

import { ViewType } from './view-model';

export interface ShellProps {
  children?: React.ReactNode;
  activeView?: ViewType;
  onViewChange?: (view: ViewType) => void;
}

export const Shell: React.FC<ShellProps> = ({
  children,
  activeView: controlledActiveView,
  onViewChange,
}) => {
  const {
    theme,
    activeView: internalActiveView,
    groups,
    primaryNav,
    reducedMotion,
    isMobileOpen,
    setTheme,
    setView,
    toggleGroup,
    toggleMobileOpen,
  } = useShell(controlledActiveView);

  const activeView = controlledActiveView ?? internalActiveView;

  const handleSelectNav = (view: ViewType) => {
    setView(view);
    onViewChange?.(view);
  };

  const [isTerminalOpen, setIsTerminalOpen] = useState(false);

  return (
    <div
      data-theme={theme}
      data-reduced-motion={reducedMotion ? 'true' : 'false'}
      className="flex h-screen w-screen overflow-hidden font-sans select-none"
      style={{
        backgroundColor: 'var(--zhon-bg)',
        color: 'var(--zhon-text-primary)',
        fontFamily: "'Be Vietnam Pro', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      {/* 280px Desktop Sidebar */}
      <Sidebar
        primaryNav={primaryNav}
        groups={groups}
        theme={theme}
        activeView={activeView}
        isMobileOpen={isMobileOpen}
        onThemeChange={setTheme}
        onSelectNav={handleSelectNav}
        onToggleGroup={toggleGroup}
        onToggleMobile={toggleMobileOpen}
      />

      {/* Main Workspace Body */}
      <div className="flex flex-col flex-1 h-full min-w-0 overflow-hidden">
        {/* Workspace Container (Center rounded card) */}
        <main
          role="main"
          className="flex-1 m-2 md:m-3 p-4 md:p-6 rounded-2xl border overflow-y-auto zhon-no-scrollbar shadow-xs flex flex-col justify-between"
          style={{
            backgroundColor: 'var(--zhon-surface)',
            borderColor: 'var(--zhon-border)',
            minHeight: '50vh',
          }}
        >
          <div className="flex-1 w-full max-w-4xl mx-auto">
            {children ? (
              children
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center py-16">
                <div
                  className="w-12 h-12 rounded-full mb-4 flex items-center justify-center opacity-80"
                  style={{ backgroundColor: 'var(--zhon-bg)' }}
                >
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: 'var(--zhon-lime)' }}
                  />
                </div>
                <h1 className="text-xl font-semibold mb-2">Workspace</h1>
                <p
                  className="text-sm max-w-md"
                  style={{ color: 'var(--zhon-text-secondary)' }}
                >
                  Select a chat or knowledge item from the sidebar to begin.
                </p>
              </div>
            )}
          </div>
        </main>

        {/* Slide-up Terminal Panel (Single/Split view) */}
        {isTerminalOpen && (
          <div
            role="region"
            aria-label="Integrated Terminal"
            className="border-t mx-2 md:mx-3 p-3 rounded-t-xl transition-all"
            style={{
              height: '240px',
              backgroundColor: 'var(--zhon-surface)',
              borderColor: 'var(--zhon-border)',
            }}
          >
            <div className="flex items-center justify-between pb-2 border-b" style={{ borderColor: 'var(--zhon-border)' }}>
              <span className="text-xs font-mono font-medium">Terminal (Single)</span>
              <button
                type="button"
                onClick={() => setIsTerminalOpen(false)}
                className="text-xs px-2 py-0.5 rounded cursor-pointer"
                style={{ color: 'var(--zhon-text-secondary)' }}
              >
                Close
              </button>
            </div>
            <div className="py-2 font-mono text-xs overflow-y-auto h-[180px] zhon-no-scrollbar" style={{ color: 'var(--zhon-text-secondary)' }}>
              <span>zhon-shell ready.</span>
            </div>
          </div>
        )}

        {/* Body-Only Footer (occupies body width only, excludes sidebar) */}
        <footer
          role="contentinfo"
          className="flex items-center justify-between px-4 py-2 border-t shrink-0 text-xs"
          style={{
            borderColor: 'var(--zhon-border)',
            color: 'var(--zhon-text-secondary)',
          }}
        >
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Toggle terminal"
              aria-expanded={isTerminalOpen}
              onClick={() => setIsTerminalOpen((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-colors cursor-pointer"
              style={{
                backgroundColor: isTerminalOpen ? 'var(--zhon-surface)' : 'transparent',
                color: isTerminalOpen ? 'var(--zhon-text-primary)' : 'var(--zhon-text-secondary)',
              }}
            >
              <HugeiconsIcon
                icon={TerminalIcon}
                size={14}
                data-icon-source="hugeicons"
                className="hugeicons"
              />
              <span>Terminal</span>
            </button>
          </div>

          <div className="flex items-center gap-3">
            <span className="font-mono text-[11px] opacity-75">Sky & Lime v5</span>
          </div>
        </footer>
      </div>
    </div>
  );
};
