import { NoteView, CandidateView } from './service';

export interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  text: string;
  lineNumber?: number;
}

export interface NoteItemViewModel {
  id: string;
  path: string;
  title: string;
  version: number;
  contentHash: string;
  activeRevisionId?: string;
  availability: 'available' | 'missing' | 'unsafe';
  markdown: string;
  sanitizedMarkdown: string;
  sharedWithProjectIds: string[];
  isExpanded: boolean;
  column: 'active' | 'deactivated';
  statusColor: 'lime' | 'neutral';
}

export interface CandidateItemViewModel {
  id: string;
  noteId?: string;
  revisionId: string;
  path: string;
  title: string;
  version: number;
  expectedSourceHash: string;
  state: 'pending' | 'approved' | 'rejected' | 'stale';
  stateLabel: string;
  processing: 'pending' | 'ready' | 'failed' | 'budgetBlocked';
  markdown: string;
  previousMarkdown: string;
  sanitizedMarkdown: string;
  sanitizedPreviousMarkdown: string;
  diffLines: DiffLine[];
  isExpanded: boolean;
  statusColor: 'sky' | 'lime' | 'neutral';
}

export interface ColumnViewModel {
  id: 'active' | 'candidate' | 'deactivated';
  label: 'Active' | 'Candidate' | 'Deactive';
  colorToken: 'lime' | 'sky' | 'neutral';
  count: number;
  notes: NoteItemViewModel[];
  candidates: CandidateItemViewModel[];
}

export function sanitizeMarkdown(content: string = ''): string {
  if (!content) return '';
  return content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function computeDiff(oldText: string = '', newText: string = ''): DiffLine[] {
  const oldLines = oldText ? oldText.split('\n') : [];
  const newLines = newText ? newText.split('\n') : [];

  if (oldLines.length === 0 && newLines.length === 0) {
    return [];
  }

  if (oldLines.length === 0) {
    return newLines.map((line, idx) => ({
      type: 'added',
      text: line,
      lineNumber: idx + 1,
    }));
  }

  if (newLines.length === 0) {
    return oldLines.map((line, idx) => ({
      type: 'removed',
      text: line,
      lineNumber: idx + 1,
    }));
  }

  // Classic LCS diff computation
  const m = oldLines.length;
  const n = newLines.length;
  if (m * n > 250_000) {
    return [
      ...oldLines.map((text, index): DiffLine => ({ type: 'removed', text, lineNumber: index + 1 })),
      ...newLines.map((text, index): DiffLine => ({ type: 'added', text, lineNumber: index + 1 })),
    ];
  }
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      if (oldLines[i] === newLines[j]) {
        dp[i + 1][j + 1] = dp[i][j] + 1;
      } else {
        dp[i + 1][j + 1] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  const result: DiffLine[] = [];
  let i = m;
  let j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      result.unshift({
        type: 'unchanged',
        text: oldLines[i - 1],
        lineNumber: j,
      });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({
        type: 'added',
        text: newLines[j - 1],
        lineNumber: j,
      });
      j--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      result.unshift({
        type: 'removed',
        text: oldLines[i - 1],
        lineNumber: i,
      });
      i--;
    }
  }

  return result;
}

export function toNoteItemViewModel(
  note: NoteView,
  column: 'active' | 'deactivated',
  isExpanded: boolean
): NoteItemViewModel {
  const path = note.path || 'untitled.md';
  const title = note.title || path.split('/').pop()?.replace(/\.md$/, '') || path;
  return {
    id: note.id,
    path,
    title,
    version: note.version,
    contentHash: note.contentHash || '',
    activeRevisionId: note.activeRevisionId,
    availability: note.availability,
    markdown: note.markdown || '',
    sanitizedMarkdown: sanitizeMarkdown(note.markdown || ''),
    sharedWithProjectIds: note.sharedWithProjectIds || [],
    isExpanded,
    column,
    statusColor: column === 'active' ? 'lime' : 'neutral',
  };
}

export function toCandidateItemViewModel(
  candidate: CandidateView,
  isExpanded: boolean
): CandidateItemViewModel {
  const path = candidate.path || 'candidate.md';
  const title = candidate.title || path.split('/').pop()?.replace(/\.md$/, '') || path;
  const markdown = candidate.markdown || '';
  const previousMarkdown = candidate.previousMarkdown || '';

  const state = candidate.state || 'pending';
  const processing = candidate.processing || 'pending';

  return {
    id: candidate.id,
    noteId: candidate.noteId,
    revisionId: candidate.revisionId,
    path,
    title,
    version: candidate.version,
    expectedSourceHash: candidate.expectedSourceHash || '',
    state,
    stateLabel: state.charAt(0).toUpperCase() + state.slice(1),
    processing,
    markdown,
    previousMarkdown,
    sanitizedMarkdown: sanitizeMarkdown(markdown),
    sanitizedPreviousMarkdown: sanitizeMarkdown(previousMarkdown),
    diffLines: computeDiff(previousMarkdown, markdown),
    isExpanded,
    statusColor: 'sky',
  };
}

export function filterNote(note: NoteView, query: string): boolean {
  if (!query.trim()) return true;
  const lower = query.toLowerCase();
  const pathMatch = note.path.toLowerCase().includes(lower);
  const titleMatch = Boolean(note.title && note.title.toLowerCase().includes(lower));
  const contentMatch = Boolean(note.markdown && note.markdown.toLowerCase().includes(lower));
  return pathMatch || titleMatch || contentMatch;
}

export function filterCandidate(candidate: CandidateView, query: string): boolean {
  if (!query.trim()) return true;
  const lower = query.toLowerCase();
  const pathMatch = Boolean(candidate.path && candidate.path.toLowerCase().includes(lower));
  const titleMatch = Boolean(candidate.title && candidate.title.toLowerCase().includes(lower));
  const contentMatch = Boolean(candidate.markdown && candidate.markdown.toLowerCase().includes(lower));
  return pathMatch || titleMatch || contentMatch;
}

export function transformKnowledgePageToColumns(
  items: Array<NoteView | CandidateView>,
  expandedIds: Record<string, boolean> = {}
): ColumnViewModel[] {
  const activeNotes: NoteItemViewModel[] = [];
  const candidates: CandidateItemViewModel[] = [];
  const deactiveNotes: NoteItemViewModel[] = [];

  for (const item of items) {
    if ('expectedSourceHash' in item || 'processing' in item) {
      candidates.push(toCandidateItemViewModel(item as CandidateView, Boolean(expandedIds[item.id])));
    } else {
      const noteRecord = item as NoteView & { state?: string; column?: string };
      const isDeactivated =
        noteRecord.state === 'deactivated' ||
        noteRecord.state === 'deactive' ||
        noteRecord.column === 'deactivated';

      if (isDeactivated) {
        deactiveNotes.push(toNoteItemViewModel(noteRecord, 'deactivated', Boolean(expandedIds[noteRecord.id])));
      } else {
        activeNotes.push(toNoteItemViewModel(noteRecord, 'active', Boolean(expandedIds[noteRecord.id])));
      }
    }
  }

  return [
    {
      id: 'active',
      label: 'Active',
      colorToken: 'lime',
      count: activeNotes.length,
      notes: activeNotes,
      candidates: [],
    },
    {
      id: 'candidate',
      label: 'Candidate',
      colorToken: 'sky',
      count: candidates.length,
      notes: [],
      candidates,
    },
    {
      id: 'deactivated',
      label: 'Deactive',
      colorToken: 'neutral',
      count: deactiveNotes.length,
      notes: deactiveNotes,
      candidates: [],
    },
  ];
}
