'use client';

import React from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Search01Icon,
  AlertCircleIcon,
} from '@hugeicons/core-free-icons';
import './knowledge.css';
import { useKnowledge, UseKnowledgeOptions } from './useKnowledge';
import { KnowledgeColumn } from './KnowledgeColumn';

export type KnowledgeViewProps = UseKnowledgeOptions;

export const KnowledgeView: React.FC<KnowledgeViewProps> = (props) => {
  const [selectedProject, setSelectedProject] = React.useState('');
  const scope = React.useMemo(() => selectedProject
    ? { kind: 'project' as const, projectId: selectedProject }
    : props.scope || { kind: 'global' as const }, [selectedProject, props.scope]);
  const {
    columns,
    activeColumnTab,
    setActiveColumnTab,
    query,
    setQuery,
    pending,
    error,
    reducedMotion,
    approve,
    reject,
    deactivate,
    toggleExpand,
    shareDrawerOpen,
    shareTargetNote,
    selectedShareProjectIds,
    openShareDrawer,
    closeShareDrawer,
    toggleShareProjectId,
    share,
    history,
    projectIds,
    rollback,
    loading,
    refresh,
  } = useKnowledge({ ...props, scope });

  const availableProjects = props.availableProjectIds || projectIds;
  const projectOptions = availableProjects.map(id => <option key={id} value={id}>{id}</option>);
  const historyEntries = history.map(candidate => (
    <details key={candidate.id} className="p-3 border rounded-xl">
      <summary>{candidate.title || candidate.path} — {candidate.state}</summary>
      <p className="font-mono text-xs break-all">Revision: {candidate.revisionId} · Hash: {candidate.expectedSourceHash}</p>
      <pre className="whitespace-pre-wrap break-words">{candidate.markdown}</pre>
      {candidate.state === 'approved' && candidate.noteId && (
        <button type="button" disabled={pending} onClick={() => rollback(candidate.noteId!, candidate.revisionId)}>
          Restore approved revision {candidate.revisionId}
        </button>
      )}
    </details>
  ));
  const projectCheckboxes = availableProjects.map(projId => (
    <label key={projId} className="flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer">
      <input type="checkbox" aria-label={projId} name={projId}
        checked={selectedShareProjectIds.includes(projId)} onChange={() => toggleShareProjectId(projId)} />
      <span className="font-mono">{projId}</span>
    </label>
  ));

  const TABS: Array<{ id: 'all' | 'active' | 'candidate' | 'deactivated'; label: string; text: string }> = [
    { id: 'all', label: 'Show All', text: 'All' },
    { id: 'active', label: 'Show Active', text: 'Active' },
    { id: 'candidate', label: 'Show Candidate', text: 'Candidate' },
    { id: 'deactivated', label: 'Show Deactive', text: 'Deactive' },
  ];

  const tabRefs = React.useRef<Record<string, HTMLButtonElement | null>>({});

  const handleTabKeyDown = (e: React.KeyboardEvent, currentId: 'all' | 'active' | 'candidate' | 'deactivated') => {
    const currentIndex = TABS.findIndex((t) => t.id === currentId);
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      const nextTab = TABS[(currentIndex + 1) % TABS.length];
      setActiveColumnTab(nextTab.id);
      tabRefs.current[nextTab.id]?.focus();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const prevTab = TABS[(currentIndex - 1 + TABS.length) % TABS.length];
      setActiveColumnTab(prevTab.id);
      tabRefs.current[prevTab.id]?.focus();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const firstCard = document.querySelector<HTMLElement>('[data-knowledge-nav="card"]');
      firstCard?.focus();
    }
  };

  return (
    <div
      data-reduced-motion={reducedMotion ? 'true' : 'false'}
      className="space-y-6 max-w-5xl mx-auto py-6"
      style={{
        fontFamily: "'Be Vietnam Pro', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      {/* Top Header & Search Control */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Knowledge</h1>
          <p
            className="text-xs mt-1"
            style={{ color: 'var(--zhon-text-secondary)' }}
          >
            Obsidian Markdown vault sync, immutable revisions, and review pipeline.
          </p>
        </div>

        {/* Search input with 8-point padding */}
        <div className="relative w-full md:w-72">
          <HugeiconsIcon
            icon={Search01Icon}
            size={16}
            data-icon-source="hugeicons"
            className="hugeicons absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: 'var(--zhon-text-secondary)' }}
          />
          <input
            role="searchbox"
            name="Search knowledge"
            aria-label="Search knowledge"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search knowledge..."
            className="w-full pl-9 pr-3.5 py-2 text-xs rounded-full border focus:outline-none transition-colors"
            style={{
              backgroundColor: 'var(--zhon-surface)',
              borderColor: 'var(--zhon-border)',
              color: 'var(--zhon-text-primary)',
            }}
          />
        </div>
      </div>

      {/* Segmented Control for Columns (All, Active, Candidate, Deactive) */}
      <div className="flex gap-3 items-center">
        <label>Knowledge scope
          <select aria-label="Knowledge scope" value={selectedProject} onChange={event => setSelectedProject(event.target.value)}>
            <option value="">Global</option>
            {projectOptions}
          </select>
        </label>
        <button type="button" disabled={loading || pending} onClick={() => refresh()}>Refresh knowledge</button>
        {loading && <span role="status">Loading knowledge...</span>}
      </div>
      <div
        role="group"
        aria-label="Column Selection"
        className="flex items-center gap-1.5 p-1 rounded-full border w-fit"
        style={{ backgroundColor: 'var(--zhon-surface)', borderColor: 'var(--zhon-border)' }}
      >
        <button
          ref={(el) => { tabRefs.current['all'] = el; }}
          type="button"
          onClick={() => setActiveColumnTab('all')}
          onKeyDown={(e) => handleTabKeyDown(e, 'all')}
          aria-pressed={activeColumnTab === 'all'}
          aria-label="Show All"
          className="px-3.5 py-1.5 text-xs font-medium rounded-full transition-all cursor-pointer focus:outline-none focus:ring-1 focus:ring-sky-500"
          style={{
            backgroundColor: activeColumnTab === 'all' ? 'var(--zhon-bg)' : 'transparent',
            color: activeColumnTab === 'all' ? 'var(--zhon-text-primary)' : 'var(--zhon-text-secondary)',
            boxShadow: activeColumnTab === 'all' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
          }}
        >
          All
        </button>
        <button
          ref={(el) => { tabRefs.current['active'] = el; }}
          type="button"
          onClick={() => setActiveColumnTab('active')}
          onKeyDown={(e) => handleTabKeyDown(e, 'active')}
          aria-pressed={activeColumnTab === 'active'}
          aria-label="Show Active"
          className="px-3.5 py-1.5 text-xs font-medium rounded-full transition-all cursor-pointer focus:outline-none focus:ring-1 focus:ring-sky-500"
          style={{
            backgroundColor: activeColumnTab === 'active' ? 'var(--zhon-bg)' : 'transparent',
            color: activeColumnTab === 'active' ? 'var(--zhon-lime)' : 'var(--zhon-text-secondary)',
            boxShadow: activeColumnTab === 'active' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
          }}
        >
          Active
        </button>
        <button
          ref={(el) => { tabRefs.current['candidate'] = el; }}
          type="button"
          onClick={() => setActiveColumnTab('candidate')}
          onKeyDown={(e) => handleTabKeyDown(e, 'candidate')}
          aria-pressed={activeColumnTab === 'candidate'}
          aria-label="Show Candidate"
          className="px-3.5 py-1.5 text-xs font-medium rounded-full transition-all cursor-pointer focus:outline-none focus:ring-1 focus:ring-sky-500"
          style={{
            backgroundColor: activeColumnTab === 'candidate' ? 'var(--zhon-bg)' : 'transparent',
            color: activeColumnTab === 'candidate' ? 'var(--zhon-sky)' : 'var(--zhon-text-secondary)',
            boxShadow: activeColumnTab === 'candidate' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
          }}
        >
          Candidate
        </button>
        <button
          ref={(el) => { tabRefs.current['deactivated'] = el; }}
          type="button"
          onClick={() => setActiveColumnTab('deactivated')}
          onKeyDown={(e) => handleTabKeyDown(e, 'deactivated')}
          aria-pressed={activeColumnTab === 'deactivated'}
          aria-label="Show Deactive"
          className="px-3.5 py-1.5 text-xs font-medium rounded-full transition-all cursor-pointer focus:outline-none focus:ring-1 focus:ring-sky-500"
          style={{
            backgroundColor: activeColumnTab === 'deactivated' ? 'var(--zhon-bg)' : 'transparent',
            color: activeColumnTab === 'deactivated' ? 'var(--zhon-text-primary)' : 'var(--zhon-text-secondary)',
            boxShadow: activeColumnTab === 'deactivated' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
          }}
        >
          Deactive
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <div
          role="alert"
          aria-live="polite"
          className="flex items-center gap-3 p-3.5 rounded-xl border text-xs"
          style={{
            backgroundColor: 'rgba(239, 68, 68, 0.08)',
            borderColor: 'rgba(239, 68, 68, 0.25)',
            color: '#EF4444',
          }}
        >
          <HugeiconsIcon
            icon={AlertCircleIcon}
            size={16}
            data-icon-source="hugeicons"
            className="hugeicons shrink-0"
          />
          <span className="font-medium">{error}</span>
        </div>
      )}

      {/* 3-Column Layout Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {columns.map((col) => {
          if (activeColumnTab !== 'all' && activeColumnTab !== col.id) {
            return null;
          }

          return (
            <div
              key={col.id}
              role="region"
              aria-label={`${col.label} notes`}
              style={{
                gridColumn: activeColumnTab !== 'all' ? 'span 3 / span 3' : undefined,
              }}
            >
              <KnowledgeColumn
                column={col}
                pending={pending}
                onApproveCandidate={approve}
                onRejectCandidate={reject}
                onToggleExpand={toggleExpand}
                onOpenShare={(note) => openShareDrawer(note.id)}
                onDeactivateNote={(noteId) => deactivate(noteId)}
                reducedMotion={reducedMotion}
              />
            </div>
          );
        })}
      </div>

      {/* Share Drawer Modal */}
      <details className="space-y-3">
        <summary>Review history</summary>
        <section aria-label="Review history">
          {historyEntries.length ? historyEntries : <p>No reviewed candidates.</p>}
        </section>
      </details>
      {shareDrawerOpen && shareTargetNote && (
        <div
          role="region"
          aria-label="Share Note Drawer"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs"
        >
          <div
            className="w-full max-w-md rounded-2xl border p-5 space-y-4 shadow-xl"
            style={{
              backgroundColor: 'var(--zhon-surface)',
              borderColor: 'var(--zhon-border)',
            }}
          >
            <div>
              <h3 className="text-sm font-bold">Share Note Across Projects</h3>
              <p className="text-xs mt-1" style={{ color: 'var(--zhon-text-secondary)' }}>
                Target projects will gain scoped read access without granting foreign repository access.
              </p>
            </div>

            {/* Note Revision Metadata */}
            <div
              className="p-3 rounded-xl border space-y-1 text-xs"
              style={{
                backgroundColor: 'var(--zhon-bg)',
                borderColor: 'var(--zhon-border)',
              }}
            >
              <div
                className="font-semibold text-[11px] uppercase tracking-wider"
                style={{ color: 'var(--zhon-text-secondary)' }}
              >
                Exact Active Revision
              </div>
              <div className="font-mono text-xs truncate">
                ID: <span className="font-semibold">{shareTargetNote.activeRevisionId || 'none'}</span>
              </div>
              <div className="font-mono text-xs truncate">
                Hash: <span className="font-semibold">{shareTargetNote.contentHash}</span>
              </div>
            </div>

            {/* Project Selection Checkboxes */}
            <div className="space-y-2">
              <label
                className="text-xs font-semibold block"
                style={{ color: 'var(--zhon-text-secondary)' }}
              >
                Select Target Projects
              </label>
              <div className="space-y-1.5">
                {projectCheckboxes}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={closeShareDrawer}
                disabled={pending}
                className="px-3.5 py-1.5 text-xs rounded-full border cursor-pointer"
                style={{
                  borderColor: 'var(--zhon-border)',
                  backgroundColor: 'var(--zhon-bg)',
                  color: 'var(--zhon-text-secondary)',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => share(shareTargetNote.id, selectedShareProjectIds)}
                disabled={pending}
                className="px-4 py-1.5 text-xs font-semibold rounded-full cursor-pointer disabled:opacity-50"
                style={{
                  backgroundColor: 'var(--zhon-sky)',
                  color: '#FFFFFF',
                }}
              >
                Confirm Share
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
