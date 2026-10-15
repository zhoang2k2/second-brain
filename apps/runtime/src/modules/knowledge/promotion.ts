import { Store } from '../../storage/database';
import { KnowledgeRepository } from './repository';
import { RevisionStore } from './revision-store';

export async function reconcilePromotions(
  store: Store,
  repo: KnowledgeRepository,
  clock?: () => string,
  revisionStore?: RevisionStore
): Promise<{ completed: number; blocked: number }> {
  const now = clock ? clock() : new Date().toISOString();
  let completed = 0;
  let blocked = 0;

  return store.transaction(() => {
    const pending = repo.findPendingPromotions(store.connection);

    for (const promo of pending) {
      const note = repo.findNoteById(store.connection, promo.note_id);
      if (note && note.current_revision_id === promo.revision_id) {
        // Pointer was swapped before crash: finalize promotion
        const rev = repo.findRevisionById(store.connection, promo.revision_id);
        if (!rev || rev.note_id !== note.id || rev.hash !== promo.source_hash || rev.status !== 'approved' || rev.state !== 'active' || !revisionStore?.matchesSnapshot(rev.content, rev.hash)) {
          repo.deleteFts(store.connection, note.id);
          repo.updatePromotion(store.connection, promo.id, 'blocked', 'SNAPSHOT_INTEGRITY', now);
          blocked++;
          continue;
        }
        repo.upsertFts(store.connection, note.id, rev.id, note.title, rev.content);
        repo.updatePromotion(store.connection, promo.id, 'completed', null, now);
        completed++;
      } else {
        // Interrupted before pointer was swapped: keep old active pointer intact
        repo.updatePromotion(
          store.connection,
          promo.id,
          'blocked',
          'INTERRUPTED_BEFORE_POINTER',
          now
        );
        blocked++;
      }
    }

    return { completed, blocked };
  });
}
