import { describe, expect, it } from 'vitest';
import { canRedo, canUndo, commit, createHistory, redo, undo } from '@/utils/history';

describe('history', () => {
  it('commit empile le présent dans le passé et vide le futur', () => {
    let h = createHistory(0);
    h = commit(h, 1);
    h = commit(h, 2);
    expect(h.present).toBe(2);
    expect(h.past).toEqual([0, 1]);
    expect(h.future).toEqual([]);
  });

  it("undo / redo font l'aller-retour", () => {
    let h = createHistory('a');
    h = commit(h, 'b');
    h = commit(h, 'c');

    h = undo(h);
    expect(h.present).toBe('b');
    expect(canRedo(h)).toBe(true);

    h = undo(h);
    expect(h.present).toBe('a');
    expect(canUndo(h)).toBe(false);

    h = redo(h);
    expect(h.present).toBe('b');
    h = redo(h);
    expect(h.present).toBe('c');
    expect(canRedo(h)).toBe(false);
  });

  it('un commit après un undo écrase le futur', () => {
    let h = createHistory(0);
    h = commit(h, 1);
    h = undo(h); // present 0, future [1]
    h = commit(h, 9);
    expect(h.present).toBe(9);
    expect(h.future).toEqual([]);
    expect(h.past).toEqual([0]);
  });

  it('respecte la limite de profondeur', () => {
    let h = createHistory(0);
    for (let i = 1; i <= 5; i += 1) h = commit(h, i, 3);
    expect(h.past.length).toBe(3);
    expect(h.present).toBe(5);
    expect(h.past).toEqual([2, 3, 4]);
  });

  it('undo / redo sont des no-op aux extrémités', () => {
    const h = createHistory(0);
    expect(undo(h)).toBe(h);
    expect(redo(h)).toBe(h);
  });
});
