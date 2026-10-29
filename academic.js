import { stats } from './engine.js';
export const emptyAcademic = () => ({ mode: 'none', cgpa: '', credits: '', history: [] });
const entered = (x) => x !== '' && x !== null && x !== undefined;
export function validateAcademic(a, semester, maxPoints) {
  if (!a || a.mode === 'none') return '';
  if (!['summary', 'history'].includes(a.mode)) return 'Choose a valid CGPA calculation method.';
  if (semester <= 1) return 'Previous academic records apply only from Semester 2 onward.';
  if (
    a.mode === 'summary' &&
    (!entered(a.cgpa) || !Number.isFinite(+a.cgpa) || +a.cgpa < 0 || +a.cgpa > maxPoints)
  )
    return `Previous CGPA must be between 0 and ${maxPoints}.`;
  if (
    a.mode === 'summary' &&
    (!entered(a.credits) || !Number.isFinite(+a.credits) || +a.credits <= 0)
  )
    return 'Enter the total completed credits behind your previous CGPA.';
  if (!Array.isArray(a.history)) return 'Invalid GPA history.';
  if (a.mode === 'history' && !a.history.length)
    return 'Add a previous semester, or choose Skip for now.';
  const numbers = new Set();
  for (const h of a.history) {
    if (!h || typeof h !== 'object') return 'Invalid historical semester.';
    if (
      !Number.isInteger(+h.number) ||
      +h.number < 1 ||
      +h.number >= semester ||
      numbers.has(+h.number)
    )
      return 'Use unique past semester numbers below your current semester.';
    numbers.add(+h.number);
    if (!entered(h.gpa) || !Number.isFinite(+h.gpa) || +h.gpa < 0 || +h.gpa > maxPoints)
      return `Historical GPAs must be between 0 and ${maxPoints}.`;
    if (
      (a.mode === 'history' || entered(h.credits)) &&
      (!entered(h.credits) || !Number.isFinite(+h.credits) || +h.credits <= 0)
    )
      return 'Historical semester credits must be greater than zero.';
  }
  return '';
}
export function academicTrend(current, semesters) {
  const a = current.academic || emptyAcademic(),
    rows = new Map();
  if (a.mode !== 'none')
    for (const h of a.history || [])
      if (+h.number < +current.number)
        rows.set(+h.number, {
          number: +h.number,
          gpa: +h.gpa,
          credits: +h.credits || 0,
          source: 'Entered history',
        });
  for (const s of semesters) {
    if (+s.number > +current.number || s.grading.maxPoints !== current.grading.maxPoints) continue;
    const t = stats(s);
    if (t.official && t.gpa !== null)
      rows.set(+s.number, {
        number: +s.number,
        gpa: t.gpa,
        credits: t.eligible,
        source: 'Recorded subjects',
      });
  }
  return [...rows.values()].sort((a, b) => a.number - b.number);
}
export function cumulative(current, semesters, assumption = null, custom = {}) {
  const a = +current.number > 1 ? current.academic || emptyAcademic() : emptyAcademic(),
    error = validateAcademic(a, +current.number, current.grading.maxPoints);
  if (error) return { error, gpa: null, priorGpa: null };
  let priorPoints = 0,
    priorCredits = 0,
    covered = 0;
  if (a.mode === 'summary') {
    priorPoints = +a.cgpa * +a.credits;
    priorCredits = +a.credits;
    covered = +current.number - 1;
  } else {
    const previous = academicTrend(current, semesters).filter((h) => h.number < +current.number);
    for (const h of previous) {
      if (h.credits > 0) {
        priorPoints += h.gpa * h.credits;
        priorCredits += h.credits;
        covered++;
      }
    }
    const mixed = semesters.some(
      (s) =>
        +s.number < +current.number &&
        s.grading.maxPoints !== current.grading.maxPoints &&
        stats(s).official,
    );
    if (mixed)
      return {
        error:
          'Previous semesters use a different grade-point scale. Enter a previous CGPA converted to this semester’s scale instead.',
        gpa: null,
        priorGpa: null,
      };
  }
  const now = stats(current, assumption, custom),
    actual = stats(current),
    include = now.gpa !== null && (actual.official || assumption !== null);
  const credits = priorCredits + (include ? now.eligible : 0),
    points = priorPoints + (include ? now.points : 0);
  return {
    gpa: credits ? points / credits : null,
    credits,
    points,
    priorCredits,
    priorPoints,
    priorGpa: priorCredits ? priorPoints / priorCredits : null,
    currentGpa: include ? now.gpa : null,
    currentCredits: include ? now.eligible : 0,
    covered,
    partial: covered < +current.number - 1,
    currentComplete: actual.official,
    projected: !actual.official && assumption !== null,
  };
}
