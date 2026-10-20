// Persists in-flight assistant content at most once per interval so an abrupt
// process exit loses only the most recent chunks.
export const createCheckpointer = (
  save: (content: string) => Promise<void>,
  intervalMs = 1000,
  now: () => number = Date.now,
) => {
  let lastSavedAt = now();
  let pending: Promise<void> = Promise.resolve();
  let saving = false;

  return {
    update: (content: string) => {
      if (saving || now() - lastSavedAt < intervalMs) return;
      saving = true;
      lastSavedAt = now();
      pending = save(content)
        .catch(() => undefined)
        .finally(() => {
          saving = false;
        });
    },
    flush: () => pending,
  };
};
