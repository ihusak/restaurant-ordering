import { computed, signal } from '@angular/core';
import type { Signal } from '@angular/core';
import type { Dictionary } from '@ngrx/entity';

export type EditConflict = 'changed' | 'deleted' | null;

/**
 * Tracks an entity that is being edited while the store keeps receiving live
 * updates: tells whether someone else changed or deleted it in the meantime.
 */
export function trackEditConflict<T extends { id: string; rev: number }>(
  original: T | undefined,
  entities: Signal<Dictionary<T>>,
  saving: Signal<boolean>,
) {
  const baseRev = signal(original?.rev ?? 0);
  const latest = computed(() => (original ? entities()[original.id] : undefined));
  const conflict = computed<EditConflict>(() => {
    // While saving, our own change arrives first and is not a conflict.
    if (!original || saving()) return null;
    const current = latest();
    if (!current) return 'deleted';
    return current.rev !== baseRev() ? 'changed' : null;
  });

  return {
    conflict,
    latest,
    /** The form now shows `entity`: newer changes will count as conflicts again. */
    accept(entity: T): void {
      baseRev.set(entity.rev);
    },
  };
}
