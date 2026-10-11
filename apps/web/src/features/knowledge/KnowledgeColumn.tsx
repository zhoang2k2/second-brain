'use client';

import React from 'react';
import { ColumnViewModel, NoteItemViewModel } from './view-model';
import { NoteAccordion } from './NoteAccordion';
import { CandidateReview } from './CandidateReview';

export interface KnowledgeColumnProps {
  column: ColumnViewModel;
  pending: boolean;
  onApproveCandidate: (candidateId: string) => Promise<boolean | void> | void;
  onRejectCandidate: (candidateId: string) => Promise<boolean | void> | void;
  onToggleExpand: (id: string) => void;
  onOpenShare?: (note: NoteItemViewModel) => void;
  onDeactivateNote?: (noteId: string, version: number) => Promise<boolean | void> | void;
  onRollbackNote?: (noteId: string, revisionId: string, version: number) => Promise<boolean | void> | void;
  reducedMotion?: boolean;
}

export const KnowledgeColumn: React.FC<KnowledgeColumnProps> = ({
  column,
  pending,
  onApproveCandidate,
  onRejectCandidate,
  onToggleExpand,
  onOpenShare,
  onDeactivateNote,
  onRollbackNote,
  reducedMotion = false,
}) => {
  const headerColor =
    column.colorToken === 'lime'
      ? 'var(--zhon-lime)'
      : column.colorToken === 'sky'
      ? 'var(--zhon-sky)'
      : 'var(--zhon-text-secondary)';

  return (
    <div className="flex flex-col space-y-3">
      {/* Column Header */}
      <div
        data-testid={`column-header-${column.id}`}
        data-color-token={column.colorToken}
        className="flex items-center justify-between pb-2 border-b"
        style={{ borderColor: 'var(--zhon-border)' }}
      >
        <div className="flex items-center gap-2">
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: headerColor }}
          />
          <h2 className="text-xs font-bold uppercase tracking-wider">
            {column.label}
          </h2>
        </div>
        <span
          className="text-xs font-mono px-2 py-0.5 rounded-full"
          style={{
            backgroundColor: 'var(--zhon-surface)',
            color: 'var(--zhon-text-secondary)',
          }}
        >
          {column.count}
        </span>
      </div>

      {/* Column Items */}
      {column.id === 'candidate' ? (
        <div className="space-y-4">
          {column.candidates.length === 0 ? (
            <div
              className="p-6 rounded-2xl border text-center text-xs"
              style={{
                backgroundColor: 'var(--zhon-surface)',
                borderColor: 'var(--zhon-border)',
                color: 'var(--zhon-text-secondary)',
              }}
            >
              No candidate notes awaiting review.
            </div>
          ) : (
            column.candidates.map((cand) => (
              <CandidateReview
                key={cand.id}
                candidate={cand}
                pending={pending}
                onApprove={onApproveCandidate}
                onReject={onRejectCandidate}
                onToggleExpand={onToggleExpand}
              />
            ))
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {column.notes.length === 0 ? (
            <div
              className="p-4 rounded-xl border text-center text-xs"
              style={{
                backgroundColor: 'var(--zhon-surface)',
                borderColor: 'var(--zhon-border)',
                color: 'var(--zhon-text-secondary)',
              }}
            >
              No notes in this column.
            </div>
          ) : (
            column.notes.map((note) => (
              <NoteAccordion
                key={note.id}
                note={note}
                pending={pending}
                onToggleExpand={onToggleExpand}
                onOpenShare={onOpenShare}
                onDeactivate={onDeactivateNote}
                onRollback={onRollbackNote}
                reducedMotion={reducedMotion}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
};
