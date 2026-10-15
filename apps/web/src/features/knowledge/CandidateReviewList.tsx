'use client';

import React from 'react';
import { CandidateItemViewModel } from './view-model';
import { CandidateReview } from './CandidateReview';

export interface CandidateReviewListProps {
  candidates: CandidateItemViewModel[];
  pending: boolean;
  onApprove: (candidateId: string) => Promise<boolean | void> | void;
  onReject: (candidateId: string) => Promise<boolean | void> | void;
  onToggleExpand: (candidateId: string) => void;
}

export const CandidateReviewList: React.FC<CandidateReviewListProps> = ({
  candidates,
  pending,
  onApprove,
  onReject,
  onToggleExpand,
}) => {
  if (candidates.length === 0) {
    return (
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
    );
  }

  return (
    <div className="space-y-4">
      {candidates.map((cand) => (
        <CandidateReview
          key={cand.id}
          candidate={cand}
          pending={pending}
          onApprove={onApprove}
          onReject={onReject}
          onToggleExpand={onToggleExpand}
        />
      ))}
    </div>
  );
};
