// node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeState, bestMove, legalMoves, applyMove, BOMB } from '../js/hint.js';

const X = 5; // cor que não aparece no fundo
// Fundo sem trincas: vizinhos na linha diferem em 2 (mod 5) e na coluna em 1.
function board(marks, opts = {}) {
  const grid = [];
  for (let r = 0; r < 8; r++) { grid.push([]); for (let c = 0; c < 8; c++) grid[r].push({ t: (r + 2 * c) % 5, s: 0 }); }
  for (const [r, c, t = X, s = 0] of marks) grid[r][c] = { t, s };
  const jelly = Array.from({ length: 8 }, (_, r) => Array.from({ length: 8 }, (_, c) => (opts.jelly?.(r, c) ? 1 : 0)));
  return makeState({ rows: 8, cols: 8, grid, jelly, kind: opts.kind || 'score', moves: opts.moves ?? 20, target: 99999, colors: 6 });
}
const same = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());

test('prefere formar bomba (5) a uma trinca simples', () => {
  const st = board([[0, 0], [0, 1], [1, 2], // trinca no topo
    [7, 0], [7, 1], [7, 3], [7, 4], [6, 2]]); // 5 na base
  const h = bestMove(st);
  assert.ok(same(h.move, [[6, 2], [7, 2]]), JSON.stringify(h.move));
  assert.match(h.text, /bomba/);
});

test('na fase de geleia, joga onde tem geleia', () => {
  const st = board([[1, 0], [1, 1], [2, 2], [4, 5], [4, 6], [5, 7]], { kind: 'jelly', jelly: (r, c) => (r === 4 && c >= 5) || (r === 7 && c === 0) });
  const h = bestMove(st);
  assert.ok(same(h.move, [[4, 7], [5, 7]]), JSON.stringify(h.move));
  assert.match(h.text, /geleia/);
});

test('com vitória disponível, avisa que vence', () => {
  const st = board([[1, 0], [1, 1], [2, 2], [4, 5], [4, 6], [5, 7]], { kind: 'jelly', moves: 1, jelly: (r, c) => r === 1 && c <= 2 });
  const h = bestMove(st);
  assert.ok(same(h.move, [[1, 2], [2, 2]]), JSON.stringify(h.move));
  assert.match(h.text, /vence/);
});

test('junta dois especiais vizinhos em vez de gastar com trinca', () => {
  const st = board([[3, 3, 0, 1], [3, 4, 1, 3], [0, 0], [0, 1], [1, 2]]);
  const h = bestMove(st);
  assert.ok(same(h.move, [[3, 3], [3, 4]]), JSON.stringify(h.move));
  assert.match(h.text, /cruz tripla/);
});

test('bomba trocada com doce remove a cor', () => {
  const st = board([[4, 4, 0, BOMB]]);
  assert.ok(legalMoves(st).length >= 4);
  const acc = applyMove(st, [[4, 4], [4, 5]]);
  assert.equal(acc.combo, 'bomb');
  assert.ok(acc.points > 0);
});
