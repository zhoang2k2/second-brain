'use client';

import React from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  ArrowDown01Icon,
  ArrowRight01Icon,
  Share01Icon,
  Cancel01Icon,
} from '@hugeicons/core-free-icons';
import { NoteItemViewModel } from './view-model';

export interface NoteAccordionProps {
  note: NoteItemViewModel;
  pending?: boolean;
  onToggleExpand: (id: string) => void;
  onOpenShare?: (note: NoteItemViewModel) => void;
  onDeactivate?: (noteId: string, version: number) => Promise<boolean | void> | void;
  onRollback?: (noteId: string, revisionId: string, version: number) => Promise<boolean | void> | void;
  reducedMotion?: boolean;
}

export const NoteAccordion: React.FC<NoteAccordionProps> = ({
  note,
  pending = false,
  onToggleExpand,
  onOpenShare,
  onDeactivate,
  reducedMotion = false,
}) => {
  return (
    <div
      className="p-3.5 rounded-2xl border transition-all"
      style={{
        backgroundColor: 'var(--zhon-surface)',
        borderColor: 'var(--zhon-border)',
        transitionDuration: reducedMotion ? '0s' : '0.2s',
      }}
    >
      {/* Note Header */}
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={() => onToggleExpand(note.id)}
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
          aria-expanded={note.isExpanded}
          aria-label={`Toggle note ${note.path}`}
          className="flex items-center gap-2 text-left min-w-0 cursor-pointer focus:outline-none focus:ring-1 focus:ring-sky-500 rounded"
        >
          <HugeiconsIcon
            icon={note.isExpanded ? ArrowDown01Icon : ArrowRight01Icon}
            size={14}
            data-icon-source="hugeicons"
            className="hugeicons shrink-0"
            style={{ color: 'var(--zhon-text-secondary)' }}
          />
          <div className="min-w-0">
            <span className="font-semibold text-xs block truncate">
              {note.title || note.path}
            </span>
            <span
              className="text-[11px] block truncate"
              style={{ color: 'var(--zhon-text-secondary)' }}
            >
              <span className="font-mono">{note.path}</span>
              {' \u2022 '}
              <span>v{note.version}</span>
              {' \u2022 '}
              <span>{note.contentHash?.slice(0, 8) || 'no-hash'}</span>
            </span>
          </div>
        </button>

        {/* Note Actions */}
        {note.column === 'active' && (
          <div className="flex items-center gap-1 shrink-0">
            {onOpenShare && (
              <button
                type="button"
                onClick={() => onOpenShare(note)}
                aria-label={`Share note ${note.path}`}
                className="p-1 rounded-md text-xs cursor-pointer hover:opacity-80 transition-opacity"
                style={{ color: 'var(--zhon-sky)' }}
                title="Share Note"
              >
                <HugeiconsIcon
                  icon={Share01Icon}
                  size={14}
                  data-icon-source="hugeicons"
                  className="hugeicons"
                />
              </button>
            )}
            {onDeactivate && (
              <button
                type="button"
                onClick={() => onDeactivate(note.id, note.version)}
                disabled={pending}
                aria-label={`Deactivate note ${note.path}`}
                className="p-1 rounded-md text-xs cursor-pointer hover:opacity-80 transition-opacity disabled:opacity-50"
                style={{ color: 'var(--zhon-text-secondary)' }}
                title="Deactivate Note"
              >
                <HugeiconsIcon
                  icon={Cancel01Icon}
                  size={14}
                  data-icon-source="hugeicons"
                  className="hugeicons"
                />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Accordion Content */}
      {note.isExpanded && (
        <div
          className="mt-3 pt-3 border-t text-xs zhon-accordion-content"
          style={{
            borderColor: 'var(--zhon-border)',
            transitionDuration: reducedMotion ? '0s' : '0.2s',
          }}
        >
          <div
            className="p-2.5 rounded-xl font-mono text-xs whitespace-pre-wrap select-text break-words"
            style={{ backgroundColor: 'var(--zhon-bg)' }}
            dangerouslySetInnerHTML={{ __html: note.sanitizedMarkdown }}
          />
        </div>
      )}
    </div>
  );
};
