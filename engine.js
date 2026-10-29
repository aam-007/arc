export const excelScale = () => [
  { min: 0, label: 'Below pass', points: 0 },
  { min: 50, label: 'C', points: 5 },
  { min: 55, label: 'B', points: 6 },
  { min: 60, label: 'B+', points: 7 },
  { min: 70, label: 'A', points: 8 },
  { min: 80, label: 'A+', points: 9 },
  { min: 90, label: 'O', points: 10 },
];
export const uid = () => globalThis.crypto.randomUUID();
export function preset(mode) {
  return mode === 'standard'
    ? [
        { name: 'ICA', max: 50, weight: 50, score: null },
        { name: 'TEE', max: 100, weight: 50, score: null },
      ]
    : mode === 'double'
      ? [{ name: 'ICA', max: 50, weight: 100, score: null }]
      : [{ name: 'Assessment', max: 100, weight: 100, score: null }];
}
export const defaultScale = () =>
  excelScale().map((b) => ({ ...b, min: b.min === 50 ? 40 : b.min }));
export function config() {
  return { maxPoints: 10, pass: 40, round: 'none', eligible: 'all', scale: defaultScale() };
}
// Correct saved default setups without changing custom scales or subject overrides.
export function upgradeDefaultGrading(profile) {
  let changed = false;
  for (const s of [...(profile.semesters || []), profile.draft].filter(Boolean)) {
    const g = s.grading;
    if (['custom', 'template'].includes(s.gradeChoice) || !g || g.pass !== 50 || g.maxPoints !== 10)
      continue;
    const old = excelScale(),
      bands = [...g.scale].sort((a, b) => a.min - b.min);
    if (
      bands.length !== old.length ||
      bands.some(
        (b, i) => b.min !== old[i].min || b.label !== old[i].label || b.points !== old[i].points,
      )
    )
      continue;
    g.pass = 40;
    g.scale = g.scale.map((b) => ({ ...b, min: b.min === 50 ? 40 : b.min }));
    changed = true;
  }
  return changed;
}
export const blankSubject = () => ({
  id: uid(),
  name: '',
  code: '',
  type: 'Theory',
  credits: '',
  mode: 'weighted',
  components: preset('weighted').map((c) => ({ ...c, id: uid() })),
  grading: null,
});
export function rawScore(c) {
  if (c.average) {
    if (c.scores?.some((x) => x === null) || !c.scores?.length) return null;
    const mean = c.scores.reduce((a, b) => a + b, 0) / c.scores.length;
    return c.ceil2 ? Math.ceil((mean - 1e-12) * 100) / 100 : mean;
  }
  return c.score;
}
export function mark(s, assumption = null, custom = {}) {
  let sum = 0;
  for (const c of s.components) {
    let v = rawScore(c);
    if (v === null) {
      if (assumption === null) return null;
      const estimate = Math.max(0, Math.min(c.max, custom[c.id] ?? c.max * assumption));
      if (c.average) {
        const values = c.scores.map((x) => (x === null ? estimate : x));
        v = values.reduce((a, b) => a + b, 0) / values.length;
        if (c.ceil2) v = Math.ceil((v - 1e-12) * 100) / 100;
      } else v = estimate;
    }
    sum += (v / c.max) * c.weight;
  }
  return sum;
}
export function grade(value, g) {
  if (value === null) return null;
  let v = value;
  if (g.round === 'nearest') v = Math.round(v);
  if (g.round === 'floor') v = Math.floor(v);
  if (g.round === 'ceil') v = Math.ceil(v);
  const band = [...g.scale].sort((a, b) => b.min - a.min).find((x) => v >= x.min);
  return { ...band, points: v < g.pass ? 0 : (band?.points ?? 0), marks: v };
}
export function result(s, g, assumption = null, custom = {}) {
  const value = mark(s, assumption, custom),
    gr = grade(value, s.grading || g);
  return {
    value,
    grade: gr,
    weighted: gr === null ? null : gr.points * Number(s.credits),
    complete: mark(s) !== null,
  };
}
export function stats(sem, assumption = null, custom = {}) {
  let credits = 0,
    eligible = 0,
    points = 0,
    completed = 0,
    count = 0;
  for (const s of sem.subjects) {
    const r = result(s, sem.grading, assumption, custom);
    credits += +s.credits;
    if (r.complete) completed += +s.credits;
    if (r.grade) {
      count++;
      if (sem.grading.eligible !== 'passed' || r.grade.points > 0) {
        eligible += +s.credits;
        points += r.weighted;
      }
    }
  }
  return {
    credits,
    eligible,
    points,
    completed,
    count,
    gpa: eligible ? points / eligible : null,
    official: sem.subjects.length > 0 && count === sem.subjects.length && assumption === null,
  };
}
export function cgpa(semesters) {
  let points = 0,
    credits = 0;
  for (const s of semesters) {
    const t = stats(s);
    if (t.official) {
      points += t.points;
      credits += t.eligible;
    }
  }
  return credits ? points / credits : null;
}
const numeric = (value) =>
  (typeof value === 'number' || (typeof value === 'string' && value.trim() !== '')) &&
  Number.isFinite(Number(value));
