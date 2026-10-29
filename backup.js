import { validateAcademic } from './academic.js';
import { uid, validateSubject, validateGrading } from './engine.js';

const validId = (id) => typeof id === 'string' && /^[a-zA-Z0-9_-]{1,256}$/.test(id);
export function validateBackup(profile) {
  if (
    !profile ||
    profile.version !== 1 ||
    typeof profile.name !== 'string' ||
    profile.done !== true ||
    !Array.isArray(profile.semesters) ||
    !profile.semesters.length ||
    !Array.isArray(profile.scenarios) ||
    !Number.isInteger(profile.current) ||
    !profile.semesters[profile.current]
  )
    throw Error('Choose a complete ARC JSON backup exported from Settings.');
  const semesterIds = new Set(),
    subjectIds = new Set(),
    assessmentIds = new Set(),
    scenarioIds = new Set();
  for (const semester of profile.semesters) {
    if (
      !semester ||
      !validId(semester.id) ||
      semesterIds.has(semester.id) ||
      !Number.isInteger(Number(semester.number)) ||
      Number(semester.number) < 1 ||
      !Array.isArray(semester.subjects) ||
      validateGrading(semester.grading)
    )
      throw Error('Invalid semester or grading system.');
    semesterIds.add(semester.id);
    if (validateAcademic(semester.academic, Number(semester.number), semester.grading.maxPoints))
      throw Error('Invalid prior CGPA or GPA history.');
    for (const subject of semester.subjects) {
      if (
        !validId(subject?.id) ||
        subjectIds.has(subject.id) ||
        validateSubject(subject) ||
        (subject.grading && validateGrading(subject.grading))
      )
        throw Error('Invalid subject or marks.');
      subjectIds.add(subject.id);
      for (const component of subject.components) {
        if (!validId(component.id) || assessmentIds.has(component.id))
          throw Error('Invalid or duplicate assessment.');
        assessmentIds.add(component.id);
      }
    }
  }
  for (const scenario of profile.scenarios) {
    if (
      !scenario ||
      !validId(scenario.id) ||
      scenarioIds.has(scenario.id) ||
      !semesterIds.has(scenario.semester) ||
      typeof scenario.name !== 'string' ||
      !scenario.custom ||
      typeof scenario.custom !== 'object' ||
      Array.isArray(scenario.custom) ||
      !Number.isFinite(scenario.normal) ||
      scenario.normal < 0 ||
      scenario.normal > 100 ||
      Object.entries(scenario.custom).some(
        ([id, score]) => !validId(id) || !Number.isFinite(score) || score < 0,
      )
    )
      throw Error('Invalid saved scenario.');
    scenarioIds.add(scenario.id);
  }
  if (
    profile.normal !== undefined &&
    (!Number.isFinite(profile.normal) || profile.normal < 0 || profile.normal > 100)
  )
    throw Error('Invalid expected score assumption.');
  return profile;
}

export function restoreBackup(current, backup, mode) {
  validateBackup(backup);
  const incoming = structuredClone(backup);
  if (mode === 'replace') return incoming;
  if (mode !== 'merge' || !current.done) throw Error('Finish onboarding before merging semesters.');
  const restored = structuredClone(current);
  for (const s of incoming.semesters) {
    const oldId = s.id;
    s.id = uid();
    const ids = {};
    for (const x of s.subjects) {
      x.id = uid();
      for (const c of x.components) {
        const id = uid();
        ids[c.id] = id;
        c.id = id;
      }
    }
    restored.semesters.push(s);
    for (const sc of incoming.scenarios.filter((x) => x.semester === oldId)) {
      sc.id = uid();
      sc.semester = s.id;
      sc.custom = Object.fromEntries(
        Object.entries(sc.custom)
          .filter(([id]) => ids[id])
          .map(([id, v]) => [ids[id], v]),
      );
      restored.scenarios.push(sc);
    }
  }
  return restored;
}
