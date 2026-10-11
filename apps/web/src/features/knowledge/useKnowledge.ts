'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { Scope, Project } from '@zhon/contracts';
import {
  KnowledgeService,
  KnowledgeApiClient,
  NoteView,
  CandidateView,
} from './service';
import {
  ColumnViewModel,
  CandidateItemViewModel,
  NoteItemViewModel,
  DiffLine,
  toNoteItemViewModel,
  toCandidateItemViewModel,
  filterNote,
  filterCandidate,
} from './view-model';

export interface UseKnowledgeOptions {
  api?: KnowledgeApiClient;
  scope?: Scope;
  initialNotes?: NoteView[];
  initialCandidates?: CandidateView[];
  initialDeactiveNotes?: NoteView[];
  availableProjectIds?: string[];
  eventsUrl?: string;
}

export function useKnowledge(
  optionsOrScope?: Scope | UseKnowledgeOptions,
  maybeApi?: KnowledgeApiClient
) {
  const options: UseKnowledgeOptions = useMemo(() => {
    if (!optionsOrScope) return {};
    if ('kind' in optionsOrScope) {
      return { scope: optionsOrScope, api: maybeApi };
    }
    return optionsOrScope;
  }, [optionsOrScope, maybeApi]);

  const service = useMemo(() => new KnowledgeService(options.api), [options.api]);

  const [activeNotes, setActiveNotes] = useState<NoteView[]>(options.initialNotes || []);
  const [candidates, setCandidates] = useState<CandidateView[]>(options.initialCandidates || []);
  const [deactiveNotes, setDeactiveNotes] = useState<NoteView[]>(options.initialDeactiveNotes || []);
  const [history, setHistory] = useState<CandidateView[]>([]);
  const [projectIds, setProjectIds] = useState<string[]>(options.availableProjectIds || []);

  useEffect(() => {
    let current = true;
    if (options.api && !options.availableProjectIds) {
      void options.api.query<Project[]>('projects').then(result => {
        if (current && result.ok && Array.isArray(result.value)) setProjectIds(result.value.map(project => project.id));
      }).catch(() => {});
    }
    return () => { current = false; };
  }, [options.api, options.availableProjectIds]);

  const [query, setQuery] = useState<string>('');
  const [activeColumnTab, setActiveColumnTab] = useState<'all' | 'active' | 'candidate' | 'deactivated'>('all');
  const [pending, setPending] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [selectedItem, setSelectedItem] = useState<NoteItemViewModel | CandidateItemViewModel | null>(null);

  // Share drawer state
  const [shareDrawerTargetNoteId, setShareDrawerTargetNoteId] = useState<string | null>(null);
  const [selectedShareProjectIds, setSelectedShareProjectIds] = useState<string[]>([]);

  // Motion detection
  const [reducedMotion, setReducedMotion] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      try {
        return Boolean(window.matchMedia('(prefers-reduced-motion: reduce)')?.matches);
      } catch {
        return false;
      }
    }
    return false;
  });

  useEffect(() => {
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      try {
        const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        if (mediaQuery) {
          const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
          if (mediaQuery.addEventListener) {
            mediaQuery.addEventListener('change', handler);
            return () => mediaQuery.removeEventListener('change', handler);
          }
        }
      } catch {
        // graceful fallback
      }
    }
  }, []);

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  }, []);

  // Filtered lists
  const filteredActiveNotes = useMemo(() => {
    return activeNotes.filter((n) => filterNote(n, query));
  }, [activeNotes, query]);

  const filteredCandidates = useMemo(() => {
    return candidates.filter((c) => filterCandidate(c, query));
  }, [candidates, query]);

  const filteredDeactiveNotes = useMemo(() => {
    return deactiveNotes.filter((n) => filterNote(n, query));
  }, [deactiveNotes, query]);

  // Prepared candidate item view models
  const candidateList = useMemo<CandidateItemViewModel[]>(() => {
    return filteredCandidates.map((c) =>
      toCandidateItemViewModel(c, Boolean(expandedIds[c.id]))
    );
  }, [filteredCandidates, expandedIds]);

  // Prepared 3-column view models
  const columns = useMemo<ColumnViewModel[]>(() => {
    const activeCol: ColumnViewModel = {
      id: 'active',
      label: 'Active',
      colorToken: 'lime',
      count: filteredActiveNotes.length,
      notes: filteredActiveNotes.map((n) =>
        toNoteItemViewModel(n, 'active', Boolean(expandedIds[n.id]))
      ),
      candidates: [],
    };

    const candidateCol: ColumnViewModel = {
      id: 'candidate',
      label: 'Candidate',
      colorToken: 'sky',
      count: filteredCandidates.length,
      notes: [],
      candidates: candidateList,
    };

    const deactiveCol: ColumnViewModel = {
      id: 'deactivated',
      label: 'Deactive',
      colorToken: 'neutral',
      count: filteredDeactiveNotes.length,
      notes: filteredDeactiveNotes.map((n) =>
        toNoteItemViewModel(n, 'deactivated', Boolean(expandedIds[n.id]))
      ),
      candidates: [],
    };

    return [activeCol, candidateCol, deactiveCol];
  }, [filteredActiveNotes, filteredCandidates.length, candidateList, filteredDeactiveNotes, expandedIds]);

  const approve = useCallback(
    async (candidateId: string): Promise<boolean> => {
      if (pending) return false;
      const cand = candidates.find((c) => c.id === candidateId);
      if (!cand) return false;

      setPending(true);
      setError(null);

      try {
        const res = await service.approveCandidate({
          candidateId: cand.id,
          candidateVersion: cand.version,
          expectedSourceHash: cand.expectedSourceHash,
        });

        if (!res.ok) {
          const errMsg = 'error' in res ? res.error.message : 'Approval failed';
          const errCode = 'error' in res ? res.error.code : '';
          if (
            errCode === 'STALE_CANDIDATE' ||
            errMsg.includes('This candidate changed')
          ) {
            setError('This candidate changed. Refresh before approving.');
          } else {
            setError(errMsg);
          }
          setPending(false);
          return false;
        }

        // Successfully approved: update candidate and active list
        const promoted = res.value;
        setCandidates((prev) => prev.filter((c) => c.id !== candidateId));
        setActiveNotes((prev) => {
          const exists = prev.some((n) => n.id === promoted.id);
          if (exists) {
            return prev.map((n) => (n.id === promoted.id ? { ...n, ...promoted } : n));
          }
          return [
            ...prev,
            {
              ...promoted,
              markdown: cand.markdown,
              contentHash: cand.expectedSourceHash,
            },
          ];
        });

        setPending(false);
        return true;
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Approval failed');
        setPending(false);
        return false;
      }
    },
    [pending, candidates, service]
  );

  const reject = useCallback(
    async (candidateId: string): Promise<boolean> => {
      if (pending) return false;
      const cand = candidates.find((c) => c.id === candidateId);
      if (!cand) return false;

      setPending(true);
      setError(null);

      try {
        const res = await service.rejectCandidate({
          candidateId: cand.id,
          candidateVersion: cand.version,
          expectedSourceHash: cand.expectedSourceHash,
        });

        if (!res.ok) {
          setError('error' in res ? res.error.message : 'Rejection failed');
          setPending(false);
          return false;
        }

        setCandidates((prev) => prev.filter((c) => c.id !== candidateId));
        setPending(false);
        return true;
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Rejection failed');
        setPending(false);
        return false;
      }
    },
    [pending, candidates, service]
  );

  const deactivate = useCallback(
    async (noteId: string): Promise<boolean> => {
      if (pending) return false;
      const note = [...activeNotes, ...deactiveNotes].find((n) => n.id === noteId);
      if (!note) return false;

      setPending(true);
      setError(null);

      try {
        const res = await service.deactivateNote(note.id, note.version);
        if (!res.ok) {
          setError('error' in res ? res.error.message : 'Deactivation failed');
          setPending(false);
          return false;
        }

        setActiveNotes((prev) => prev.filter((n) => n.id !== noteId));
        setDeactiveNotes((prev) => [...prev, { ...note, ...res.value }]);
        setPending(false);
        return true;
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Deactivation failed');
        setPending(false);
        return false;
      }
    },
    [pending, activeNotes, deactiveNotes, service]
  );

  const rollback = useCallback(
    async (noteId: string, revisionId: string): Promise<boolean> => {
      if (pending) return false;
      const note = [...activeNotes, ...deactiveNotes].find((n) => n.id === noteId);
      if (!note) return false;

      setPending(true);
      setError(null);

      try {
        const res = await service.rollbackNote(note.id, revisionId, note.version);
        if (!res.ok) {
          setError('error' in res ? res.error.message : 'Rollback failed');
          setPending(false);
          return false;
        }

        setActiveNotes((prev) => [...prev.filter(n => n.id !== noteId), res.value]);
        setDeactiveNotes(prev => prev.filter(n => n.id !== noteId));
        setPending(false);
        return true;
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Rollback failed');
        setPending(false);
        return false;
      }
    },
    [pending, activeNotes, deactiveNotes, service]
  );

  const openShareDrawer = useCallback((noteId: string) => {
    const note = activeNotes.find((n) => n.id === noteId);
    if (!note) return;
    setShareDrawerTargetNoteId(noteId);
    setSelectedShareProjectIds(note.sharedWithProjectIds || []);
  }, [activeNotes]);

  const closeShareDrawer = useCallback(() => {
    setShareDrawerTargetNoteId(null);
    setSelectedShareProjectIds([]);
  }, []);

  const toggleShareProjectId = useCallback((projectId: string) => {
    setSelectedShareProjectIds((prev) => {
      if (prev.includes(projectId)) {
        return prev.filter((p) => p !== projectId);
      }
      return [...prev, projectId];
    });
  }, []);

  const share = useCallback(
    async (noteId: string, projectIds: string[]): Promise<boolean> => {
      if (pending) return false;
      const note = activeNotes.find((n) => n.id === noteId);
      if (!note) return false;

      setPending(true);
      setError(null);

      try {
        const res = await service.shareNote({
          noteId: note.id,
          expectedVersion: note.version,
          expectedActiveHash: note.contentHash || '',
          projectIds,
        });

        if (!res.ok) {
          setError('error' in res ? res.error.message : 'Share failed');
          setPending(false);
          return false;
        }

        setActiveNotes((prev) =>
          prev.map((n) => (n.id === noteId ? { ...n, ...res.value } : n))
        );
        closeShareDrawer();
        setPending(false);
        return true;
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Share failed');
        setPending(false);
        return false;
      }
    },
    [pending, activeNotes, service, closeShareDrawer]
  );

  const shareTargetNote = useMemo(() => {
    if (!shareDrawerTargetNoteId) return null;
    const note = activeNotes.find((n) => n.id === shareDrawerTargetNoteId);
    if (!note) return null;
    return toNoteItemViewModel(note, 'active', false);
  }, [shareDrawerTargetNoteId, activeNotes]);

  const diff = useMemo<DiffLine[]>(() => {
    if (!selectedItem) {
      const expandedCand = candidateList.find((c) => c.isExpanded);
      return expandedCand ? expandedCand.diffLines : [];
    }
    if ('diffLines' in selectedItem) {
      return selectedItem.diffLines;
    }
    return [];
  }, [selectedItem, candidateList]);

  const refresh = useCallback(async () => {
    if (!options.api) return;
    setLoading(true);
    setError(null);
    try {
      const scope = options.scope || { kind: 'global' };
      const [activeRes, candidateRes, deactRes, historyRes] = await Promise.all([
        service.searchKnowledge({ scope, column: 'active', text: query || undefined, limit: 100 }),
        service.searchKnowledge({ scope, column: 'candidate', text: query || undefined, limit: 100 }),
        service.searchKnowledge({ scope, column: 'deactivated', text: query || undefined, limit: 100 }),
        service.searchKnowledge({ scope, column: 'history', text: query || undefined, limit: 100 }),
      ]);
      const failed = [activeRes, candidateRes, deactRes, historyRes].find(result => !result.ok);
      if (failed && 'error' in failed) setError(failed.error.message);
      if (historyRes.ok) setHistory(historyRes.value.items as CandidateView[]);

      if (activeRes.ok) {
        setActiveNotes(activeRes.value.items as NoteView[]);
      }
      if (candidateRes.ok) {
        setCandidates(candidateRes.value.items as CandidateView[]);
      }
      if (deactRes.ok) {
        setDeactiveNotes(deactRes.value.items as NoteView[]);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to refresh knowledge');
    } finally {
      setLoading(false);
    }
  }, [options.api, options.scope, query, service]);

  useEffect(() => {
    let mounted = true;
    void Promise.resolve().then(() => {
      if (mounted) {
        void refresh();
      }
    });
    return () => {
      mounted = false;
    };
  }, [refresh]);

  // Real-time SSE event consumption and disposal
  useEffect(() => {
    const refreshFromEvent = (event: { payload?: unknown }) => {
      const payload = event.payload as { issue?: { code?: unknown } } | undefined;
      const code = payload?.issue?.code;
      void refresh().then(() => {
        if (typeof code === 'string' && /^[A-Z_]+$/.test(code)) {
          setError(`Note update blocked (${code}). Check the source and rescan the vault.`);
        }
      });
    };
    let apiUnsubscribe: (() => void) | undefined;
    if (options.api?.subscribe) {
      apiUnsubscribe = options.api.subscribe(0, (event: unknown) => {
        if (!event || typeof event !== 'object') return;
        const type = (event as { type?: string }).type;
        if (
          type === 'knowledge.candidate_created' || type === 'knowledge.scan_completed' ||
          type === 'knowledge.note_updated' ||
          type === 'knowledge.candidate_approved' ||
          type === 'knowledge.candidate_rejected' ||
          type === 'knowledge.note_deactivated'
        ) {
          refreshFromEvent(event);
        }
      });
    }

    let es: EventSource | null = null;
    const EventSourceCtor = options.api?.subscribe ? undefined :
      typeof window !== 'undefined' && window.EventSource
        ? window.EventSource
        : typeof EventSource !== 'undefined'
          ? EventSource
          : undefined;

    const handleEvent = (e: Event | MessageEvent) => {
      const msgEvent = e as MessageEvent;
      if (typeof msgEvent.data === 'string') {
        try {
          const parsed = JSON.parse(msgEvent.data);
          const type = parsed?.type || e.type;
          if (
            type === 'knowledge.candidate_created' ||
            type === 'knowledge.note_updated' ||
            type === 'knowledge.candidate_approved' ||
            type === 'knowledge.candidate_rejected' ||
            type === 'knowledge.note_deactivated'
          ) {
            refreshFromEvent(parsed);
            return;
          }
        } catch {
          // ignore parse errors
        }
      }
      if (
        e.type === 'knowledge.candidate_created' ||
        e.type === 'knowledge.note_updated' ||
        e.type === 'knowledge.candidate_approved' ||
        e.type === 'knowledge.candidate_rejected' ||
        e.type === 'knowledge.note_deactivated'
      ) {
        void refresh();
      }
    };

    if (EventSourceCtor) {
      const eventsUrl = options.eventsUrl || '/api/v1/events';
      try {
        es = new EventSourceCtor(eventsUrl);
      } catch {
        // graceful fallback if EventSource cannot connect
      }

      if (es) {
        es.onmessage = handleEvent as (this: EventSource, ev: MessageEvent) => unknown;
        if (typeof es.addEventListener === 'function') {
          es.addEventListener('knowledge.candidate_created', handleEvent);
          es.addEventListener('knowledge.note_updated', handleEvent);
          es.addEventListener('knowledge.candidate_approved', handleEvent);
          es.addEventListener('knowledge.candidate_rejected', handleEvent);
          es.addEventListener('knowledge.note_deactivated', handleEvent);
        }
      }
    }

    return () => {
      if (typeof apiUnsubscribe === 'function') {
        apiUnsubscribe();
      }
      if (es) {
        if (typeof es.removeEventListener === 'function') {
          es.removeEventListener('knowledge.candidate_created', handleEvent);
          es.removeEventListener('knowledge.note_updated', handleEvent);
          es.removeEventListener('knowledge.candidate_approved', handleEvent);
          es.removeEventListener('knowledge.candidate_rejected', handleEvent);
          es.removeEventListener('knowledge.note_deactivated', handleEvent);
        }
        es.onmessage = null;
        if (typeof es.close === 'function') {
          es.close();
        }
      }
    };
  }, [options.api, options.eventsUrl, refresh]);

  return {
    history,
    projectIds,
    columns,
    activeColumnTab,
    setActiveColumnTab,
    query,
    setQuery,
    pending,
    loading,
    error,
    setError,
    reducedMotion,
    activeNotes,
    candidates,
    deactiveNotes,
    candidateList,
    selectedItem,
    setSelectedItem,
    diff,
    approve,
    reject,
    deactivate,
    rollback,
    share,
    refresh,
    expandedIds,
    toggleExpand,
    shareDrawerOpen: Boolean(shareDrawerTargetNoteId),
    shareTargetNote,
    selectedShareProjectIds,
    openShareDrawer,
    closeShareDrawer,
    toggleShareProjectId,
  };
}
