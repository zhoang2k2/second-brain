import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { KnowledgeView } from './KnowledgeView';
import { KnowledgeApiClient, NoteView, CandidateView } from './service';

const createMockData = () => {
  const activeNotes: NoteView[] = [
    {
      id: 'note-1',
      path: 'engineering/retry-mechanism.md',
      title: 'Retry Mechanism',
      scope: { kind: 'project', projectId: 'proj-1' },
      version: 1,
      availability: 'available',
      activeRevisionId: 'rev-1',
      contentHash: 'hash-abc111',
      markdown: '# Retry Mechanism\n\nExponential backoff is recommended for distributed requests.',
      sharedWithProjectIds: [],
    },
    {
      id: 'note-2',
      path: 'personal/journal.md',
      title: 'Journal',
      scope: { kind: 'global' },
      version: 1,
      availability: 'available',
      activeRevisionId: 'rev-2',
      contentHash: 'hash-abc222',
      markdown: '# Daily Journal\n\nReviewing knowledge system today.',
      sharedWithProjectIds: [],
    },
  ];

  const candidateNotes: CandidateView[] = [
    {
      id: 'cand-1',
      noteId: 'note-1',
      revisionId: 'rev-1-cand',
      path: 'engineering/retry-mechanism.md',
      title: 'Retry Mechanism',
      version: 2,
      expectedSourceHash: 'hash-abc111',
      state: 'pending',
      processing: 'ready',
      markdown: '# Retry Mechanism\n\nExponential backoff with jitter is recommended for retry policies.',
      previousMarkdown: '# Retry Mechanism\n\nExponential backoff is recommended for distributed requests.',
    },
    {
      id: 'cand-2',
      noteId: 'note-new',
      revisionId: 'rev-new-cand',
      path: 'engineering/caching.md',
      title: 'Caching',
      version: 1,
      expectedSourceHash: 'hash-new',
      state: 'pending',
      processing: 'ready',
      markdown: '# Caching\n\nCache invalidation patterns.',
      previousMarkdown: '',
    },
  ];

  const deactiveNotes: NoteView[] = [
    {
      id: 'note-3',
      path: 'deprecated/legacy-auth.md',
      title: 'Legacy Auth',
      scope: { kind: 'global' },
      version: 2,
      availability: 'available',
      activeRevisionId: 'rev-3',
      contentHash: 'hash-abc333',
      markdown: '# Legacy Auth\n\nDeprecated session auth.',
      sharedWithProjectIds: [],
    },
  ];

  return { activeNotes, candidateNotes, deactiveNotes };
};

const createMockApi = (overrides?: Partial<KnowledgeApiClient>): KnowledgeApiClient => {
  const { activeNotes, candidateNotes, deactiveNotes } = createMockData();
  return {
    command: vi.fn().mockResolvedValue({ ok: true, value: {} }),
    query: vi.fn().mockResolvedValue({ ok: true, value: {} }),
    searchKnowledge: vi.fn().mockImplementation(async (q) => {
      let items: Array<NoteView | CandidateView> = activeNotes;
      if (q?.column === 'candidate') items = candidateNotes;
      else if (q?.column === 'deactivated') items = deactiveNotes;
      else if (q?.column === 'history') items = [];
      return {
        ok: true,
        value: {
          items,
          total: items.length,
        },
      };
    }),
    approveCandidate: vi.fn().mockResolvedValue({
      ok: true,
      value: {
        id: 'note-1',
        path: 'engineering/retry-mechanism.md',
        version: 2,
        activeRevisionId: 'rev-1-cand',
        availability: 'available',
        scope: { kind: 'project', projectId: 'proj-1' },
      },
    }),
    rejectCandidate: vi.fn().mockResolvedValue({
      ok: true,
      value: {
        id: 'note-1',
        path: 'engineering/retry-mechanism.md',
        version: 1,
        activeRevisionId: 'rev-1',
        availability: 'available',
        scope: { kind: 'project', projectId: 'proj-1' },
      },
    }),
    deactivateNote: vi.fn().mockResolvedValue({
      ok: true,
      value: {
        id: 'note-1',
        path: 'engineering/retry-mechanism.md',
        version: 2,
        availability: 'available',
        scope: { kind: 'project', projectId: 'proj-1' },
      },
    }),
    rollbackNote: vi.fn().mockResolvedValue({
      ok: true,
      value: {
        id: 'note-1',
        path: 'engineering/retry-mechanism.md',
        version: 3,
        activeRevisionId: 'rev-1',
        availability: 'available',
        scope: { kind: 'project', projectId: 'proj-1' },
      },
    }),
    shareNote: vi.fn().mockResolvedValue({
      ok: true,
      value: {
        id: 'note-1',
        path: 'engineering/retry-mechanism.md',
        version: 1,
        activeRevisionId: 'rev-1',
        availability: 'available',
        scope: { kind: 'project', projectId: 'proj-1' },
        sharedWithProjectIds: ['proj-2'],
      },
    }),
    ...overrides,
  };
};

