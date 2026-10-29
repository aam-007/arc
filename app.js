import {
  $,
  html,
  esc,
  fmt,
  num,
  brand,
  themes,
  themeDots,
  field,
  mini,
  scaleView,
  icon,
  footerNote,
} from './ui.js';
import { welcome } from './welcome.js';
import { playArrival } from './arrival.js';
import {
  uid,
  config,
  upgradeDefaultGrading,
  blankSubject,
  preset,
  rawScore,
  mark,
  result,
  stats,
  validateSubject,
  validateGrading,
  solve,
  reach,
} from './engine.js';
import { read, save } from './storage.js';
import { validateBackup, restoreBackup } from './backup.js';
import { assumptions, changeAssumption, pendingEstimates } from './forecast.js';
import { emptyAcademic, validateAcademic, cumulative, academicTrend } from './academic.js';
import { exportCSV, exportExcel, download } from './export.js';
let data;
try {
  data = await read();
} catch (e) {
  console.error(e);
}
if (!data)
  data = {
    version: 1,
    name: '',
    step: 0,
    done: false,
    current: 0,
    semesters: [],
    draft: {
      id: uid(),
      number: '',
      degree: '',
      college: '',
      year: '',
      nickname: '',
      grading: config(),
      subjects: [],
      count: '',
      gradeChoice: 'excel',
    },
    scenarios: [],
    target: '',
    bookmark: false,
  };
data.welcomeSeen ??= data.done || data.step > 0;
if (upgradeDefaultGrading(data)) await save(data).catch(() => {});
let theme = localStorage.getItem('arc-theme') || 'glass',
  page = 'overview',
  query = '',
  sort = 'name',
  scenario = 'normal',
  normal = data.normal ?? 70,
  custom = {},
  error = '',
  editing = null;
let finishing = false;
let rates = assumptions(data);
normal = rates.normal;
document.body.dataset.theme = theme;
let saveState = 'Saved on this device';
function updateSaveStatus(message) {
  saveState = message;
  document.querySelectorAll('.save-status').forEach((el) => (el.textContent = message));
}
function persist() {
  updateSaveStatus('Saving…');
  return save(data)
    .then(() => {
      updateSaveStatus('Saved on this device');
      return true;
    })
    .catch(() => {
      updateSaveStatus('Changes not saved');
      const message = 'Storage unavailable. Export a backup to keep your work.';
      const feedback = $('#modal[open] [role=alert]');
      if (feedback) {
        feedback.className = 'error';
        feedback.textContent = message;
      }
      toast(message);
      return false;
    });
}
function toast(s) {
  $('#toast').textContent = s;
  $('#toast').classList.add('visible');
  setTimeout(() => $('#toast').classList.remove('visible'), 3500);
}
const sem = () => (data.done ? data.semesters[data.current] : data.draft);
const labels = [
  'Your world',
  'Your name',
  'Your semester',
  'Grading system',
  'Your subjects',
  'Subjects & credits',
  'Assessments',
  'The final look',
];

