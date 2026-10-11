'use client';

import React, { useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  File01Icon,
  Tick01Icon,
  Cancel01Icon,
  ArrowDown01Icon,
  ArrowRight01Icon,
  Share01Icon,
  AlertCircleIcon,
} from '@hugeicons/core-free-icons';
import { CandidateItemViewModel } from './view-model';
import { RevisionDiff } from './RevisionDiff';

export interface CandidateReviewProps {
  candidate: CandidateItemViewModel;
  pending?: boolean;
  onApprove: (candidateId: string) => Promise<boolean | void> | void;
  onReject: (candidateId: string) => Promise<boolean | void> | void;
  onToggleExpand?: (candidateId: string) => void;
  onShare?: (candidateId: string, projectIds: string[]) => Promise<boolean | void> | void;
  availableProjectIds?: string[];
  errorMessage?: string | null;
}

export const CandidateReview: React.FC<CandidateReviewProps> = ({
  candidate,
  pending = false,
  onApprove,
  onReject,
  onToggleExpand,
  onShare,
  availableProjectIds = ['proj-1', 'proj-2', 'proj-3'],
  errorMessage = null,
}) => {
  const [internalExpanded, setInternalExpanded] = useState<boolean>(candidate.isExpanded);
  const [shareOpen, setShareOpen] = useState<boolean>(false);
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);

  const isExpanded = onToggleExpand ? candidate.isExpanded : internalExpanded;

  const handleToggleExpand = () => {
    if (onToggleExpand) {
      onToggleExpand(candidate.id);
    } else {
      setInternalExpanded((prev) => !prev);
    }
  };

  const handleApprove = async () => {
    if (pending) return;
    setLocalError(null);
    try {
      await onApprove(candidate.id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Approval failed';
      if (msg.includes('STALE_CANDIDATE') || msg.includes('This candidate changed')) {
        setLocalError('This candidate changed. Refresh before approving.');
      } else {
        setLocalError(msg);
      }
    }
  };

  const handleReject = async () => {
    if (pending) return;
    setLocalError(null);
    try {
      await onReject(candidate.id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Rejection failed';
      setLocalError(msg);
    }
  };

  const handleToggleProject = (projectId: string) => {
    setSelectedProjects((prev) =>
      prev.includes(projectId) ? prev.filter((p) => p !== projectId) : [...prev, projectId]
    );
  };

  const handleConfirmShare = async () => {
    if (pending || !onShare) return;
    await onShare(candidate.id, selectedProjects);
    setShareOpen(false);
  };

  const activeError = errorMessage || localError;

  return (
    <div
      className="rounded-2xl border p-4 transition-all"
      style={{
        backgroundColor: 'var(--zhon-surface)',
        borderColor: 'var(--zhon-border)',
      }}
    >
      {/* Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <HugeiconsIcon
            icon={File01Icon}
            size={18}
            data-icon-source="hugeicons"
            className="hugeicons shrink-0"
            style={{ color: 'var(--zhon-sky)' }}
          />
          <div className="min-w-0">
            <span className="font-semibold text-xs block truncate">
              {candidate.title || candidate.path}
            </span>
            <span
              className="text-[11px] block truncate"
              style={{ color: 'var(--zhon-text-secondary)' }}
            >
              <span className="font-mono">{candidate.path}</span>
              {' \u2022 '}
              <span data-testid="candidate-version">Version {candidate.version}</span>
              {' \u2022 '}
              <span data-testid="candidate-expected-hash">
                Expected Hash: {candidate.expectedSourceHash ? candidate.expectedSourceHash.slice(0, 8) : 'unknown'}
              </span>
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleToggleExpand}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown' || e.key === 'j') {
                e.preventDefault();
                const cards = Array.from(document.querySelectorAll<HTMLElement>('[data-knowledge-nav="card"]'));
                const idx = cards.indexOf(e.currentTarget);
                if (idx >= 0 && idx < cards.length - 1) {
                  cards[idx + 1].focus();
                }
              } else if (e.key === 'ArrowUp' || e.key === 'k') {
                e.preventDefault();
                const cards = Array.from(document.querySelectorAll<HTMLElement>('[data-knowledge-nav="card"]'));
                const idx = cards.indexOf(e.currentTarget);
                if (idx > 0) {
                  cards[idx - 1].focus();
                }
              }
            }}
            data-knowledge-nav="card"
            aria-expanded={isExpanded}
            aria-label={`Compare revisions for ${candidate.path}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border transition-colors cursor-pointer"
            style={{
              borderColor: 'var(--zhon-border)',
              backgroundColor: 'var(--zhon-bg)',
              color: 'var(--zhon-text-primary)',
            }}
          >
            <HugeiconsIcon
              icon={isExpanded ? ArrowDown01Icon : ArrowRight01Icon}
              size={14}
              data-icon-source="hugeicons"
              className="hugeicons"
            />
            <span>Diff</span>
          </button>

          {onShare && (
            <button
              type="button"
              onClick={() => setShareOpen((prev) => !prev)}
              aria-label={`Share candidate ${candidate.path}`}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-full border transition-colors cursor-pointer"
              style={{
                borderColor: 'var(--zhon-border)',
                backgroundColor: 'var(--zhon-bg)',
                color: 'var(--zhon-sky)',
              }}
            >
              <HugeiconsIcon
                icon={Share01Icon}
                size={14}
                data-icon-source="hugeicons"
                className="hugeicons"
              />
            </button>
          )}

          <button
            type="button"
            onClick={handleReject}
            disabled={pending}
            aria-label="Reject"
            aria-busy={pending}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-full border transition-opacity cursor-pointer disabled:opacity-50"
            style={{
              borderColor: 'var(--zhon-border)',
              backgroundColor: 'var(--zhon-bg)',
              color: 'var(--zhon-text-secondary)',
            }}
          >
            <HugeiconsIcon
              icon={Cancel01Icon}
              size={14}
              data-icon-source="hugeicons"
              className="hugeicons"
            />
            <span>Reject</span>
          </button>

          <button
            type="button"
            onClick={handleApprove}
            disabled={pending}
            aria-label="Approve"
            aria-busy={pending}
            className="inline-flex items-center gap-1 px-3.5 py-1.5 text-xs font-semibold rounded-full transition-opacity cursor-pointer disabled:opacity-50"
            style={{
              backgroundColor: 'var(--zhon-lime)',
              color: '#FFFFFF',
            }}
          >
            <HugeiconsIcon
              icon={Tick01Icon}
              size={14}
              data-icon-source="hugeicons"
              className="hugeicons"
            />
            <span>Approve</span>
          </button>
        </div>
      </div>

      {/* Error / Stale Notification */}
      {activeError && (
        <div
          role="alert"
          aria-live="polite"
          className="mt-3 flex items-center gap-2 p-2.5 rounded-xl border text-xs"
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
          <span className="font-medium">{activeError}</span>
        </div>
      )}

      {/* Share Section */}
      {shareOpen && onShare && (
        <div
          role="region"
          aria-label="Share Candidate Section"
          className="mt-4 pt-4 border-t space-y-3"
          style={{ borderColor: 'var(--zhon-border)' }}
        >
          <div
            className="p-3 rounded-xl border text-xs space-y-1"
            style={{ backgroundColor: 'var(--zhon-bg)', borderColor: 'var(--zhon-border)' }}
          >
            <div className="font-semibold text-[11px] uppercase tracking-wider" style={{ color: 'var(--zhon-text-secondary)' }}>
              Exact Revision
            </div>
            <div className="font-mono text-xs truncate">
              ID: <span className="font-semibold">{candidate.revisionId}</span>
            </div>
            <div className="font-mono text-xs truncate">
              Hash: <span className="font-semibold">{candidate.expectedSourceHash}</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider block" style={{ color: 'var(--zhon-text-secondary)' }}>
              Target Projects
            </span>
            {availableProjectIds.map((projId) => (
              <label
                key={projId}
                className="flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer"
                style={{ backgroundColor: 'var(--zhon-bg)', borderColor: 'var(--zhon-border)' }}
              >
                <input
                  type="checkbox"
                  aria-label={projId}
                  checked={selectedProjects.includes(projId)}
                  onChange={() => handleToggleProject(projId)}
                  className="rounded accent-sky-600"
                />
                <span className="font-mono">{projId}</span>
              </label>
            ))}
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShareOpen(false)}
              className="px-3 py-1 text-xs rounded-full border cursor-pointer"
              style={{ borderColor: 'var(--zhon-border)', backgroundColor: 'var(--zhon-bg)' }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmShare}
              disabled={pending}
              className="px-3.5 py-1 text-xs font-semibold rounded-full cursor-pointer disabled:opacity-50"
              style={{ backgroundColor: 'var(--zhon-sky)', color: '#FFFFFF' }}
            >
              Confirm Share
            </button>
          </div>
        </div>
      )}

      {/* Expandable Diff & Content Comparison */}
      {isExpanded && (
        <div
          className="mt-4 pt-4 border-t"
          style={{ borderColor: 'var(--zhon-border)' }}
        >
          <RevisionDiff
            previousMarkdown={candidate.previousMarkdown}
            markdown={candidate.markdown}
            sanitizedPreviousMarkdown={candidate.sanitizedPreviousMarkdown}
            sanitizedMarkdown={candidate.sanitizedMarkdown}
            diffLines={candidate.diffLines}
          />
        </div>
      )}
    </div>
  );
};
