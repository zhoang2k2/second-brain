'use client';

import React from 'react';
import { DiffLine } from './view-model';

export interface RevisionDiffProps {
  previousMarkdown?: string;
  markdown: string;
  sanitizedPreviousMarkdown?: string;
  sanitizedMarkdown?: string;
  diffLines?: DiffLine[];
}

export const RevisionDiff: React.FC<RevisionDiffProps> = ({
  previousMarkdown = '',
  markdown = '',
  sanitizedPreviousMarkdown,
  sanitizedMarkdown,
  diffLines = [],
}) => {
  const displayPrevious = sanitizedPreviousMarkdown ?? previousMarkdown;
  const displayProposed = sanitizedMarkdown ?? markdown;

  return (
    <div className="space-y-4">
      {/* Side-by-side Previous Active vs Proposed Revision Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div
          className="p-3 rounded-xl border text-xs"
          style={{
            backgroundColor: 'var(--zhon-bg)',
            borderColor: 'var(--zhon-border)',
          }}
        >
          <div
            className="font-semibold text-[11px] uppercase tracking-wider mb-2"
            style={{ color: 'var(--zhon-text-secondary)' }}
          >
            Previous Active Revision
          </div>
          <pre className="font-mono text-xs whitespace-pre-wrap select-text break-words">
            {displayPrevious || '(No prior active content - new note)'}
          </pre>
        </div>

        <div
          className="p-3 rounded-xl border text-xs"
          style={{
            backgroundColor: 'var(--zhon-bg)',
            borderColor: 'var(--zhon-border)',
          }}
        >
          <div
            className="font-semibold text-[11px] uppercase tracking-wider mb-2"
            style={{ color: 'var(--zhon-sky)' }}
          >
            Proposed Revision
          </div>
          <pre className="font-mono text-xs whitespace-pre-wrap select-text break-words">
            {displayProposed}
          </pre>
        </div>
      </div>

      {/* Line Diff View */}
      {diffLines.length > 0 && (
        <div
          className="rounded-xl border overflow-hidden"
          style={{
            backgroundColor: 'var(--zhon-bg)',
            borderColor: 'var(--zhon-border)',
          }}
        >
          <div
            className="px-3 py-2 text-[11px] font-semibold border-b uppercase tracking-wider"
            style={{
              borderColor: 'var(--zhon-border)',
              color: 'var(--zhon-text-secondary)',
            }}
          >
            Unified Diff
          </div>
          <div className="p-2 font-mono text-xs overflow-x-auto select-text space-y-0.5">
            {diffLines.map((line, idx) => {
              if (line.type === 'added') {
                return (
                  <div
                    key={idx}
                    className="px-2 py-0.5 rounded"
                    style={{
                      backgroundColor: 'rgba(90, 116, 0, 0.12)',
                      color: 'var(--zhon-lime)',
                    }}
                  >
                    + {line.text}
                  </div>
                );
              }
              if (line.type === 'removed') {
                return (
                  <div
                    key={idx}
                    className="px-2 py-0.5 rounded"
                    style={{
                      backgroundColor: 'rgba(239, 68, 68, 0.12)',
                      color: '#EF4444',
                    }}
                  >
                    - {line.text}
                  </div>
                );
              }
              return (
                <div
                  key={idx}
                  className="px-2 py-0.5"
                  style={{ color: 'var(--zhon-text-secondary)' }}
                >
                  &nbsp; {line.text}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