async function revealDashboard(options = {}) {
  await playArrival({ render, name: data.name, ...options });
}
let academicDraft = null;
function academicForm(a) {
  const current = sem();
  return html`<div class="section-head">
      <div>
        <h2>Your cumulative picture</h2>
        <small>Optional · for Semester ${esc(current.number)} onward</small>
      </div>
      <span class="pill">CGPA calculator</span>
    </div>
    <p class="muted" style="font-size:13px">
      Add previous results to combine them with this semester. Use the same
      ${current.grading.maxPoints}-point scale. Credits keep the calculation accurate.
    </p>
    <div class="academic-methods">
      ${[
        ['none', 'Skip for now'],
        ['summary', 'Enter previous CGPA'],
        ['history', 'Enter past semester GPAs'],
      ]
        .map(
          ([id, label]) =>
            html`<button class="btn ${a.mode === id ? '' : 'secondary'}" data-academic-mode="${id}">
              ${label}
            </button>`,
        )
        .join('')}
    </div>
    ${a.mode === 'summary'
      ? html`<div class="field-grid">
            <label
              >Previous CGPA<input
                data-academic-field="cgpa"
                type="number"
                min="0"
                max="${current.grading.maxPoints}"
                step="any"
                value="${esc(a.cgpa)}"
                placeholder="Your CGPA before this semester" /></label
            ><label
              >Total completed credits<input
                data-academic-field="credits"
                type="number"
                min="0.01"
                step="any"
                value="${esc(a.credits)}"
                placeholder="Credits included in that CGPA"
            /></label>
          </div>
          <p class="insight muted">
            This CGPA covers all semesters before Semester ${esc(current.number)}. Optional history
            below is used only for your progress chart, so it is not counted twice.
          </p>`
      : ''}${a.mode !== 'none'
      ? html`<h3 style="margin:22px 0 10px">
            ${a.mode === 'summary' ? 'Historical GPAs · optional' : 'Previous semesters'}
          </h3>
          ${(a.history || [])
            .map(
              (h, i) =>
                html`<div class="academic-history-row" data-history-index="${i}">
                  <label
                    >Semester<input
                      data-academic-field="number"
                      type="number"
                      min="1"
                      max="${+current.number - 1}"
                      step="1"
                      value="${esc(h.number)}"
                      placeholder="Number" /></label
                  ><label
                    >GPA<input
                      data-academic-field="gpa"
                      type="number"
                      min="0"
                      max="${current.grading.maxPoints}"
                      step="any"
                      value="${esc(h.gpa)}"
                      placeholder="GPA" /></label
                  ><label
                    >Credits${a.mode === 'summary' ? ' · optional' : ''}<input
                      data-academic-field="credits"
                      type="number"
                      min="0.01"
                      step="any"
                      value="${esc(h.credits)}"
                      placeholder="Credits" /></label
                  ><button
                    data-remove-history="${i}"
                    aria-label="Remove historical semester ${i + 1}"
                  >
                    ${icon('close')}
                  </button>
                </div>`,
            )
            .join('')}<button class="btn link" data-action="add-history">
            ${icon('plus')} Add historical semester GPA
          </button>
          <p class="muted" style="font-size:12px;margin-top:12px">
            Completed semesters already tracked in ARC are included automatically. If a semester
            also appears in history, its detailed ARC result takes priority.
          </p>
          <div id="academic-preview" class="insight muted">${academicPreview(a)}</div>`
      : '<p class="insight muted">You can add your previous CGPA or history later from the dashboard. ARC will use only the records you have entered.</p>'}`;
}
function academicPreview(a) {
  const error = validateAcademic(a, +sem().number, sem().grading.maxPoints);
  if (error) return esc(error);
  const c = cumulative({ ...sem(), academic: a }, data.done ? data.semesters : []),
    projected = cumulative(
      { ...sem(), academic: a },
      data.done ? data.semesters : [],
      normal / 100,
    );
  if (c.error) return esc(c.error);
  return `Previous CGPA: <b>${fmt(c.priorGpa)}</b> · ${fmt(c.priorCredits, 1)} completed credits.<br>${c.currentComplete ? 'Updated CGPA: <b>' + fmt(c.gpa) + '</b>' : 'Current semester GPA is pending. Projected CGPA: <b>' + fmt(projected.gpa) + '</b> (' + normal + '% expected in pending assessments).'}`;
}
function academicEditor() {
  academicDraft = structuredClone(sem().academic || emptyAcademic());
  drawAcademicEditor();
}
function drawAcademicEditor() {
  openModal(
    html`<div class="modal-top">
        <h2>CGPA & previous results</h2>
        <button data-action="close" aria-label="Close">${icon('close')}</button>
      </div>
      <div id="academic-fields">${academicForm(academicDraft)}</div>
      <div id="academic-error" role="alert"></div>
      <button class="btn" data-action="save-academic" style="margin-top:20px">
        Save previous results ${icon('check')}
      </button>`,
  );
}
function academicCard() {
  const s = sem();
  if (+s.number <= 1) return '';
  const c = cumulative(s, data.semesters),
    projected = cumulative(s, data.semesters, normal / 100);
  if (c.error)
    return html`<section class="panel cgpa-panel">
      <h2>CGPA calculator</h2>
      <p class="error">${esc(c.error)}</p>
      <button class="btn secondary" data-action="academic">Edit previous results</button>
    </section>`;
  return html`<section class="panel cgpa-panel">
    <div class="section-head">
      <div>
        <div class="eyebrow">Across your semesters</div>
        <h2>CGPA calculator</h2>
      </div>
      <button class="btn secondary" data-action="academic">
        ${s.academic?.mode && s.academic.mode !== 'none' ? 'Edit' : 'Add'} previous results
      </button>
    </div>
    <div class="cgpa-grid">
      <div>
        <small>Previous CGPA</small><strong>${fmt(c.priorGpa)}</strong
        ><small>${fmt(c.priorCredits, 1)} completed credits</small>
      </div>
      <div>
        <small>Current semester GPA</small
        ><strong>${c.currentComplete ? fmt(c.currentGpa) : '—'}</strong
        ><small>${c.currentComplete ? 'Confirmed result' : 'Waiting for all marks'}</small>
      </div>
      <div>
        <small>${c.partial ? 'Tracked' : 'Updated'} CGPA</small
        ><strong>${c.currentComplete ? fmt(c.gpa) : '—'}</strong
        ><small
          >${c.currentComplete
            ? fmt(c.credits, 1) + ' total eligible credits'
            : 'Pending current result'}</small
        >
      </div>
      <div>
        <small>Projected CGPA</small><strong>${fmt(projected.gpa)}</strong
        ><small>${normal}% expected in pending marks</small>
      </div>
    </div>
    <p class="insight muted">
      CGPA = (previous CGPA × previous credits + current GPA × current eligible credits) ÷ combined
      credits.${c.partial
        ? ' Some previous semesters are missing; these figures use only tracked records.'
        : ''}
    </p>
    ${(s.academic?.history || []).length
      ? html`<h3>Historical GPA progress</h3>
          ${bars(
            academicTrend(s, data.semesters).map((h) => ({
              name: 'Semester ' + h.number,
              value: h.gpa,
            })),
            s.grading.maxPoints,
          )}`
      : '<small>Historical semester GPAs are optional. Add them to see your progress over time.</small>'}
  </section>`;
}
function onboarding() {
  const s = sem(),
    step = data.step;
  let content = '';
  if (step === 0)
    content = html`<div class="intro">
        <div class="eyebrow">A fresh perspective on your potential</div>
        <h1>Your numbers.<br />Your world.</h1>
        <p>Meet your personal academic studio. Start by making it feel like you.</p>
      </div>
      <div class="theme-grid">
        ${themes
          .map(
            (t) =>
              html`<button
                class="theme-card ${theme === t[0] ? 'selected' : ''}"
                data-theme="${t[0]}"
                aria-pressed="${theme === t[0]}"
              >
                ${mini(t[0])}
                <div class="theme-caption">${t[1]}<span>${theme === t[0] ? '✓' : '○'}</span></div>
                <div class="theme-desc">${t[2]}</div>
              </button>`,
          )
          .join('')}
      </div>`;
  if (step === 1)
    content = html`<div class="intro">
        <div class="eyebrow">A personal beginning</div>
        <h1>What should we<br />call you?</h1>
        <p>Your journey deserves more than a student ID.</p>
      </div>
      <input
        class="big-input"
        autofocus
        data-profile="name"
        aria-label="Your name"
        placeholder="Your name"
        value="${esc(data.name)}"
        maxlength="100"
      />`;
  if (step === 2)
    content = html`<div class="intro">
        <div class="eyebrow">Your next chapter</div>
        <h1>Hi, ${esc(data.name)}.<br />What semester are you in?</h1>
        <p>Every academic journey has its own pace.</p>
      </div>
      <div class="form-area stack">
        ${field(
          'Semester number',
          'number',
          s.number,
          'number',
          'min="1" step="1" placeholder="Enter your semester"',
        )}
        <div class="field-grid">
          ${field('Degree / course · optional', 'degree', s.degree)}${field(
            'University · optional',
            'college',
            s.college,
          )}${field('Academic year · optional', 'year', s.year)}${field(
            'Semester nickname · optional',
            'nickname',
            s.nickname,
          )}
        </div>
        <div id="academic-slot">
          ${+s.number > 1
            ? html`<section class="panel academic-onboard">
                ${academicForm(s.academic || emptyAcademic())}
              </section>`
            : ''}
        </div>
      </div>`;
  if (step === 3)
    content = html`<div class="intro">
        <div class="eyebrow">Make the math yours</div>
        <h1>How does your college<br />calculate grades?</h1>
        <p>A transparent scale. Every boundary, under your control.</p>
      </div>
      <div class="form-area">
        ${[
          [
            'excel',
            'Use the default grading system',
            '10-point scale · pass at 40 · default grade boundaries',
          ],
          [
            'custom',
            'Create my own grading system',
            'Define your labels, mark boundaries, and grade points.',
          ],
          [
            'template',
            'Start from a standard template',
            'An editable 4-point example. Review it before continuing.',
          ],
        ]
          .map(
            ([id, title, desc]) =>
              html`<button
                class="choice ${s.gradeChoice === id ? 'active' : ''}"
                data-grade-choice="${id}"
              >
                <b>${title}</b><small>${desc}</small>
              </button>`,
          )
          .join('')}${scaleView(s.grading)}<button class="btn secondary" data-action="grading">
          Edit scale & rounding ${icon('settings')}
        </button>
      </div>`;
  if (step === 4)
    content = html`<div class="intro">
        <div class="eyebrow">A blank canvas, on purpose</div>
        <h1>Let's build<br />your semester.</h1>
        <p>How many subjects are you taking this semester?</p>
      </div>
      <div class="number-picker">
        <button data-action="minus" aria-label="One fewer subject">−</button
        ><input
          type="number"
          min="1"
          step="1"
          data-field="count"
          aria-label="Number of subjects"
          placeholder="—"
          value="${esc(s.count)}"
        /><button data-action="plus" aria-label="One more subject">+</button>
      </div>
      <p class="muted">You can always add or remove subjects later.</p>`;
  if (step === 5)
    content = html`<div class="intro">
        <div class="eyebrow">Every credit counts</div>
        <h1>Tell us what<br />you're studying.</h1>
        <p>Your subjects, your credits. Nothing filled in for you.</p>
      </div>
      <div style="margin-top:25px">
        ${s.subjects
          .map(
            (x, i) =>
              html`<div class="subject-entry" data-sub="${x.id}">
                ${field(
                  'Subject ' + (i + 1),
                  'name',
                  x.name,
                  'text',
                  'placeholder="Subject name"',
                )}${field('Code · optional', 'code', x.code)}${field(
                  'Credits',
                  'credits',
                  x.credits,
                  'number',
                  'min="0.01" step="any" placeholder="—"',
                )}<label
                  >Type<select data-field="type">
                    ${['Theory', 'Laboratory', 'Practical', 'Project', 'Online Course', 'Custom']
                      .map((t) => html`<option ${x.type === t ? 'selected' : ''}>${t}</option>`)
                      .join('')}
                  </select></label
                ><button
                  class="remove"
                  data-remove-sub="${x.id}"
                  aria-label="Remove subject ${i + 1}"
                >
                  ${icon('close')}
                </button>
              </div>`,
          )
          .join('')}
        <div class="row between" style="margin-top:20px">
          <button class="btn secondary" data-action="add-blank">${icon('plus')} Add subject</button
          ><small class="credit-summary"
            >${s.subjects.length} subjects ·
            ${fmt(s.subjects.reduce((a, x) => a + (+x.credits || 0), 0))} credits</small
          >
        </div>
      </div>`;
  if (step === 6)
    content = html`<div class="intro">
        <div class="eyebrow">Set it once. Make it yours.</div>
        <h1>How are your<br />subjects graded?</h1>
        <p>Configure one subject, then copy the structure. Scores are always optional.</p>
      </div>
      <div class="form-area stack">
        <div class="row">
          <button class="btn secondary" data-action="shared">
            Set a shared structure ${icon('arrow')}</button
          ><small>Applies to all subjects, preserving compatible scores.</small>
        </div>
        ${s.subjects
          .map(
            (x, i) =>
              html`<div class="panel row between">
                <div>
                  <h3>${esc(x.name)}</h3>
                  <small
                    >${x.components.map((c) => `${esc(c.name)} (${c.weight}%)`).join(' + ')}</small
                  >
                </div>
                <div class="row">
                  ${i
                    ? html`<button class="btn link" data-copy="${x.id}">Copy previous</button>`
                    : ''}<button class="btn secondary" data-edit="${x.id}">Configure</button>
                </div>
              </div>`,
          )
          .join('')}<small>Skip marks for now by continuing with blank score fields.</small>
      </div>`;
  if (step === 7)
    content = html`<div class="intro">
        <div class="eyebrow">Ready when you are</div>
        <h1>Your semester,<br />all set.</h1>
        <p>${esc(data.name)} · Semester ${s.number}${s.college ? ' · ' + esc(s.college) : ''}</p>
      </div>
      <div class="form-area">
        <div class="row between">
          <h2>
            ${s.subjects.length} subjects ·
            ${fmt(s.subjects.reduce((a, x) => a + (+x.credits || 0), 0))} credits
          </h2>
          <button class="btn link" data-goto="5">Edit subjects</button>
        </div>
        ${scaleView(s.grading)}${s.subjects
          .map(
            (x) =>
              html`<div class="row between insight">
                <div>
                  <b>${esc(x.name)}</b>
                  <p class="muted">
                    ${x.credits} credits ·
                    ${x.components
                      .map(
                        (c) =>
                          `${esc(c.name)} ${c.score === null ? 'pending' : esc(c.score) + ' / ' + c.max}`,
                      )
                      .join(' · ')}
                  </p>
                </div>
                <button class="btn link" data-edit="${x.id}">Edit</button>
              </div>`,
          )
          .join('')}
      </div>`;
  return html`<header class="topbar">
      ${brand()}<span class="top-note">A LITTLE CLARITY. A LOT OF POSSIBILITY.</span>${themeDots(
        theme,
      )}
    </header>
    <main class="onboard">
      <div class="onboard-top">
        <div class="eyebrow">${String(step + 1).padStart(2, '0')} / 08 &nbsp; ${labels[step]}</div>
        <div class="steps" aria-label="Step ${step + 1} of 8">
          ${labels.map((_, i) => html`<span class="${i <= step ? 'done' : ''}"></span>`).join('')}
        </div>
      </div>
      <div class="onboard-import">
        <span>Already have an ARC backup?</span
        ><button class="btn link" data-action="onboard-import">
          Import backup ${icon('arrow')}
        </button>
      </div>
      <div>${content}</div>
      ${error ? html`<div class="error" role="alert">${esc(error)}</div>` : ''}
      <footer class="onboard-footer">
        <div>
          ${step
            ? '<button class="btn link" data-action="back">← Back</button>'
            : html`<span class="promise"
                >${icon('lock')}Private by design.<br />Your data stays with you.</span
              >`}
        </div>
        <button class="btn" data-action="next">
          ${step === 7 ? 'Enter my dashboard' : step === 0 ? 'Make it mine' : 'Continue'}
          ${icon('arrow')}
        </button>
      </footer>
      ${footerNote('No accounts. No comparisons. Just your own trajectory.')}
    </main>`;
}
function subjectTable(subjects, forecast = null, interactive = true) {
  const g = sem().grading;
  return html`<div class="table-wrap">
    <table>
      <thead>
        <tr>
          ${[
            'Subject',
            'Credits',
            'ICA',
            'Term-end / TEE',
            'Total / 100',
            'Grade',
            'Points',
            'Weighted',
            'Status',
            ...(interactive ? ['Edit'] : []),
          ]
            .map((x) => html`<th>${x}</th>`)
            .join('')}
        </tr>
      </thead>
      <tbody>
        ${subjects
          .map((s) => {
            const r = result(s, g, forecast);
            const comp = (n) => {
              const c = s.components.find((c) => c.name.toUpperCase() === n);
              if (!interactive) return c ? fmt(rawScore(c), 1) : '—';
              return html`<button
                class="mark-cell"
                data-marks="${s.id}"
                ${c ? `data-component="${c.id}"` : ''}
                aria-label="${n === 'TEE'
                  ? 'Edit term-end marks'
                  : 'Edit internal marks'} for ${esc(s.name)}"
              >
                ${c ? (rawScore(c) === null ? 'Add marks' : fmt(rawScore(c), 1)) : 'Set up'}
              </button>`;
            };
            return html`<tr>
              <td>
                ${interactive
                  ? html`<button class="subject-name" data-edit="${s.id}">${esc(s.name)}</button>`
                  : esc(s.name)}
                <div class="subject-code">${esc(s.code || s.type)}</div>
              </td>
              <td>${s.credits}</td>
              <td>${comp('ICA')}</td>
              <td>${comp('TEE')}</td>
              <td>${fmt(r.value, 1)}</td>
              <td><span class="grade">${r.grade ? esc(r.grade.label) : '—'}</span></td>
              <td>${fmt(r.grade?.points, 1)}</td>
              <td>${fmt(r.weighted, 1)}</td>
              <td><span class="status">${r.complete ? '● Complete' : '◌ Pending'}</span></td>
              ${interactive
                ? html`<td>
                    <button class="btn link edit-marks" data-marks="${s.id}">
                      Edit subject & marks
                    </button>
                  </td>`
                : ''}
            </tr>`;
          })
          .join('')}
      </tbody>
    </table>
    ${subjects.length
      ? ''
      : '<div class="empty">Your next chapter starts with a subject.<br><button class="btn link" data-action="new-sub">Add your first subject →</button></div>'}
  </div>`;
}
function bars(rows, max) {
  return rows.length
    ? rows
        .map(
          (x) =>
            html`<div class="bar-row" title="${esc(x.name)}: ${fmt(x.value)}">
              <span>${esc(x.name)}</span>
              <div class="bar-track">
                <i style="width:${Math.max(0, Math.min(100, (x.value / max) * 100))}%"></i>
              </div>
              <b>${fmt(x.value, 1)}</b>
            </div>`,
        )
        .join('')
    : '<div class="empty">Your data will tell the story.<br>Add scores to reveal this view.</div>';
}
function insights() {
  const s = sem(),
    best = stats(s, 1),
    worst = stats(s, 0);
  let list = [];
  if (s.subjects.length) {
    const x = [...s.subjects].sort((a, b) => b.credits - a.credits)[0];
    list.push(
      `${x.name} accounts for ${fmt((x.credits / best.credits) * 100, 1)}% of your registered credits.`,
    );
    list.push(
      `Your possible GPA spans ${fmt(worst.gpa)} to ${fmt(best.gpa)}, preserving every recorded score.`,
    );
    for (const sub of s.subjects) {
      const g = sub.grading || s.grading;
      const current = mark(sub, 0),
        next = g.scale.find((b) => b.min > current);
      if (next) {
        const r = reach(sub, g, next.min);
        if (r && r.cost > 0) {
          list.push(
            `${sub.name}: ${fmt(r.cost)} additional raw marks can reach ${next.label}, using the most efficient pending components.`,
          );
          break;
        }
      }
    }
  }
  return (
    list.map((x) => html`<p class="insight">${icon('spark')}${esc(x)}</p>`).join('') ||
    '<div class="empty">Insights appear as your semester takes shape.</div>'
  );
}
function overview() {
  const s = sem(),
    t = stats(s),
    projected = stats(s, normal / 100),
    best = stats(s, rates.best / 100),
    worst = stats(s, rates.worst / 100),
    comps = s.subjects.flatMap((x) => x.components),
    received = comps.filter((c) => rawScore(c) !== null).length;
  return html`<div class="page-title">
      <div>
        <div class="eyebrow">Your academic trajectory</div>
        <h1>A little clarity, ${esc(data.name)}.</h1>
        <p>Every mark is part of a bigger picture.</p>
      </div>
      <button class="btn secondary" data-page="settings">${icon('download')} Export</button>
    </div>
    <div class="metrics">
      <section class="panel hero-metric">
        <div class="arc-decoration"></div>
        <div class="row between">
          <span class="eyebrow"
            >${t.official ? 'Confirmed semester GPA' : 'Official GPA pending'}</span
          ><span class="pill">SEM ${s.number}</span>
        </div>
        <div class="metric-number">
          ${t.official ? fmt(t.gpa) : '—'} <small>/ ${s.grading.maxPoints}</small>
        </div>
        <small
          >${t.official
            ? 'All assessment scores recorded.'
            : 'The whole picture takes time.'}</small
        >
        <div class="metric-footer">
          <span>${t.count} / ${s.subjects.length} subjects complete</span
          ><span>${t.completed} earned-result credits</span>
        </div>
      </section>
      <section class="panel">
        <div class="eyebrow">Projected GPA</div>
        <div class="metric-small">
          ${fmt(projected.gpa)} <small>/ ${s.grading.maxPoints}</small>
        </div>
        <small>${normal}% assumed in pending assessments</small>
        <div class="progress">
          <i style="width:${((projected.gpa || 0) / s.grading.maxPoints) * 100}%"></i>
        </div>
        <button class="btn link" data-page="lab">Explore the possibilities ${icon('arrow')}</button>
      </section>
      <section class="panel">
        <div class="eyebrow">Your semester, in motion</div>
        <div class="metric-small">${fmt(t.credits, 1)} <small>credits</small></div>
        <small
          >${s.subjects.length} subjects · ${received} of ${comps.length} assessments
          recorded</small
        >
        <div class="progress">
          <i style="width:${comps.length ? (received / comps.length) * 100 : 0}%"></i>
        </div>
        <div class="metric-footer">
          <span>CGPA · ${fmt(cumulative(s, data.semesters).gpa)}</span
          ><span>Available completed records</span>
        </div>
      </section>
    </div>
    ${academicCard()}
    <section class="panel">
      <div class="section-head">
        <h2>Subject performance</h2>
        <button class="btn link" data-page="subjects">All subjects ${icon('arrow')}</button>
      </div>
      ${subjectTable(s.subjects)}
    </section>
    <div class="chart-row">
      <section class="panel">
        <div class="section-head">
          <h2>Room to grow</h2>
          <small>GPA FORECAST</small>
        </div>
        ${bars(
          [
            { name: 'Worst · ' + rates.worst + '%', value: worst.gpa || 0 },
            { name: 'Expected · ' + normal + '%', value: projected.gpa || 0 },
            { name: 'Best · ' + rates.best + '%', value: best.gpa || 0 },
          ],
          s.grading.maxPoints,
        )}<small
          >Editable assumptions for pending scores, not guaranteed outcomes. Recorded scores stay
          fixed.</small
        >
      </section>
      <section class="panel">
        <div class="section-head">
          <h2>Worth knowing</h2>
          <span class="pill">From your data</span>
        </div>
        ${insights()}
      </section>
    </div>
    ${!data.bookmark
      ? html`<div class="bookmark">
          <div>
            <h3>Make ARC part of your routine.</h3>
            <p>
              Bookmark with ${/Mac/.test(navigator.platform) ? '⌘' : 'Ctrl'} + D. Back up records
              separately in Settings.
            </p>
          </div>
          <button class="btn link" data-action="dismiss">Got it ${icon('close')}</button>
        </div>`
      : ''}`;
}
function subjectsPage() {
  let subjects = sem()
    .subjects.filter((s) => (s.name + ' ' + s.code).toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => (sort === 'credits' ? b.credits - a.credits : a.name.localeCompare(b.name)));
  return html`<div class="page-title">
      <div>
        <div class="eyebrow">The details behind the number</div>
        <h1>Your subjects.</h1>
        <p>Change a mark. See the whole picture move.</p>
      </div>
      <button class="btn" data-action="new-sub">${icon('plus')} Add subject</button>
    </div>
    <div class="toolbar">
      <input
        id="search"
        placeholder="Search subjects…"
        aria-label="Search subjects"
        value="${esc(query)}"
      /><select id="sort" aria-label="Sort subjects">
        <option value="name">Name A–Z</option>
        <option value="credits" ${sort === 'credits' ? 'selected' : ''}>
          Credits high–low
        </option></select
      ><button class="btn secondary" data-action="shared">Shared structure</button>
    </div>
    <section class="panel">${subjectTable(subjects)}</section>`;
}
function lab() {
  const s = sem(),
    assumption = rates[scenario === 'custom' ? 'normal' : scenario] / 100;
  const t = stats(s, assumption, scenario === 'custom' ? custom : {});
  const sol = data.target !== '' ? solve(s, +data.target) : null;
  return html`<div class="page-title">
      <div>
        <div class="eyebrow">A space for possibility</div>
        <h1>What could your GPA become?</h1>
        <p>Explore the future. Your actual marks stay exactly where they are.</p>
      </div>
    </div>
    <div class="scenario-cards">
      ${[
        ['best', 'Best case', rates.best / 100, rates.best + '% optimistic assumption'],
        ['normal', 'Normal case', normal / 100, normal + '% pending assumption'],
        ['worst', 'Worst case', rates.worst / 100, rates.worst + '% cautious assumption'],
        ['custom', 'Your scenario', normal / 100, 'Your individual estimates'],
      ]
        .map(
          ([id, title, a, desc]) =>
            html`<button
              class="scenario-card ${scenario === id ? 'active' : ''}"
              data-scenario="${id}"
            >
              <div class="eyebrow">${title}</div>
              <strong>${fmt(stats(s, a, id === 'custom' ? custom : {}).gpa)}</strong
              ><small>${desc}</small>
            </button>`,
        )
        .join('')}
    </div>
    <div class="grid2" style="margin-top:22px">
      <section class="panel">
        <div class="section-head">
          <h2>Fine-tune the future</h2>
          <span class="pill">Forecast only</span>
        </div>
        <p class="muted forecast-explainer">
          Best and worst are editable planning assumptions, not statistical predictions. They start
          at 90% and 50% of pending marks. Drag any subject slider to build your own scenario.
        </p>
        <div class="assumption-controls">
          ${[
            ['worst', 'Cautious'],
            ['normal', 'Expected'],
            ['best', 'Optimistic'],
          ]
            .map(
              ([id, label]) =>
                html`<label
                  >${label} · <output data-rate-label="${id}">${rates[id]}%</output>
                  <div class="rate-control">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="1"
                      data-rate="${id}"
                      aria-label="${label} pending score percentage"
                      value="${rates[id]}"
                    /><input
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      data-rate="${id}"
                      aria-label="${label} percentage"
                      value="${rates[id]}"
                    /></div
                ></label>`,
            )
            .join('')}
        </div>
        <div class="forecast-summary">
          <div class="eyebrow">
            Selected forecast ·
            <span data-selected-case>${scenario === 'custom' ? 'Custom' : scenario}</span>
          </div>
          <strong data-live-gpa>${fmt(t.gpa)}</strong
          ><small>Projected GPA / ${s.grading.maxPoints}</small>${+s.number > 1
            ? html`<p>
                Projected CGPA:
                <b data-live-cgpa
                  >${fmt(
                    cumulative(s, data.semesters, assumption, scenario === 'custom' ? custom : {})
                      .gpa,
                  )}</b
                >
              </p>`
            : ''}
          <p data-live-target>
            ${data.target !== ''
              ? t.gpa >= +data.target
                ? 'At or above your ' + data.target + ' target'
                : 'Below your ' + data.target + ' target'
              : 'Set a target to compare your forecast.'}
          </p>
          <small
            >Absolute mathematical range: ${fmt(stats(s, 0).gpa)} – ${fmt(stats(s, 1).gpa)} GPA.
            These limits use 0% and 100%, separately from your planning assumptions.</small
          >
        </div>
        <div class="row scenario-save">
          <input
            id="scenario-name"
            aria-label="Scenario name"
            placeholder="Name this scenario"
          /><button class="btn secondary" data-action="save-scenario">Save</button>
        </div>
        ${s.subjects
          .map(
            (sub) =>
              html`<div class="scenario-sub">
                <div class="row between">
                  <h3>${esc(sub.name)}</h3>
                  <span class="grade" data-forecast-grade="${sub.id}"
                    >${esc(
                      result(sub, s.grading, assumption, scenario === 'custom' ? custom : {}).grade
                        ?.label,
                    )}</span
                  >
                </div>
                <p
                  class="muted"
                  style="font-size:11px;margin-top:8px"
                  data-forecast-detail="${sub.id}"
                >
                  ${fmt(mark(sub, assumption, scenario === 'custom' ? custom : {}))} final marks ·
                  ${fmt(
                    result(sub, s.grading, assumption, scenario === 'custom' ? custom : {})
                      .weighted,
                  )}
                  weighted points
                </p>
                ${sub.components
                  .map((c) =>
                    rawScore(c) === null
                      ? html`<div class="scenario-control">
                          <span
                            >${esc(c.name)}<small style="display:block"
                              >${c.average ? 'Per pending quiz' : 'Pending'} / ${c.max}</small
                            ></span
                          ><input
                            type="range"
                            data-sim="${c.id}"
                            aria-label="${esc(sub.name + ' ' + c.name)} estimate"
                            min="0"
                            max="${c.max}"
                            step="0.01"
                            value="${scenario === 'custom'
                              ? (custom[c.id] ?? (normal / 100) * c.max)
                              : assumption * c.max}"
                          /><input
                            type="number"
                            data-sim="${c.id}"
                            aria-label="${esc(c.name)} estimated score"
                            min="0"
                            max="${c.max}"
                            step="any"
                            value="${fmt(
                              scenario === 'custom'
                                ? (custom[c.id] ?? (normal / 100) * c.max)
                                : assumption * c.max,
                            )}"
                          />
                        </div>`
                      : html`<p class="insight muted">
                          ${esc(c.name)} · ${fmt(rawScore(c))} / ${c.max} · recorded
                        </p>`,
                  )
                  .join('')}
              </div>`,
          )
          .join('') || '<div class="empty">Add subjects to explore outcomes.</div>'}
      </section>
      <div class="stack" style="align-content:start">
        <section class="panel">
          <div class="eyebrow">Your target, in focus</div>
          <h2 style="margin-top:12px">Find your way there.</h2>
          <label style="margin-top:20px"
            >Target semester GPA<input
              type="number"
              id="target"
              min="0"
              max="${s.grading.maxPoints}"
              step="any"
              placeholder="e.g. 9.0"
              value="${data.target}" /></label
          ><button class="btn link" data-action="calculate-target">
            Find a route ${icon('arrow')}</button
          >${sol
            ? sol.unsupported
              ? '<p class="insight">' + esc(sol.reason) + '</p>'
              : sol.empty
                ? '<p class="insight">Add subjects first.</p>'
                : sol.impossible
                  ? html`<p class="insight">
                      This target is out of reach with your recorded marks. Your maximum possible
                      GPA is <b>${fmt(sol.max)}</b>.
                    </p>`
                  : html`<p class="insight">
                        Your target is achievable. One minimum-additional-marks route reaches
                        <b>${fmt(sol.gpa)}</b>, with <b>${fmt(sol.cost)}</b> raw marks across
                        pending assessments.
                      </p>
                      ${sol.path
                        .map((p) => {
                          const sub = s.subjects.find((s) => s.id === p.id);
                          return html`<div class="insight">
                            <b>${esc(sub.name)}</b>
                            <p>
                              ${sub.components
                                .filter((c) => rawScore(c) === null)
                                .map(
                                  (c) =>
                                    `${esc(c.name)} ≥ ${fmt(p.custom[c.id] ?? 0, 4)} / ${c.max}`,
                                )
                                .join('<br>') || 'Keep recorded scores'}
                            </p>
                          </div>`;
                        })
                        .join('')}<small
                        >Optimizes total raw added marks, not study effort. Thresholds use full
                        precision; rounded display values are guides.</small
                      >`
            : ''}
        </section>
        <section class="panel">
          <h2>Saved possibilities</h2>
          ${data.scenarios
            .filter((x) => x.semester === s.id)
            .map(
              (x) =>
                html`<div class="insight row between">
                  <div>
                    <b>${esc(x.name)}</b>
                    <p class="muted">
                      ${fmt(stats(s, x.normal / 100, x.custom).gpa)} projected GPA · current actuals
                    </p>
                  </div>
                  <div class="row">
                    <button class="btn link" data-restore-scenario="${x.id}">Restore</button
                    ><button data-delete-scenario="${x.id}" aria-label="Delete ${esc(x.name)}">
                      ${icon('close')}
                    </button>
                  </div>
                </div>`,
            )
            .join('') || '<p class="empty">Save a custom scenario to revisit it here.</p>'}
        </section>
      </div>
    </div>`;
}
function insightsPage() {
  const s = sem(),
    completed = s.subjects.filter((x) => mark(x) !== null),
    g = s.grading;
  let distribution = {};
  for (const x of completed) {
    const r = result(x, g);
    distribution[r.grade.label] = (distribution[r.grade.label] || 0) + 1;
  }
  return html`<div class="page-title">
      <div>
        <div class="eyebrow">Understand your trajectory</div>
        <h1>The story in your stats.</h1>
        <p>Only your records. Every insight has a reason.</p>
      </div>
    </div>
    <div class="grid2">
      <section class="panel">
        <h2>Semester trajectory</h2>
        ${bars(
          academicTrend(s, data.semesters).map((x) => ({
            name: 'Semester ' + x.number,
            value: x.gpa,
          })),
          Math.max(...data.semesters.map((x) => x.grading.maxPoints)),
        )}<small
          >Entered historical GPAs and completed ARC semesters on the current grade-point scale.
          Detailed ARC results take priority for duplicate semesters.</small
        >
      </section>
      <section class="panel">
        <h2>Weighted contributions</h2>
        ${bars(
          completed.map((x) => ({ name: x.name, value: result(x, g).weighted })),
          Math.max(1, ...completed.map((x) => result(x, g).weighted)),
        )}<small>Grade points × subject credits. Completed results only.</small>
      </section>
      <section class="panel">
        <h2>Grade distribution</h2>
        ${bars(
          Object.entries(distribution).map(([name, value]) => ({ name, value })),
          Math.max(1, ...Object.values(distribution)),
        )}
      </section>
      <section class="panel">
        <h2>Assessment completion</h2>
        ${bars(
          s.subjects.map((x) => ({
            name: x.name,
            value:
              (x.components.filter((c) => rawScore(c) !== null).length / x.components.length) * 100,
          })),
          100,
        )}<small>Percentage of components with a recorded score.</small>
      </section>
      <section class="panel">
        <h2>Internal vs examination</h2>
        ${completed
          .filter((x) => x.components.some((c) => c.name === 'TEE'))
          .map(
            (x) =>
              html`<div class="insight">
                <b>${esc(x.name)}</b>${bars(
                  x.components.map((c) => ({ name: c.name, value: (rawScore(c) / c.max) * 100 })),
                  100,
                )}
              </div>`,
          )
          .join('') ||
        '<div class="empty">Complete a subject using ICA / TEE to compare scores.</div>'}
      </section>
      <section class="panel">
        <h2>Worth knowing</h2>
        ${insights()}
      </section>
    </div>`;
}
function settings() {
  const s = sem();
  return html`<div class="page-title">
      <div>
        <div class="eyebrow">Your studio, your rules</div>
        <h1>Make yourself at home.</h1>
        <p>A little personalization. A little peace of mind.</p>
      </div>
    </div>
    <div class="stack">
      <section class="panel">
        <div class="section-head">
          <h2>Appearance</h2>
          <small>Saved between visits</small>
        </div>
        <div class="settings-themes">
          ${themes
            .map(
              (t) =>
                html`<button class="${theme === t[0] ? 'active' : ''}" data-theme="${t[0]}">
                  ${t[1]}
                </button>`,
            )
            .join('')}
        </div>
      </section>
      <div class="grid2">
        <section class="panel">
          <h2>Your profile & semester</h2>
          <div class="stack" style="margin-top:20px">
            <label>Your name<input data-profile="name" value="${esc(data.name)}" /></label>${field(
              'Semester number',
              'number',
              s.number,
              'number',
              'min="1" step="1"',
            )}${field('Semester nickname', 'nickname', s.nickname)}${field(
              'University',
              'college',
              s.college,
            )}
          </div>
          ${+s.number > 1
            ? html`<button class="btn secondary" data-action="academic">
                Edit CGPA & GPA history
              </button>`
            : ''}<button class="btn link" data-action="new-sem" style="margin-top:15px">
            ${icon('plus')} Add another semester
          </button>
        </section>
        <section class="panel">
          <h2>Grading, made transparent</h2>
          ${scaleView(s.grading)}
          <p class="muted" style="font-size:12px">
            Pass at ${s.grading.pass} · ${s.grading.maxPoints}-point scale ·
            ${s.grading.round === 'none' ? 'No mark rounding' : s.grading.round + ' mark rounding'}.
            GPA display uses two decimals; calculations keep full precision.
          </p>
          <button class="btn secondary" style="margin-top:20px" data-action="grading">
            Edit grading rules
          </button>
          <p class="insight muted">
            Default calculation: Σ(grade points × credits) / Σ(all registered credits). ARC waits
            for all scores before confirming the semester GPA. The reference calculation treats
            blanks as zero.
          </p>
          <button class="btn link" data-action="workbook-equivalent">
            Show default-reference GPA
          </button>
        </section>
      </div>
      <section class="panel">
        <div class="section-head">
          <h2>Take your progress with you.</h2>
          <span class="pill">Export center</span>
        </div>
        <p class="muted" style="font-size:13px;margin-bottom:22px">
          Academic records stay in this browser. Clearing storage or switching devices can remove
          them.<br />Keep a JSON backup for a complete, restorable copy.
        </p>
        <div class="row" style="flex-wrap:wrap">
          ${[
            ['json', 'JSON backup'],
            ['xlsx', 'Spreadsheet (.xlsx)'],
            ['csv', 'CSV data'],
            ['pdf', 'Print / save PDF'],
          ]
            .map(
              ([id, label]) =>
                html`<button class="btn secondary" data-export="${id}">
                  ${icon('download')}${label}
                </button>`,
            )
            .join('')}
        </div>
        <hr class="divider" />
        <div class="row" style="flex-wrap:wrap">
          <label
            >Restore JSON<input
              type="file"
              id="import-file"
              accept=".json,application/json" /></label
          ><label
            >Restore mode<select id="import-mode">
              <option value="merge">Merge semesters</option>
              <option value="replace">Replace all records</option>
            </select></label
          >
        </div>
        <p class="insight muted">
          Merge adds semesters with new identifiers and keeps existing records. Replace uses the
          complete selected backup.
        </p>
      </section>
      <small
        >ARC is local-first. No account required. Install from your browser menu when supported;
        your browser controls offline availability.</small
      >
    </div>`;
}
function app() {
  const s = sem();
  return html`<aside class="sidebar">
      ${brand()}
      <div class="eyebrow">Your academic studio</div>
      <nav class="nav">
        ${[
          ['overview', 'Overview'],
          ['subjects', 'Subjects'],
          ['lab', 'Scenario Lab'],
          ['insights', 'Insights'],
          ['settings', 'Settings'],
        ]
          .map(
            ([id, label]) =>
              html`<button data-page="${id}" class="${page === id ? 'active' : ''}">
                ${icon(id)}${label}
              </button>`,
          )
          .join('')}
      </nav>
      <div class="sidebar-bottom">
        <p class="eyebrow" style="margin:0 8px 12px">Make room for possibility.</p>
        <div class="profile">
          <span class="avatar">${esc(data.name.slice(0, 2).toUpperCase())}</span>
          <div>
            <h3 style="font-size:12px">${esc(data.name)}</h3>
            <small>One semester at a time.</small>
          </div>
        </div>
      </div>
    </aside>
    <main class="workspace">
      <header class="workbar">
        <div class="eyebrow">ARC / ${page === 'lab' ? 'SCENARIO LAB' : page.toUpperCase()}</div>
        <div class="row">
          <span class="save-status">Saved on this device</span
          ><select id="semester" aria-label="Current semester">
            ${data.semesters
              .map(
                (x, i) =>
                  html`<option value="${i}" ${data.current === i ? 'selected' : ''}>
                    ${esc(x.nickname || 'Semester ' + x.number)}
                  </option>`,
              )
              .join('')}</select
          >${themeDots(theme)}
        </div>
      </header>
      <div class="page-content">
        ${page === 'overview'
          ? overview()
          : page === 'subjects'
            ? subjectsPage()
            : page === 'lab'
              ? lab()
              : page === 'insights'
                ? insightsPage()
                : settings()}
      </div>
      ${footerNote('ARC · YOUR NUMBERS. YOUR WORLD.')}
      <article class="report">${report()}</article>
    </main>`;
}
function report() {
  if (!data.done) return '';
  const s = sem(),
    t = stats(s);
  return html`<div class="eyebrow">ARC / ACADEMIC PERFORMANCE REPORT</div>
    <h1>${esc(data.name)}<br />Semester ${s.number}</h1>
    <p>
      ${esc(s.college)} · ${new Date().toLocaleDateString()}<br />${t.official
        ? 'Confirmed GPA: ' + fmt(t.gpa)
        : 'Official GPA pending'}
      · ${fmt(t.credits)} registered credits
    </p>
    ${+s.number > 1
      ? html`<p style="margin-top:12px">
          Updated CGPA:
          ${t.official ? fmt(cumulative(s, data.semesters).gpa) : 'Pending current semester'} ·
          Previous CGPA: ${fmt(cumulative(s, data.semesters).priorGpa)}
        </p>`
      : ''}${subjectTable(s.subjects, null, false)}
    <h2 style="margin-top:30px">Assessment records</h2>
    ${s.subjects
      .map(
        (x) =>
          html`<p style="margin:15px 0">
            <b>${esc(x.name)}</b> ·
            ${x.components
              .map(
                (c) =>
                  `${esc(c.name)}: ${rawScore(c) === null ? 'Not entered' : fmt(rawScore(c))} / ${c.max} (${c.weight}%)`,
              )
              .join(' · ')}
          </p>`,
      )
      .join('')}
    <h2>Credit-weighted contributions</h2>
    ${bars(
      s.subjects
        .filter((x) => mark(x) !== null)
        .map((x) => ({ name: x.name, value: result(x, s.grading).weighted })),
      Math.max(1, ...s.subjects.map((x) => result(x, s.grading).weighted || 0)),
    )}<small
      >Grades use the semester scale or subject overrides. Missing scores remain pending. Generated
      locally by ARC.</small
    >`;
}
function render() {
  const focused = document.activeElement;
  const id = focused?.id,
    pos = focused?.selectionStart;
  $('#app').innerHTML = data.done ? app() : data.welcomeSeen ? onboarding() : welcome(theme);
  if (id) {
    const el = document.getElementById(id);
    el?.focus();
    if (typeof pos === 'number' && el?.type === 'text') el.setSelectionRange(pos, pos);
  }
}
async function next() {
  if (finishing) return;
  error = '';
  const s = sem();
  if (data.step === 1 && !data.name.trim()) error = 'Tell us your name to continue.';
  if (data.step === 2 && (!Number.isInteger(+s.number) || +s.number < 1))
    error = 'Enter a positive whole semester number.';
  if (data.step === 3) error = validateGrading(s.grading);
  if (data.step === 4) {
    if (!Number.isInteger(+s.count) || +s.count < 1)
      error = 'Enter the number of subjects you are taking.';
    else {
      while (s.subjects.length < +s.count) s.subjects.push(blankSubject());
      if (s.subjects.length > +s.count) s.subjects.length = +s.count;
    }
  }
  if ([5, 6, 7].includes(data.step)) {
    if (!s.subjects.length) error = 'Add at least one subject.';
    else error = s.subjects.map(validateSubject).find(Boolean) || validateGrading(s.grading);
  }
  if (!error && [2, 3, 7].includes(data.step) && +s.number > 1)
    error = validateAcademic(s.academic, +s.number, s.grading.maxPoints);
  if (error) {
    render();
    return;
  }
  if (data.step === 7) {
    finishing = true;
    const before = structuredClone(data);
    const finishButton = document.querySelector('[data-action=next]');
    if (finishButton) {
      finishButton.disabled = true;
      finishButton.textContent = 'Saving your semester…';
    }
    data.done = true;
    data.welcomeSeen = true;
    data.semesters.push(s);
    data.current = data.semesters.length - 1;
    data.draft = null;
    if (!(await persist())) {
      data = before;
      finishing = false;
      error = 'Your semester could not be saved. Please export a backup or try again.';
      render();
      return;
    }
    await revealDashboard();
    finishing = false;
    return;
  } else data.step++;
  persist();
  render();
  window.scrollTo(0, 0);
}
function openModal(html) {
  $('#modal').innerHTML = html;
  $('#modal').showModal();
}
function componentHTML(s) {
  return s.components
    .map(
      (c, i) =>
        html`<div data-comp="${i}">
          <div class="component">
            ${field('Assessment name', 'name', c.name)}${field(
              'Max marks',
              'max',
              c.max,
              'number',
              'min="0.01" step="any"',
            )}${field('Weight %', 'weight', c.weight, 'number', 'min="0.01" step="any"')}${c.average
              ? '<small>Quiz average<br>Scores below</small>'
              : field(
                  'Score · optional',
                  'score',
                  c.score ?? '',
                  'number',
                  `min="0" max="${c.max}" step="any" placeholder="Pending"`,
                )}<button class="remove" data-remove-comp="${i}" aria-label="Remove assessment">
              ${icon('close')}
            </button>
          </div>
          ${c.average
            ? html`<div class="quiz-row">
                  ${c.scores
                    .map(
                      (v, j) =>
                        html`<label
                          >Quiz ${j + 1}<input
                            type="number"
                            data-quiz="${i},${j}"
                            value="${v ?? ''}"
                            min="0"
                            max="${c.max}"
                            step="any"
                            placeholder="Pending"
                        /></label>`,
                    )
                    .join('')}
                </div>
                <small
                  >Average of both quizzes${c.ceil2 ? ', rounded up to 2 decimals' : ''} · each quiz
                  uses the maximum above.</small
                >`
            : ''}
        </div>`,
    )
    .join('');
}
function editor(subject = null, shared = false) {
  editing = { subject: structuredClone(subject || blankSubject()), shared, isNew: !subject };
  drawEditor();
}
function drawEditor() {
  const s = editing.subject;
  openModal(
    html`<div class="modal-top">
        <div>
          <div class="eyebrow">${editing.shared ? 'Set it once' : 'Every detail matters'}</div>
          <h2>
            ${editing.shared
              ? 'Shared assessment structure'
              : editing.isNew
                ? 'Add a subject'
                : esc(s.name)}
          </h2>
        </div>
        <button data-action="close" aria-label="Close">${icon('close')}</button>
      </div>
      <div id="editor-fields">
        ${!editing.shared
          ? html`<div class="field-grid">
              ${field('Subject name', 'name', s.name)}${field(
                'Subject code · optional',
                'code',
                s.code,
              )}${field('Credits', 'credits', s.credits, 'number', 'min="0.01" step="any"')}<label
                >Type<select data-field="type">
                  ${['Theory', 'Laboratory', 'Practical', 'Project', 'Online Course', 'Custom']
                    .map((t) => html`<option ${s.type === t ? 'selected' : ''}>${t}</option>`)
                    .join('')}
                </select></label
              >
            </div>`
          : ''}
        <hr class="divider" />
        <div class="row between">
          <h3>Assessment structure</h3>
          <select id="assessment-preset" style="max-width:220px" aria-label="Assessment preset">
            <option value="">Choose a preset…</option>
            <option value="standard">Default: ICA + TEE / 2</option>
            <option value="double">Default: ICA × 2</option>
            <option value="weighted">Custom weighted sum</option>
          </select>
        </div>
        <p class="muted" style="font-size:12px;margin-top:12px">
          Enter actual marks in the Score fields below. To add term-end marks, choose the Default
          ICA + TEE preset or add an assessment named TEE. Final = Σ(score ÷ maximum × weight).
          Weights must total 100%. Blank means pending; zero is a recorded score.
        </p>
        <div id="components">${componentHTML(s)}</div>
        <div class="row" style="margin:18px 0;flex-wrap:wrap">
          <button class="btn link" data-action="add-comp">${icon('plus')} Add assessment</button
          ><button class="btn link" data-action="add-quiz">Add default quiz average</button>
        </div>
        ${!editing.shared
          ? html`<div class="row between">
                <small
                  >${s.grading
                    ? 'Subject-specific grading scale'
                    : 'Uses semester grading scale'}</small
                ><button class="btn link" data-action="subject-grade">Override grading</button
                >${s.grading
                  ? '<button class="btn link" data-action="clear-grade">Use semester scale</button>'
                  : ''}
              </div>
              <div class="panel" style="margin-top:16px">
                <div class="eyebrow">The calculation, explained</div>
                <p style="font-size:12px;margin-top:10px">
                  ${s.components
                    .map(
                      (c) =>
                        `(${rawScore(c) === null ? 'pending' : fmt(rawScore(c))} / ${c.max} × ${c.weight})`,
                    )
                    .join(' + ')}
                  = ${fmt(mark(s))}
                </p>
                <p class="muted" style="font-size:12px">
                  Best possible: ${fmt(mark(s, 1))} marks ·
                  ${esc(result(s, sem().grading, 1).grade?.label)} ·
                  ${fmt(result(s, sem().grading, 1).weighted)} weighted points.
                </p>
              </div>`
          : ''}
        <div id="editor-error" role="alert"></div>
        <div class="row between" style="margin-top:24px">
          ${!editing.isNew && !editing.shared
            ? '<button class="btn link" data-action="delete-sub">Remove subject</button>'
            : '<small>Stored on this device.</small>'}<button class="btn" data-action="save-sub">
            ${editing.shared ? 'Apply to all subjects' : 'Save subject'} ${icon('check')}
          </button>
        </div>
      </div>`,
  );
}
let gradingDraft = null,
  gradingSubject = false;
