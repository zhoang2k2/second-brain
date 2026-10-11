import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { CandidateReview } from './CandidateReview';
import { CandidateItemViewModel } from './view-model';

const createMockCandidate = (overrides?: Partial<CandidateItemViewModel>): CandidateItemViewModel => {
  return {
    id: 'cand-1',
    noteId: 'note-1',
    revisionId: 'rev-cand-1',
    path: 'engineering/retry-policy.md',
    title: 'Retry Policy',
    version: 2,
    expectedSourceHash: 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
    state: 'pending',
    stateLabel: 'Pending',
    processing: 'ready',
    markdown: '# Retry Policy\n\nExponential backoff with jitter.',
    previousMarkdown: '# Retry Policy\n\nExponential backoff without jitter.',
    sanitizedMarkdown: '# Retry Policy\n\nExponential backoff with jitter.',
    sanitizedPreviousMarkdown: '# Retry Policy\n\nExponential backoff without jitter.',
    diffLines: [
      { type: 'unchanged', text: '# Retry Policy', lineNumber: 1 },
      { type: 'unchanged', text: '', lineNumber: 2 },
      { type: 'removed', text: 'Exponential backoff without jitter.', lineNumber: 3 },
      { type: 'added', text: 'Exponential backoff with jitter.', lineNumber: 3 },
    ],
    isExpanded: false,
    statusColor: 'sky',
    ...overrides,
  };
};

