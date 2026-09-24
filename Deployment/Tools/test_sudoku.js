'use strict';
const path = require('path');
const S = require(path.resolve(__dirname, '../../Shared/www/sudoku-core.js'));

function assert(cond, msg) { if (!cond) throw new Error(msg); }

const seen = new Set();
for (let i = 0; i < 366; i++) {
  const date = new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10);
  const a = S.daily(date);
  const b = S.daily(date);
  assert(a.puzzle.join('') === b.puzzle.join(''), `Tages-Sudoku ist nicht deterministisch: ${date}`);
  assert(S.countSolutions(a.puzzle, 2) === 1, `Tages-Sudoku ist nicht eindeutig lösbar: ${date}`);
  assert(S.solve(a.puzzle).join('') === a.solution.join(''), `Gespeicherte Lösung passt nicht: ${date}`);
  seen.add(a.puzzle.join(''));
}
assert(seen.size === 366, `Nur ${seen.size}/366 Tages-Sudokus waren verschieden.`);

for (let i = 0; i < 50; i++) {
  const r = S.generate(`preflight-random-${i}`, 32);
  assert(S.countSolutions(r.puzzle, 2) === 1, `Zufalls-Test ${i} ist nicht eindeutig lösbar.`);
}

console.log('Sudoku-Test OK: 366 deterministische, verschiedene und eindeutig lösbare Tages-Sudokus + 50 Generator-Tests.');