export function validateSubject(subject) {
  if (!subject || typeof subject.name !== 'string' || !subject.name.trim())
    return 'Give every subject a name.';
  if (!numeric(subject.credits) || Number(subject.credits) <= 0)
    return 'Credits must be greater than zero.';
  if (!Array.isArray(subject.components) || !subject.components.length)
    return 'Add at least one assessment.';
  let weight = 0;
  for (const component of subject.components) {
    if (
      !component ||
      typeof component.name !== 'string' ||
      !component.name.trim() ||
      !numeric(component.max) ||
      Number(component.max) <= 0 ||
      !numeric(component.weight) ||
      Number(component.weight) <= 0
    )
      return 'Assessment names, positive maxima and weights are required.';
    if (component.average && (!Array.isArray(component.scores) || component.scores.length !== 2))
      return 'A quiz average requires exactly two score fields.';
    for (const score of component.average ? component.scores : [component.score]) {
      if (
        score !== null &&
        (typeof score !== 'number' ||
          !Number.isFinite(score) ||
          score < 0 ||
          score > Number(component.max))
      )
        return 'Scores must lie between zero and their maximum.';
    }
    weight += Number(component.weight);
  }
  return Math.abs(weight - 100) > 1e-8 ? 'Assessment weights must add up to 100%.' : '';
}
export function validateGrading(grading) {
  if (
    !grading ||
    !numeric(grading.maxPoints) ||
    Number(grading.maxPoints) <= 0 ||
    !numeric(grading.pass) ||
    Number(grading.pass) < 0 ||
    Number(grading.pass) > 100
  )
    return 'Check the grading maximum and pass threshold.';
  if (
    !['none', 'nearest', 'floor', 'ceil'].includes(grading.round) ||
    !['all', 'passed'].includes(grading.eligible)
  )
    return 'Choose valid rounding and credit eligibility rules.';
  if (!Array.isArray(grading.scale) || !grading.scale.length)
    return 'Include a grade boundary starting at zero.';
  if (
    grading.scale.some(
      (band) =>
        !band ||
        typeof band.label !== 'string' ||
        !band.label.trim() ||
        !numeric(band.min) ||
        Number(band.min) < 0 ||
        Number(band.min) > 100 ||
        !numeric(band.points) ||
        Number(band.points) < 0 ||
        Number(band.points) > Number(grading.maxPoints),
    )
  )
    return 'Check grade labels, boundaries and points.';
  if (!grading.scale.some((band) => Number(band.min) === 0))
    return 'Include a grade boundary starting at zero.';
  if (new Set(grading.scale.map((band) => Number(band.min))).size !== grading.scale.length)
    return 'Grade boundaries must be unique.';
  const ascending = [...grading.scale].sort((a, b) => a.min - b.min);
  return ascending.some(
    (band, index) => index && Number(band.points) < Number(ascending[index - 1].points),
  )
    ? 'Grade points must increase with marks.'
    : '';
}
// Minimum raw additional marks. Every attainable grade is a discrete option;
// dominated combinations are removed without rounding credit-weighted points.
export function reach(s, g, boundary) {
  if (s.components.some((c) => c.average && rawScore(c) === null)) return null;
  const cfg = s.grading || g;
  let threshold = boundary;
  if (cfg.round === 'nearest') threshold = Math.max(0, boundary - 0.5);
  if (cfg.round === 'ceil') threshold = Math.max(0, boundary - 1 + 1e-8);
  let need = threshold - (mark(s, 0) || 0),
    cost = 0,
    custom = {};
  for (const c of [...s.components]
    .filter((c) => rawScore(c) === null)
    .sort((a, b) => b.weight / b.max - a.weight / a.max)) {
    const v = Math.min(c.max, (Math.max(0, need) * c.max) / c.weight);
    custom[c.id] = v;
    cost += v;
    need -= (v / c.max) * c.weight;
  }
  return need > 1e-7 ? null : { cost, custom };
}
export function solve(sem, target) {
  if (sem.grading.eligible === 'passed')
    return {
      unsupported: true,
      reason: 'The exact solver requires all registered credits in the denominator.',
    };
  if (sem.subjects.some((s) => s.components.some((c) => c.average && rawScore(c) === null)))
    return {
      unsupported: true,
      reason:
        'The exact minimum-marks solver requires linear pending components. Enter remaining quiz scores first; forecasts still preserve each recorded quiz.',
    };
  const best = stats(sem, 1),
    worst = stats(sem, 0);
  if (!best.credits) return { empty: true };
  if (target > best.gpa + 1e-9) return { impossible: true, max: best.gpa };
  let frontier = [{ points: 0, cost: 0, path: [] }];
  for (const s of sem.subjects) {
    const g = s.grading || sem.grading;
    const options = [];
    for (const b of [{ min: 0 }, { min: g.pass }, ...g.scale]) {
      const req = reach(s, g, b.min);
      if (req) {
        const r = result(s, sem.grading, 0, req.custom);
        if (!options.some((x) => x.points === r.weighted))
          options.push({ ...req, points: r.weighted });
      }
    }
    const all = frontier
      .flatMap((f) =>
        options.map((o) => ({
          points: f.points + o.points,
          cost: f.cost + o.cost,
          path: [...f.path, { id: s.id, ...o }],
        })),
      )
      .sort((a, b) => b.points - a.points || a.cost - b.cost);
    let min = Infinity;
    frontier = [];
    for (const f of all)
      if (f.cost < min - 1e-9) {
        frontier.push(f);
        min = f.cost;
      }
  }
  const answer = frontier
    .filter((f) => f.points / best.credits >= target - 1e-9)
    .sort((a, b) => a.cost - b.cost)[0];
  return answer
    ? { ...answer, max: best.gpa, min: worst.gpa, gpa: answer.points / best.credits }
    : { impossible: true, max: best.gpa };
}