describe('CandidateReview Component', () => {
  it('candidate_review_displays_expected_hash_and_version', () => {
    const candidate = createMockCandidate();
    render(
      <CandidateReview
        candidate={candidate}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />
    );

    const versionElem = screen.getByTestId('candidate-version');
    const hashElem = screen.getByTestId('candidate-expected-hash');

    expect(versionElem).toHaveTextContent('Version 2');
    expect(hashElem).toHaveTextContent('abcdef01');
  });

  it('candidate_review_shows_previous_active_and_candidate_content', async () => {
    const user = userEvent.setup();
    const candidate = createMockCandidate({ isExpanded: false });
    const toggleSpy = vi.fn();

    const { rerender } = render(
      <CandidateReview
        candidate={candidate}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onToggleExpand={toggleSpy}
      />
    );

    const diffBtn = screen.getByRole('button', { name: /Compare revisions for engineering\/retry-policy\.md/i });
    expect(diffBtn).toHaveAttribute('aria-expanded', 'false');

    await user.click(diffBtn);
    expect(toggleSpy).toHaveBeenCalledWith('cand-1');

    // Rerender as expanded
    rerender(
      <CandidateReview
        candidate={{ ...candidate, isExpanded: true }}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onToggleExpand={toggleSpy}
      />
    );

    expect(screen.getByText('Previous Active Revision')).toBeInTheDocument();
    expect(screen.getByText('Proposed Revision')).toBeInTheDocument();
    expect(screen.getAllByText(/Exponential backoff without jitter/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Exponential backoff with jitter/).length).toBeGreaterThanOrEqual(1);
  });

  it('candidate_review_approve_and_reject_handlers', async () => {
    const user = userEvent.setup();
    const approveSpy = vi.fn().mockResolvedValue(true);
    const rejectSpy = vi.fn().mockResolvedValue(true);
    const candidate = createMockCandidate();

    render(
      <CandidateReview
        candidate={candidate}
        onApprove={approveSpy}
        onReject={rejectSpy}
      />
    );

    const approveBtn = screen.getByRole('button', { name: 'Approve' });
    const rejectBtn = screen.getByRole('button', { name: 'Reject' });

    await user.click(approveBtn);
    expect(approveSpy).toHaveBeenCalledWith('cand-1');

    await user.click(rejectBtn);
    expect(rejectSpy).toHaveBeenCalledWith('cand-1');
  });

  it('pending_submit_prevents_double_click', async () => {
    const user = userEvent.setup();
    const approveSpy = vi.fn();
    const rejectSpy = vi.fn();
    const candidate = createMockCandidate();

    render(
      <CandidateReview
        candidate={candidate}
        pending={true}
        onApprove={approveSpy}
        onReject={rejectSpy}
      />
    );

    const approveBtn = screen.getByRole('button', { name: 'Approve' });
    const rejectBtn = screen.getByRole('button', { name: 'Reject' });

    expect(approveBtn).toBeDisabled();
    expect(rejectBtn).toBeDisabled();
    expect(approveBtn).toHaveAttribute('aria-busy', 'true');
    expect(rejectBtn).toHaveAttribute('aria-busy', 'true');

    await user.click(approveBtn);
    await user.click(rejectBtn);

    expect(approveSpy).not.toHaveBeenCalled();
    expect(rejectSpy).not.toHaveBeenCalled();
  });

  it('stale_approval_requires_refresh', async () => {
    const user = userEvent.setup();
    const candidate = createMockCandidate();
    const approveSpy = vi.fn().mockRejectedValue(new Error('STALE_CANDIDATE: Version changed'));

    render(
      <CandidateReview
        candidate={candidate}
        onApprove={approveSpy}
        onReject={vi.fn()}
      />
    );

    const approveBtn = screen.getByRole('button', { name: 'Approve' });
    await user.click(approveBtn);

    expect(await screen.findByText('This candidate changed. Refresh before approving.')).toBeVisible();
  });

  it('shareActionShowsExactRevisionAndTargetProjects', async () => {
    const user = userEvent.setup();
    const candidate = createMockCandidate();
    const shareSpy = vi.fn().mockResolvedValue(true);

    render(
      <CandidateReview
        candidate={candidate}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onShare={shareSpy}
        availableProjectIds={['proj-1', 'proj-2', 'proj-3']}
      />
    );

    const shareBtn = screen.getByRole('button', { name: /Share candidate engineering\/retry-policy\.md/i });
    await user.click(shareBtn);

    // Displays Exact Revision ID and Hash
    expect(screen.getByText('Exact Revision')).toBeInTheDocument();
    expect(screen.getByText('rev-cand-1')).toBeInTheDocument();
    expect(screen.getByText(candidate.expectedSourceHash)).toBeInTheDocument();

    // Select target project proj-2
    const checkbox = screen.getByRole('checkbox', { name: 'proj-2' });
    await user.click(checkbox);

    // Confirm Share
    const confirmBtn = screen.getByRole('button', { name: 'Confirm Share' });
    await user.click(confirmBtn);

    expect(shareSpy).toHaveBeenCalledWith('cand-1', ['proj-2']);
  });

  it('candidate_review_has_zero_emojis_and_hugeicons_only', () => {
    const candidate = createMockCandidate();
    const { container } = render(
      <CandidateReview
        candidate={candidate}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onShare={vi.fn()}
      />
    );

    // Zero emojis in text content
    const text = container.textContent || '';
    const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u;
    expect(emojiRegex.test(text)).toBe(false);

    // All icons are Hugeicons
    const svgIcons = container.querySelectorAll('svg');
    expect(svgIcons.length).toBeGreaterThan(0);
    svgIcons.forEach((svg) => {
      expect(svg).toHaveAttribute('data-icon-source', 'hugeicons');
    });
  });

  it('markdown_html_script_and_unsafe_links_not_executed', () => {
    const candidate = createMockCandidate({
      isExpanded: true,
      markdown: '<script data-testid="xss-script">alert("bad")</script><a href="javascript:alert(1)">Unsafe</a>',
      sanitizedMarkdown: '<a href="#">Unsafe</a>',
    });

    render(
      <CandidateReview
        candidate={candidate}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />
    );

    expect(document.querySelector('script[data-testid="xss-script"]')).toBeNull();
    const link = screen.queryByRole('link', { name: /Unsafe/i });
    if (link) {
      expect(link).not.toHaveAttribute('href', 'javascript:alert(1)');
    }
  });
});
