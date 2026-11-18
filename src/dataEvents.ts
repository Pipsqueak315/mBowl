// Saved-data change notifier (Nov 15 -- S21 / A8, S23 / D2).
//
// Pages load from storage on focus, but two things change saved data while a
// page stays focused: a Restore in the Settings sheet (a pageSheet -- closing it
// fires no focus event), and a History edit/delete while Stats is the other
// half of an open-screen pair (both panes share one focus). Writers call
// notifyDataChanged() after the write lands; pages that hold saved data in
// memory subscribe and re-read, so nothing on screen can write a stale copy
// back over the new data.
/** Who changed the data -- a page ignores its own changes (it already shows them). */
export type DataSource = 'history' | 'settings' | 'log' | 'reference' | 'restore';
type Listener = (source: DataSource) => void;

const listeners = new Set<Listener>();

export function notifyDataChanged(source: DataSource): void {
  listeners.forEach(l => {
    try {
      l(source);
    } catch (e) {
      console.warn('[dataEvents] listener failed', e);
    }
  });
}

/** Subscribe to saved-data changes. Returns the unsubscribe function. */
export function onDataChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
