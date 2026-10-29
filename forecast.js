import { rawScore } from './engine.js';
const percent = (v, fallback) => (Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : fallback);
export function assumptions(data) {
  const normal = percent(data.normal, 70);
  return {
    worst: Math.min(normal, percent(data.assumptions?.worst, 50)),
    normal,
    best: Math.max(normal, percent(data.assumptions?.best, 90)),
  };
}
export function changeAssumption(rates, key, value) {
  const next = { ...rates, [key]: percent(value, rates[key]) };
  if (key === 'worst') {
    next.normal = Math.max(next.normal, next.worst);
    next.best = Math.max(next.best, next.normal);
  }
  if (key === 'best') {
    next.normal = Math.min(next.normal, next.best);
    next.worst = Math.min(next.worst, next.normal);
  }
  if (key === 'normal') {
    next.worst = Math.min(next.worst, next.normal);
    next.best = Math.max(next.best, next.normal);
  }
  return next;
}
export function pendingEstimates(semester, percent) {
  return Object.fromEntries(
    semester.subjects
      .flatMap((s) => s.components)
      .filter((c) => rawScore(c) === null)
      .map((c) => [c.id, (c.max * percent) / 100]),
  );
}
