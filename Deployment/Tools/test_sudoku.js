'use strict';
const path = require('path');
const S = require(path.resolve(__dirname, '../../Shared/www/sudoku-core.js'));

function assert(cond, msg) { if (!cond) throw new Error(msg); }

const levels = [
  {id:'easy', label:'Leicht', maxSolutions:1, target:40},
  {id:'normal', label:'Normal', maxSolutions:1, target:32},
  {id:'hard', label:'Schwer', maxSolutions:2, target:26},
];

for (const level of levels) {
  const seen = new Set();
  for (let i = 0; i < 366; i++) {
    const date = new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10);
    const a = S.daily(date, level.id);
    const b = S.daily(date, level.id);
    assert(a.puzzle.join('') === b.puzzle.join(''), `${level.label}: Tages-Sudoku ist nicht deterministisch: ${date}`);
    const count = S.countSolutions(a.puzzle, level.maxSolutions + 1);
    assert(count >= 1 && count <= level.maxSolutions, `${level.label}: unzulässige Lösungsanzahl ${count}: ${date}`);
    const first = S.solve(a.puzzle);
    assert(first && first.join('') === a.solution.join(''), `${level.label}: gespeicherte erste Lösung passt nicht: ${date}`);
    assert(a.clues >= level.target, `${level.label}: weniger als ${level.target} Vorgaben: ${date}`);
    seen.add(a.puzzle.join(''));
  }
  assert(seen.size === 366, `${level.label}: nur ${seen.size}/366 Tages-Sudokus waren verschieden.`);
}

// Die bisherige Stufe ist "Normal" und bleibt Standard.
const defaultDaily = S.daily('2026-09-25');
const normalDaily = S.daily('2026-09-25', 'normal');
assert(defaultDaily.puzzle.join('') === normalDaily.puzzle.join(''), 'Normal ist nicht mehr die Standardstufe.');

for (const level of levels) {
  for (let i = 0; i < 30; i++) {
    const r = S.generateDifficulty(`preflight-random-${level.id}-${i}`, level.id);
    const count = S.countSolutions(r.puzzle, level.maxSolutions + 1);
    assert(count >= 1 && count <= level.maxSolutions, `${level.label}: Zufalls-Test ${i} hat ${count} Lösungen.`);
  }
}

// Mehrdeutige Vorgaben: solve() muss deterministisch die erste aktuell mögliche Lösung liefern.
const empty = Array(81).fill(0);
const firstTwo = S.solveAll(empty, 2);
assert(firstTwo.length === 2, 'Leere Vorgabe sollte mindestens zwei Lösungen besitzen.');
assert(S.solve(empty).join('') === firstTwo[0].join(''), 'solve() bevorzugt nicht die erste aktuell mögliche Lösung.');
assert(S.boardValid(firstTwo[0]) && firstTwo[0].every(Boolean), 'Erste Lösung der mehrdeutigen Vorgabe ist ungültig.');

console.log('Sudoku-Test OK: Leicht/Normal eindeutig, Schwer mit 1–2 Lösungen; 3×366 deterministische Tages-Sudokus + 90 Generator-Tests + Mehrdeutigkeits-Test.');