describe('KnowledgeView Component', () => {
  it('capture issues are visible after refreshing the knowledge snapshot', async () => {
    let listener: ((event: { type: string; payload?: unknown }) => void) | undefined;
    const api = createMockApi({ subscribe: (_after, callback) => { listener = callback; return () => {}; } });
    render(<KnowledgeView api={api} />);
    await waitFor(() => expect(listener).toBeDefined());
    act(() => listener?.({ type: 'knowledge.note_updated', payload: { issue: { code: 'INCOMPLETE_YAML' } } }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('INCOMPLETE_YAML'));
  });
  it('search_filters_all_columns', async () => {
    const user = userEvent.setup();
    const mockApi = createMockApi();
    const { activeNotes, candidateNotes, deactiveNotes } = createMockData();

    render(
      <KnowledgeView
        api={mockApi}
        initialNotes={activeNotes}
        initialCandidates={candidateNotes}
        initialDeactiveNotes={deactiveNotes}
      />
    );

    // Initially all notes are present
    expect(screen.getAllByText('engineering/retry-mechanism.md').length).toBe(2);
    expect(screen.getByText('personal/journal.md')).toBeInTheDocument();
    expect(screen.getByText('engineering/caching.md')).toBeInTheDocument();

    // Type 'retry' into the searchbox
    const searchbox = screen.getByRole('searchbox', { name: 'Search knowledge' });
    await user.type(searchbox, 'retry');

    // 'retry-mechanism.md' remains visible in Active and Candidate columns
    expect(screen.getAllByText('engineering/retry-mechanism.md').length).toBe(2);

    // Other notes are filtered out
    expect(screen.queryByText('personal/journal.md')).not.toBeInTheDocument();
    expect(screen.queryByText('engineering/caching.md')).not.toBeInTheDocument();
    expect(screen.queryByText('deprecated/legacy-auth.md')).not.toBeInTheDocument();
  });

  it('labels_and_colors_are_lime_sky_neutral', () => {
    const mockApi = createMockApi();
    const { activeNotes, candidateNotes, deactiveNotes } = createMockData();

    render(
      <KnowledgeView
        api={mockApi}
        initialNotes={activeNotes}
        initialCandidates={candidateNotes}
        initialDeactiveNotes={deactiveNotes}
      />
    );

    // Check column labels
    const activeHeader = screen.getByTestId('column-header-active');
    const candidateHeader = screen.getByTestId('column-header-candidate');
    const deactiveHeader = screen.getByTestId('column-header-deactivated');

    expect(activeHeader).toHaveTextContent('Active');
    expect(candidateHeader).toHaveTextContent('Candidate');
    expect(deactiveHeader).toHaveTextContent('Deactive');

    // Check token color classes or attributes
    expect(activeHeader).toHaveAttribute('data-color-token', 'lime');
    expect(candidateHeader).toHaveAttribute('data-color-token', 'sky');
    expect(deactiveHeader).toHaveAttribute('data-color-token', 'neutral');
  });

  it('accordion_keyboard_smooth_reduced_motion', async () => {
    const user = userEvent.setup();
    const mockApi = createMockApi();
    const { activeNotes, candidateNotes, deactiveNotes } = createMockData();

    render(
      <KnowledgeView
        api={mockApi}
        initialNotes={activeNotes}
        initialCandidates={candidateNotes}
        initialDeactiveNotes={deactiveNotes}
      />
    );

    const accordionBtn = screen.getByRole('button', { name: /Toggle note engineering\/retry-mechanism\.md/i });
    expect(accordionBtn).toHaveAttribute('aria-expanded', 'false');

    // Click to expand
    await user.click(accordionBtn);
    expect(accordionBtn).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(/Exponential backoff is recommended for distributed requests/i)).toBeVisible();

    // Press Enter to collapse
    accordionBtn.focus();
    await user.keyboard('{Enter}');
    expect(accordionBtn).toHaveAttribute('aria-expanded', 'false');
  });

  it('stale_approval_requires_refresh', async () => {
    const user = userEvent.setup();
    const mockApi = createMockApi({
      approveCandidate: vi.fn().mockResolvedValue({
        ok: false,
        error: {
          code: 'STALE_CANDIDATE',
          message: 'This candidate changed. Refresh before approving.',
          retryable: false,
        },
      }),
    });
    const { activeNotes, candidateNotes, deactiveNotes } = createMockData();

    render(
      <KnowledgeView
        api={mockApi}
        initialNotes={activeNotes}
        initialCandidates={candidateNotes}
        initialDeactiveNotes={deactiveNotes}
      />
    );

    // Exact steps from plan specification
    await user.type(screen.getByRole('searchbox', { name: 'Search knowledge' }), 'retry');
    await user.click(screen.getByRole('button', { name: 'Approve' }));
    expect(await screen.findByText('This candidate changed. Refresh before approving.')).toBeVisible();
  });

  it('pending_submit_prevents_double_click', async () => {
    const user = userEvent.setup();
    let resolveApprove: (val: unknown) => void;
    const approvePromise = new Promise((resolve) => {
      resolveApprove = resolve;
    });

    const approveMock = vi.fn().mockImplementation(() => approvePromise);
    const mockApi = createMockApi({ approveCandidate: approveMock });
    const { activeNotes, candidateNotes, deactiveNotes } = createMockData();

    render(
      <KnowledgeView
        api={mockApi}
        initialNotes={activeNotes}
        initialCandidates={candidateNotes}
        initialDeactiveNotes={deactiveNotes}
      />
    );

    const approveBtn = screen.getAllByRole('button', { name: 'Approve' })[0];

    // First click initiates request
    await user.click(approveBtn);
    expect(approveMock).toHaveBeenCalledTimes(1);

    // While pending, second click does nothing
    await user.click(approveBtn);
    expect(approveMock).toHaveBeenCalledTimes(1);

    // Button should be disabled or have aria-busy
    expect(approveBtn).toBeDisabled();

    // Resolve request
    resolveApprove!({
      ok: true,
      value: {
        id: 'note-1',
        path: 'engineering/retry-mechanism.md',
        version: 2,
        activeRevisionId: 'rev-1-cand',
        availability: 'available',
        scope: { kind: 'project', projectId: 'proj-1' },
      },
    });

    await waitFor(() => {
      expect(approveBtn).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Approve' })).not.toBeDisabled();
    });
  });

  it('previous_active_visible_during_review', async () => {
    const user = userEvent.setup();
    const mockApi = createMockApi();
    const { activeNotes, candidateNotes, deactiveNotes } = createMockData();

    render(
      <KnowledgeView
        api={mockApi}
        initialNotes={activeNotes}
        initialCandidates={candidateNotes}
        initialDeactiveNotes={deactiveNotes}
      />
    );

    // Expand candidate note diff comparison
    const compareBtn = screen.getByRole('button', { name: /Compare revisions for engineering\/retry-mechanism\.md/i });
    await user.click(compareBtn);

    // Verify both previous active and proposed content are visible
    expect(screen.getByText(/Previous Active Revision/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Exponential backoff is recommended for distributed requests/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Proposed Revision/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Exponential backoff with jitter is recommended for retry policies/i).length).toBeGreaterThanOrEqual(1);
  });

  it('markdown_html_script_and_unsafe_links_not_executed', () => {
    const mockApi = createMockApi();
    const activeWithScript: NoteView[] = [
      {
        id: 'note-xss',
        path: 'security/xss-test.md',
        title: 'XSS Test',
        scope: { kind: 'global' },
        version: 1,
        availability: 'available',
        activeRevisionId: 'rev-xss',
        contentHash: 'hash-xss',
        markdown: '<script data-testid="malicious-script">alert("unsafe")</script><a href="javascript:alert(1)">Unsafe Link</a>',
        sharedWithProjectIds: [],
      },
    ];

    render(
      <KnowledgeView
        api={mockApi}
        initialNotes={activeWithScript}
        initialCandidates={[]}
        initialDeactiveNotes={[]}
      />
    );

    // Script tag is not rendered as an executable script element in DOM
    expect(document.querySelector('script[data-testid="malicious-script"]')).toBeNull();
    // javascript: link is not rendered as an active javascript: href
    const link = screen.queryByRole('link', { name: /Unsafe Link/i });
    if (link) {
      expect(link).not.toHaveAttribute('href', 'javascript:alert(1)');
    }
  });

  it('shareActionShowsExactRevisionAndTargetProjects', async () => {
    const user = userEvent.setup();
    const shareMock = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        id: 'note-1',
        path: 'engineering/retry-mechanism.md',
        version: 1,
        activeRevisionId: 'rev-1',
        availability: 'available',
        scope: { kind: 'project', projectId: 'proj-1' },
        sharedWithProjectIds: ['proj-2'],
      },
    });
    const mockApi = createMockApi({ shareNote: shareMock });
    const { activeNotes, candidateNotes, deactiveNotes } = createMockData();

    render(
      <KnowledgeView
        api={mockApi}
        initialNotes={activeNotes}
        initialCandidates={candidateNotes}
        initialDeactiveNotes={deactiveNotes}
        availableProjectIds={['proj-1', 'proj-2', 'proj-3']}
      />
    );

    // Open share drawer for note 1
    const shareBtn = screen.getByRole('button', { name: /Share note engineering\/retry-mechanism\.md/i });
    await user.click(shareBtn);

    // Drawer displays exact revision hash/ID
    expect(screen.getByText(/Exact Active Revision/i)).toBeInTheDocument();
    expect(screen.getByText('rev-1')).toBeInTheDocument();
    expect(screen.getByText('hash-abc111')).toBeInTheDocument();

    // Select target project proj-2
    const projectCheckbox = screen.getByRole('checkbox', { name: 'proj-2' });
    await user.click(projectCheckbox);

    // Submit share
    const confirmShareBtn = screen.getByRole('button', { name: 'Confirm Share' });
    await user.click(confirmShareBtn);

    expect(shareMock).toHaveBeenCalledWith({
      noteId: 'note-1',
      expectedVersion: 1,
      expectedActiveHash: 'hash-abc111',
      projectIds: ['proj-2'],
    });
  });

  it('candidate_review_list_accessible_buttons_and_controls', async () => {
    const user = userEvent.setup();
    const mockApi = createMockApi();
    const { activeNotes, candidateNotes, deactiveNotes } = createMockData();

    render(
      <KnowledgeView
        api={mockApi}
        initialNotes={activeNotes}
        initialCandidates={candidateNotes}
        initialDeactiveNotes={deactiveNotes}
      />
    );

    // Segmented controls have aria-pressed
    const activeTab = screen.getByRole('button', { name: /Show Active/i });
    const candidateTab = screen.getByRole('button', { name: /Show Candidate/i });
    const deactiveTab = screen.getByRole('button', { name: /Show Deactive/i });

    expect(activeTab).toHaveAttribute('aria-pressed', 'false');
    expect(deactiveTab).toHaveAttribute('aria-pressed', 'false');
    await user.click(candidateTab);
    expect(candidateTab).toHaveAttribute('aria-pressed', 'true');

    // Candidate review pill buttons have accessible labels
    const approveBtn = screen.getAllByRole('button', { name: 'Approve' })[0];
    const rejectBtn = screen.getAllByRole('button', { name: 'Reject' })[0];

    expect(approveBtn).toHaveAttribute('aria-label', 'Approve');
    expect(rejectBtn).toHaveAttribute('aria-label', 'Reject');
  });

  it('keyboard_navigation_between_tabs_and_cards', async () => {
    const user = userEvent.setup();
    const mockApi = createMockApi();
    const { activeNotes, candidateNotes, deactiveNotes } = createMockData();

    render(
      <KnowledgeView
        api={mockApi}
        initialNotes={activeNotes}
        initialCandidates={candidateNotes}
        initialDeactiveNotes={deactiveNotes}
      />
    );

    const allTab = screen.getByRole('button', { name: /Show All/i });
    const activeTab = screen.getByRole('button', { name: /Show Active/i });
    const candidateTab = screen.getByRole('button', { name: /Show Candidate/i });

    // Focus All tab and press ArrowRight
    allTab.focus();
    expect(allTab).toHaveFocus();

    await user.keyboard('{ArrowRight}');
    expect(activeTab).toHaveFocus();
    expect(activeTab).toHaveAttribute('aria-pressed', 'true');

    await user.keyboard('{ArrowRight}');
    expect(candidateTab).toHaveFocus();
    expect(candidateTab).toHaveAttribute('aria-pressed', 'true');

    await user.keyboard('{ArrowLeft}');
    expect(activeTab).toHaveFocus();
    expect(activeTab).toHaveAttribute('aria-pressed', 'true');

    // Press ArrowDown to jump into list
    await user.keyboard('{ArrowDown}');
    const firstCard = screen.getAllByRole('button', { name: /Toggle note|Compare revisions/i })[0];
    expect(firstCard).toHaveFocus();

    // On card, ArrowDown navigates to next card
    await user.keyboard('{ArrowDown}');
    const secondCard = screen.getAllByRole('button', { name: /Toggle note|Compare revisions/i })[1];
    expect(secondCard).toHaveFocus();

    // ArrowUp navigates back
    await user.keyboard('{ArrowUp}');
    expect(firstCard).toHaveFocus();
  });

  it('realtime_sse_event_triggers_refresh_and_updates_view', async () => {
    const originalEventSource = window.EventSource;

    class MockEventSource {
      static instance: MockEventSource | null = null;
      url: string;
      onmessage: ((e: MessageEvent) => void) | null = null;
      listeners: Record<string, Array<(e: Event) => void>> = {};
      closed = false;

      constructor(url: string) {
        this.url = url;
        MockEventSource.instance = this;
      }

      addEventListener(type: string, listener: (e: Event) => void) {
        if (!this.listeners[type]) this.listeners[type] = [];
        this.listeners[type].push(listener);
      }

      removeEventListener(type: string, listener: (e: Event) => void) {
        if (this.listeners[type]) {
          this.listeners[type] = this.listeners[type].filter((l) => l !== listener);
        }
      }

      emit(type: string, data: unknown) {
        const event = {
          type,
          data: typeof data === 'string' ? data : JSON.stringify(data),
        } as MessageEvent;

        if (type === 'message' && this.onmessage) {
          this.onmessage(event);
        }
        if (this.listeners[type]) {
          this.listeners[type].forEach((l) => l(event));
        }
      }

      close() {
        this.closed = true;
      }
    }

    (window as unknown as { EventSource: unknown }).EventSource = MockEventSource;

    try {
      const { activeNotes, candidateNotes, deactiveNotes } = createMockData();
      const newLiveCandidate: CandidateView = {
        id: 'cand-live-1',
        noteId: 'note-live-1',
        revisionId: 'rev-live-1',
        path: 'engineering/realtime-sync.md',
        title: 'Realtime Sync',
        version: 1,
        expectedSourceHash: 'hash-live-111',
        state: 'pending',
        processing: 'ready',
        markdown: '# Realtime Sync\n\nLive SSE synchronization.',
        previousMarkdown: '',
      };

      const mockApi = createMockApi({
        searchKnowledge: vi.fn().mockImplementation((query) => {
          if (query?.column === 'candidate') {
            return Promise.resolve({
              ok: true,
              value: {
                items: [...candidateNotes, newLiveCandidate],
                total: candidateNotes.length + 1,
              },
            });
          }
          if (query?.column === 'active') {
            return Promise.resolve({
              ok: true,
              value: { items: activeNotes, total: activeNotes.length },
            });
          }
          return Promise.resolve({
            ok: true,
            value: { items: deactiveNotes, total: deactiveNotes.length },
          });
        }),
      });

      render(
        <KnowledgeView
          api={mockApi}
          initialNotes={activeNotes}
          initialCandidates={candidateNotes}
          initialDeactiveNotes={deactiveNotes}
        />
      );

      expect(MockEventSource.instance).not.toBeNull();
      expect(MockEventSource.instance?.url).toBe('/api/v1/events');
      expect(screen.queryByText('engineering/realtime-sync.md')).not.toBeInTheDocument();

      // Trigger SSE event: knowledge.candidate_created
      act(() => {
        MockEventSource.instance?.emit('knowledge.candidate_created', {
          type: 'knowledge.candidate_created',
          payload: { id: 'cand-live-1' },
        });
      });

      // The live note appears in candidate list after refresh
      await waitFor(() => {
        expect(screen.getByText('engineering/realtime-sync.md')).toBeInTheDocument();
      });
    } finally {
      (window as unknown as { EventSource: unknown }).EventSource = originalEventSource;
    }
  });

  it('eventsource_clean_disposal_on_unmount', () => {
    const originalEventSource = window.EventSource;

    class MockEventSource {
      static instance: MockEventSource | null = null;
      url: string;
      onmessage: ((e: MessageEvent) => void) | null = null;
      listeners: Record<string, Array<(e: Event) => void>> = {};
      closed = false;

      constructor(url: string) {
        this.url = url;
        MockEventSource.instance = this;
      }

      addEventListener(type: string, listener: (e: Event) => void) {
        if (!this.listeners[type]) this.listeners[type] = [];
        this.listeners[type].push(listener);
      }

      removeEventListener(type: string, listener: (e: Event) => void) {
        if (this.listeners[type]) {
          this.listeners[type] = this.listeners[type].filter((l) => l !== listener);
        }
      }

      close() {
        this.closed = true;
      }
    }

    (window as unknown as { EventSource: unknown }).EventSource = MockEventSource;

    try {
      const mockApi = createMockApi();
      const { activeNotes, candidateNotes, deactiveNotes } = createMockData();

      const { unmount } = render(
        <KnowledgeView
          api={mockApi}
          initialNotes={activeNotes}
          initialCandidates={candidateNotes}
          initialDeactiveNotes={deactiveNotes}
        />
      );

      const esInstance = MockEventSource.instance;
      expect(esInstance).not.toBeNull();
      expect(esInstance?.closed).toBe(false);

      unmount();

      expect(esInstance?.closed).toBe(true);
      expect(esInstance?.onmessage).toBeNull();
    } finally {
      (window as unknown as { EventSource: unknown }).EventSource = originalEventSource;
    }
  });
});