function gradingEditor(subject = false) {
  gradingSubject = subject;
  gradingDraft = structuredClone(
    subject ? editing.subject.grading || sem().grading : sem().grading,
  );
  drawGrading();
}
function drawGrading() {
  const g = gradingDraft;
  openModal(
    html`<div class="modal-top">
        <h2>${gradingSubject ? 'Subject grading override' : 'Your grading system'}</h2>
        <button data-action="close-grade" aria-label="Close">${icon('close')}</button>
      </div>
      <div id="grading-fields">
        <div class="field-grid">
          ${field(
            'Maximum grade points',
            'maxPoints',
            g.maxPoints,
            'number',
            'min="0.01" step="any"',
          )}${field(
            'Passing marks / 100',
            'pass',
            g.pass,
            'number',
            'min="0" max="100" step="any"',
          )}<label
            >Round final marks<select data-field="round">
              ${['none', 'nearest', 'floor', 'ceil']
                .map((x) => html`<option ${g.round === x ? 'selected' : ''}>${x}</option>`)
                .join('')}
            </select></label
          ><label
            >Eligible GPA credits<select data-field="eligible">
              <option value="all" ${g.eligible === 'all' ? 'selected' : ''}>
                All registered credits (Default)
              </option>
              <option value="passed" ${g.eligible === 'passed' ? 'selected' : ''}>
                Passed subjects only
              </option>
            </select></label
          >
        </div>
        <hr class="divider" />
        <div class="grade-edit">
          <small>Minimum marks ≥</small><small>Grade label</small><small>Grade points</small>
        </div>
        ${g.scale
          .map(
            (b, i) =>
              html`<div class="grade-edit" data-band="${i}">
                <input
                  data-field="min"
                  type="number"
                  value="${b.min}"
                  step="any"
                  aria-label="Minimum marks"
                /><input
                  data-field="label"
                  value="${esc(b.label)}"
                  aria-label="Grade label"
                /><input
                  data-field="points"
                  type="number"
                  value="${b.points}"
                  step="any"
                  aria-label="Grade points"
                /><button data-remove-band="${i}" aria-label="Remove grade">×</button>
              </div>`,
          )
          .join('')}<button class="btn link" data-action="add-band">+ Add boundary</button>
        <p class="muted" style="font-size:12px">
          Each boundary applies until the next begins. Below the pass threshold, points are zero.
          Mark ranges are normalized to 100.
        </p>
        <div id="grade-error" role="alert"></div>
        <button class="btn" style="margin-top:22px" data-action="save-grade">
          Save grading scale ${icon('check')}
        </button>
      </div>`,
  );
}
function newSemester() {
  openModal(
    html`<div class="modal-top">
        <h2>A new chapter.</h2>
        <button data-action="close" aria-label="Close">${icon('close')}</button>
      </div>
      <label
        >Semester number<input
          id="new-sem-number"
          type="number"
          min="1"
          step="1"
          placeholder="Semester number"
      /></label>
      <p class="insight muted">
        Starts with no subjects. Grading rules carry over and can be changed in Settings.
      </p>
      <div id="sem-error" role="alert"></div>
      <button class="btn" data-action="create-sem">Create semester ${icon('arrow')}</button>`,
  );
}
document.addEventListener('click', async (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.theme) {
    theme = b.dataset.theme;
    localStorage.setItem('arc-theme', theme);
    document.body.dataset.theme = theme;
    render();
    return;
  }
  if (b.dataset.page) {
    page = b.dataset.page;
    render();
    window.scrollTo(0, 0);
    return;
  }
  if (b.dataset.goto) {
    data.step = +b.dataset.goto;
    render();
    persist();
    return;
  }
  if (b.dataset.gradeChoice) {
    const s = sem();
    s.gradeChoice = b.dataset.gradeChoice;
    s.grading = config();
    if (s.gradeChoice === 'template')
      s.grading = {
        ...config(),
        maxPoints: 4,
        pass: 50,
        scale: [
          { min: 0, label: 'F', points: 0 },
          { min: 50, label: 'D', points: 1 },
          { min: 60, label: 'C', points: 2 },
          { min: 70, label: 'B', points: 3 },
          { min: 85, label: 'A', points: 4 },
        ],
      };
    persist();
    render();
    if (s.gradeChoice === 'custom') gradingEditor();
    return;
  }
  if (b.dataset.marks) {
    const sub = sem().subjects.find((s) => s.id === b.dataset.marks);
    editor(sub);
    const index = sub.components.findIndex((c) => c.id === b.dataset.component);
    const row = $('#components').querySelector(`[data-comp="${Math.max(index, 0)}"]`);
    const input = row?.querySelector('input[data-field=score],input[data-quiz]');
    input?.focus();
    input?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    return;
  }
  if (b.dataset.academicMode) {
    const modal = !!b.closest('#academic-fields');
    const a = modal ? academicDraft : (sem().academic ||= emptyAcademic());
    a.mode = b.dataset.academicMode;
    if (modal) drawAcademicEditor();
    else {
      persist();
      $('#academic-slot').innerHTML =
        '<section class="panel academic-onboard">' + academicForm(a) + '</section>';
    }
    return;
  }
  if (b.dataset.removeHistory !== undefined) {
    const modal = !!b.closest('#academic-fields');
    const a = modal ? academicDraft : sem().academic;
    a.history.splice(+b.dataset.removeHistory, 1);
    if (modal) drawAcademicEditor();
    else {
      persist();
      $('#academic-slot').innerHTML =
        '<section class="panel academic-onboard">' + academicForm(a) + '</section>';
    }
    return;
  }
  if (b.dataset.edit) {
    editor(sem().subjects.find((s) => s.id === b.dataset.edit));
    return;
  }
  if (b.dataset.removeSub) {
    sem().subjects = sem().subjects.filter((s) => s.id !== b.dataset.removeSub);
    persist();
    render();
    return;
  }
  if (b.dataset.copy) {
    const s = sem(),
      i = s.subjects.findIndex((x) => x.id === b.dataset.copy);
    s.subjects[i].components = s.subjects[i - 1].components.map((c) => ({
      ...structuredClone(c),
      id: uid(),
      score: null,
      scores: c.average ? [null, null] : undefined,
    }));
    persist();
    render();
    return;
  }
  if (b.dataset.scenario) {
    scenario = b.dataset.scenario;
    render();
    return;
  }
  if (b.dataset.restoreScenario) {
    const x = data.scenarios.find((x) => x.id === b.dataset.restoreScenario);
    custom = structuredClone(x.custom);
    normal = x.normal;
    rates = changeAssumption(rates, 'normal', normal);
    scenario = 'custom';
    render();
    return;
  }
  if (b.dataset.deleteScenario) {
    data.scenarios = data.scenarios.filter((x) => x.id !== b.dataset.deleteScenario);
    persist();
    render();
    return;
  }
  if (b.dataset.removeComp !== undefined) {
    editing.subject.components.splice(+b.dataset.removeComp, 1);
    drawEditor();
    return;
  }
  if (b.dataset.removeBand !== undefined) {
    gradingDraft.scale.splice(+b.dataset.removeBand, 1);
    drawGrading();
    return;
  }
  if (b.dataset.export) {
    const s = sem();
    if (b.dataset.export === 'json')
      download('ARC-backup.json', JSON.stringify(data, null, 2), 'application/json');
    if (b.dataset.export === 'csv') exportCSV(s);
    if (b.dataset.export === 'xlsx') exportExcel(s);
    if (b.dataset.export === 'pdf') window.print();
    return;
  }
  const a = b.dataset.action;
  if (!a) return;
  if (a === 'start-setup') {
    data.welcomeSeen = true;
    data.bookmark = true;
    await persist();
    render();
    window.scrollTo(0, 0);
  }
  if (a === 'onboard-import') {
    openModal(
      html`<div class="modal-top">
          <h2>Pick up where you left off.</h2>
          <button data-action="close" aria-label="Close">${icon('close')}</button>
        </div>
        <p class="muted">
          Import an ARC JSON backup to restore your profile, semesters, subjects, scores, and saved
          scenarios.
        </p>
        <label class="backup-file-label"
          >Choose your JSON backup<input
            type="file"
            id="import-file"
            accept=".json,application/json"
        /></label>
        <p class="insight muted">
          Use the JSON backup exported from Settings. Spreadsheet, CSV, and PDF reports are not
          complete backups. You can review the backup before restoring it.
        </p>
        <div id="import-error" role="alert"></div>`,
    );
  }
  if (a === 'academic') academicEditor();
  if (a === 'add-history') {
    const modal = !!b.closest('#academic-fields');
    const academic = modal ? academicDraft : (sem().academic ||= emptyAcademic());
    academic.history.push({ number: '', gpa: '', credits: '' });
    if (modal) drawAcademicEditor();
    else {
      persist();
      $('#academic-slot').innerHTML =
        '<section class="panel academic-onboard">' + academicForm(academic) + '</section>';
    }
  }
  if (a === 'save-academic') {
    const err = validateAcademic(academicDraft, +sem().number, sem().grading.maxPoints);
    if (err) {
      $('#academic-error').innerHTML = '<div class="error">' + esc(err) + '</div>';
      return;
    }
    const before = structuredClone(data);
    sem().academic = structuredClone(academicDraft);
    if (!(await persist())) {
      data = before;
      return;
    }
    $('#modal').close();
    academicDraft = null;
    render();
    toast('Cumulative results updated.');
  }
  if (a === 'calculate-target') {
    const v = num($('#target').value);
    if (v === null || v < 0 || v > sem().grading.maxPoints) {
      toast('Enter a target within your grade-point scale.');
      return;
    }
    data.target = v;
    persist();
    render();
  }
  if (a === 'next') next();
  if (a === 'back') {
    data.step--;
    error = '';
    persist();
    render();
  }
  if (a === 'plus' || a === 'minus') {
    sem().count = Math.max(1, (+sem().count || 0) + (a === 'plus' ? 1 : -1));
    persist();
    render();
  }
  if (a === 'add-blank') {
    sem().subjects.push(blankSubject());
    persist();
    render();
  }
  if (a === 'grading') gradingEditor();
  if (a === 'new-sub') editor();
  if (a === 'shared') editor(sem().subjects[0] || blankSubject(), true);
  if (a === 'close') {
    $('#modal').close();
    editing = null;
  }
  if (a === 'dismiss') {
    data.bookmark = true;
    persist();
    render();
  }
  if (a === 'add-comp') {
    editing.subject.components.push({ id: uid(), name: '', max: 100, weight: 0, score: null });
    drawEditor();
  }
  if (a === 'add-quiz') {
    editing.subject.components.push({
      id: uid(),
      name: 'Quiz average',
      max: 10,
      weight: 0,
      score: null,
      average: true,
      scores: [null, null],
      ceil2: true,
    });
    drawEditor();
  }
  if (a === 'subject-grade') gradingEditor(true);
  if (a === 'clear-grade') {
    editing.subject.grading = null;
    drawEditor();
  }
  if (a === 'close-grade') {
    if (gradingSubject) drawEditor();
    else $('#modal').close();
    gradingDraft = null;
  }
  if (a === 'add-band') {
    gradingDraft.scale.push({ min: 0, label: '', points: 0 });
    drawGrading();
  }
  if (a === 'save-grade') {
    const err = validateGrading(gradingDraft);
    if (err) {
      $('#grade-error').innerHTML = html`<div class="error">${esc(err)}</div>`;
      return;
    }
    gradingDraft.scale.sort((a, b) => a.min - b.min);
    if (gradingSubject) {
      editing.subject.grading = gradingDraft;
      drawEditor();
    } else {
      const before = structuredClone(data);
      sem().grading = gradingDraft;
      sem().gradeChoice = 'custom';
      if (!(await persist())) {
        data = before;
        return;
      }
      $('#modal').close();
      render();
    }
    gradingDraft = null;
  }
  if (a === 'save-sub') {
    const s = editing.subject;
    if (editing.shared) {
      s.name = s.name || 'Shared';
      s.credits = s.credits || 1;
    }
    s.components.forEach((c) => (c.id ||= uid()));
    const err = validateSubject(s) || (s.grading ? validateGrading(s.grading) : '');
    if (err) {
      $('#editor-error').innerHTML = html`<div class="error">${esc(err)}</div>`;
      return;
    }
    const before = structuredClone(data);
    if (editing.shared) {
      for (const x of sem().subjects) {
        x.components = s.components.map((c) => {
          const old = x.components.find(
            (o) => o.name === c.name && o.max === c.max && o.average === c.average,
          );
          return {
            ...structuredClone(c),
            id: old?.id || uid(),
            score: old?.score ?? null,
            scores: c.average ? old?.scores || [null, null] : undefined,
          };
        });
      }
    } else {
      const i = sem().subjects.findIndex((x) => x.id === s.id);
      if (i < 0) sem().subjects.push(s);
      else sem().subjects[i] = s;
    }
    if (!(await persist())) {
      data = before;
      return;
    }
    $('#modal').close();
    editing = null;
    render();
    toast('Your semester is up to date.');
  }
  if (a === 'delete-sub') {
    openModal(
      html`<h2>Remove ${esc(editing.subject.name)}?</h2>
        <p class="insight muted">
          This removes the subject and its recorded scores from this semester.
        </p>
        <div class="row">
          <button class="btn secondary" data-action="cancel-delete">Keep subject</button
          ><button class="btn" data-action="confirm-delete">Remove subject</button>
        </div>`,
    );
  }
  if (a === 'cancel-delete') drawEditor();
  if (a === 'confirm-delete') {
    const before = structuredClone(data);
    sem().subjects = sem().subjects.filter((x) => x.id !== editing.subject.id);
    if (!(await persist())) {
      data = before;
      return;
    }
    $('#modal').close();
    editing = null;
    render();
  }
  if (a === 'save-scenario') {
    const name = $('#scenario-name').value.trim();
    if (!name) {
      toast('Give your scenario a name.');
      return;
    }
    const before = structuredClone(data);
    if (scenario !== 'custom') {
      custom = pendingEstimates(sem(), rates[scenario]);
      scenario = 'custom';
    }
    data.scenarios.push({
      id: uid(),
      name,
      semester: sem().id,
      normal,
      custom: structuredClone(custom),
    });
    if (!(await persist())) {
      data = before;
      return;
    }
    render();
    toast('Scenario saved.');
  }
  if (a === 'new-sem') newSemester();
  if (a === 'create-sem') {
    const n = +$('#new-sem-number').value;
    if (!Number.isInteger(n) || n < 1) {
      $('#sem-error').textContent = 'Enter a positive whole semester number.';
      return;
    }
    if (data.semesters.some((s) => +s.number === n)) {
      $('#sem-error').textContent =
        'That semester already exists. Choose it from the semester selector.';
      return;
    }
    data.semesters.push({
      id: uid(),
      number: n,
      nickname: '',
      degree: '',
      college: '',
      year: '',
      grading: structuredClone(sem().grading),
      subjects: [],
    });
    data.current = data.semesters.length - 1;
    page = 'subjects';
    persist();
    $('#modal').close();
    render();
  }
  if (a === 'workbook-equivalent') {
    const t = stats(sem(), 0);
    toast(
      `Default reference (blanks → 0; all credits): ${fmt(t.gpa)}. This is not a confirmed GPA.`,
    );
  }
});
document.addEventListener('input', (e) => {
  const el = e.target;
  if (el.dataset.academicField) {
    const modal = !!el.closest('#academic-fields');
    const a = modal ? academicDraft : (sem().academic ||= emptyAcademic());
    const history = el.closest('[data-history-index]');
    (history ? a.history[+history.dataset.historyIndex] : a)[el.dataset.academicField] = el.value;
    if (!modal) persist();
    const preview = $('#academic-preview');
    if (preview) preview.innerHTML = academicPreview(a);
    return;
  }
  if (el.dataset.profile) {
    data[el.dataset.profile] = el.value;
    persist();
  }
  if (el.dataset.quiz) {
    const [i, j] = el.dataset.quiz.split(',').map(Number);
    editing.subject.components[i].scores[j] = num(el.value);
    return;
  }
  if (el.dataset.field) {
    const key = el.dataset.field;
    if (el.closest('#grading-fields')) {
      const band = el.closest('[data-band]');
      const obj = band ? gradingDraft.scale[+band.dataset.band] : gradingDraft;
      obj[key] = el.type === 'number' ? num(el.value) : el.value;
      return;
    }
    if (el.closest('#editor-fields')) {
      const comp = el.closest('[data-comp]');
      const obj = comp ? editing.subject.components[+comp.dataset.comp] : editing.subject;
      obj[key] = el.type === 'number' ? num(el.value) : el.value;
      return;
    }
    const sub = el.closest('[data-sub]');
    const obj = sub ? sem().subjects.find((x) => x.id === sub.dataset.sub) : sem();
    obj[key] = el.value;
    persist();
    if (key === 'number' && !data.done && data.step === 2) {
      const slot = $('#academic-slot');
      if (slot)
        slot.innerHTML =
          +sem().number > 1
            ? '<section class="panel academic-onboard">' +
              academicForm(sem().academic || emptyAcademic()) +
              '</section>'
            : '';
    }
    if ($('.credit-summary'))
      $('.credit-summary').textContent =
        `${sem().subjects.length} subjects · ${fmt(sem().subjects.reduce((a, x) => a + (+x.credits || 0), 0))} credits`;
  }
  if (el.id === 'search') {
    query = el.value;
    render();
  }
  if (el.dataset.rate) {
    rates = changeAssumption(rates, el.dataset.rate, Number(el.value));
    normal = rates.normal;
    data.normal = normal;
    data.assumptions = { worst: rates.worst, best: rates.best };
    persist();
    previewLab();
  }
  if (el.dataset.sim) {
    const c = sem()
      .subjects.flatMap((s) => s.components)
      .find((c) => c.id === el.dataset.sim);
    if (scenario !== 'custom') {
      custom = pendingEstimates(sem(), rates[scenario]);
      scenario = 'custom';
    }
    custom[c.id] = Math.max(0, Math.min(c.max, num(el.value) || 0));
    previewLab(el);
  }
});
function previewLab(active = null) {
  const s = sem(),
    a = rates[scenario === 'custom' ? 'normal' : scenario] / 100;
  for (const [id, factor] of [
    ['worst', rates.worst / 100],
    ['normal', normal / 100],
    ['best', rates.best / 100],
    ['custom', normal / 100],
  ]) {
    const card = document.querySelector(`[data-scenario="${id}"]`);
    if (card) {
      card.classList.toggle('active', id === scenario);
      card.querySelector('strong').textContent = fmt(
        stats(s, factor, id === 'custom' ? custom : {}).gpa,
      );
      const desc = card.querySelector('small');
      desc.textContent =
        id === 'custom'
          ? 'Your individual estimates'
          : `${rates[id]}% ${id === 'worst' ? 'cautious' : id === 'best' ? 'optimistic' : 'expected'} assumption`;
    }
  }
  for (const id of ['worst', 'normal', 'best']) {
    document.querySelectorAll(`[data-rate="${id}"]`).forEach((el) => {
      el.value = rates[id];
    });
    const label = document.querySelector(`[data-rate-label="${id}"]`);
    if (label) label.textContent = rates[id] + '%';
  }
  const projected = stats(s, a, scenario === 'custom' ? custom : {});
  $('[data-live-gpa]').textContent = fmt(projected.gpa);
  if ($('[data-live-cgpa]'))
    $('[data-live-cgpa]').textContent = fmt(
      cumulative(s, data.semesters, a, scenario === 'custom' ? custom : {}).gpa,
    );
  $('[data-selected-case]').textContent = scenario === 'custom' ? 'Custom' : scenario;
  $('[data-live-target]').textContent =
    data.target !== ''
      ? projected.gpa >= +data.target
        ? 'At or above your ' + data.target + ' target'
        : 'Below your ' + data.target + ' target'
      : 'Set a target to compare your forecast.';
  for (const sub of s.subjects) {
    const r = result(sub, s.grading, a, scenario === 'custom' ? custom : {});
    const gradeEl = document.querySelector(`[data-forecast-grade="${sub.id}"]`),
      detail = document.querySelector(`[data-forecast-detail="${sub.id}"]`);
    if (gradeEl) gradeEl.textContent = r.grade?.label || '—';
    if (detail)
      detail.textContent = `${fmt(r.value)} final marks · ${fmt(r.weighted)} weighted points`;
    for (const c of sub.components) {
      if (rawScore(c) !== null) continue;
      const estimate = scenario === 'custom' ? (custom[c.id] ?? (c.max * normal) / 100) : c.max * a;
      document.querySelectorAll(`[data-sim="${c.id}"]`).forEach((el) => {
        if (el !== active) el.value = el.type === 'range' ? estimate : fmt(estimate);
      });
    }
  }
}
document.addEventListener('change', async (e) => {
  const el = e.target;
  if (el.id === 'semester') {
    data.current = +el.value;
    custom = {};
    persist();
    render();
  }
  if (el.id === 'sort') {
    sort = el.value;
    render();
  }
  if (el.dataset.rate || el.dataset.sim) previewLab(el);
  if (el.id === 'target') {
    const v = num(el.value);
    if (v !== null && (v < 0 || v > sem().grading.maxPoints)) {
      toast('Target must be within your grade-point scale.');
      return;
    }
    data.target = v === null ? '' : v;
    persist();
    render();
  }
  if (el.id === 'assessment-preset' && el.value) {
    editing.subject.mode = el.value;
    const prior = editing.subject.components;
    editing.subject.components = preset(el.value).map((c) => {
      const existing = prior.find(
        (p) => p.name.toLowerCase() === c.name.toLowerCase() && p.max === c.max && !p.average,
      );
      return { ...c, id: existing?.id || uid(), score: existing?.score ?? null };
    });
    drawEditor();
  }
  if (el.id === 'import-file' && el.files[0]) {
    try {
      const incoming = JSON.parse(await el.files[0].text());
      validateBackup(incoming);
      const mode = data.done ? $('#import-mode')?.value || 'merge' : 'replace';
      pendingImport = { incoming, mode };
      openModal(
        html`<h2>
            ${!data.done
              ? 'Restore your academic records?'
              : mode === 'replace'
                ? 'Replace all records?'
                : 'Merge this backup?'}
          </h2>
          <p class="insight">
            <b>${esc(incoming.name)}</b> · ${incoming.semesters.length} semesters ·
            ${incoming.semesters.reduce((n, s) => n + s.subjects.length, 0)} subjects.
          </p>
          <p class="insight muted">
            ${!data.done
              ? 'This replaces your current onboarding setup and opens your restored dashboard.'
              : mode === 'replace'
                ? 'Current records will be replaced. Export a JSON backup first if you want to keep them.'
                : 'Your current records will be kept; imported semesters receive new identifiers.'}
          </p>
          <div class="row">
            <button class="btn secondary" data-action="close">Cancel</button
            ><button class="btn" id="confirm-import">
              ${!data.done
                ? 'Restore & open dashboard'
                : mode === 'replace'
                  ? 'Replace records'
                  : 'Merge backup'}
            </button>
          </div>`,
      );
    } catch (err) {
      const message = 'Backup not restored: ' + err.message;
      const feedback = $('#import-error');
      if (feedback) {
        feedback.className = 'error';
        feedback.textContent = message;
      } else toast(message);
    }
    el.value = '';
  }
});
let pendingImport;
document.addEventListener('click', async (e) => {
  if (!e.target.closest('#confirm-import') || !pendingImport) return;
  try {
    const incoming = restoreBackup(data, pendingImport.incoming, pendingImport.mode);
    upgradeDefaultGrading(incoming);
    await save(incoming);
    data = incoming;
    updateSaveStatus('Saved on this device');
    rates = assumptions(data);
    normal = rates.normal;
    custom = {};
    query = '';
    error = '';
    editing = null;
    page = 'overview';
    pendingImport = null;
    $('#modal').close();
    render();
    window.scrollTo(0, 0);
    toast('Backup restored.');
  } catch (err) {
    toast('Backup not restored: ' + err.message);
  }
});
document.addEventListener('keydown', (e) => {
  if (
    e.key === 'Enter' &&
    !data.done &&
    data.welcomeSeen &&
    !$('#modal').open &&
    e.target.tagName === 'INPUT' &&
    ![5, 6].includes(data.step)
  ) {
    e.preventDefault();
    next();
  }
});
// Older saved profiles may lack assessment IDs used by scenarios.
for (const s of data.done ? data.semesters : [data.draft])
  for (const x of s.subjects) for (const c of x.components) c.id ||= uid();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
await revealDashboard({ loading: true });
