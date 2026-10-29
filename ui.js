export function html(strings, ...values) {
  return strings.reduce(
    (output, part, index) => output + part + (index < values.length ? values[index] : ''),
    '',
  );
}
export const $ = (s) => document.querySelector(s),
  esc = (s) =>
    String(s ?? '').replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
    ),
  fmt = (n, d = 2) => (n === null || n === undefined ? '—' : Number(n).toFixed(d)),
  num = (v) => (v === '' ? null : Number(v));
const paths = {
  overview: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  subjects: 'M4 4h6q2 0 2 2q0-2 2-2h6v15h-6q-2 0-2 2q0-2-2-2H4zM12 6v15',
  lab: 'M8 3h8M10 3v7L4 20h16l-6-10V3M8 14h8',
  insights: 'M4 20V12M10 20V5M16 20v-9M22 20V2',
  settings: 'M4 7h16M4 17h16M9 3v8M16 13v8',
  arrow: 'M4 12h16M14 6l6 6-6 6',
  lock: 'M6 10h12v11H6zM8 10V6a4 4 0 0 1 8 0v4',
  plus: 'M12 4v16M4 12h16',
  close: 'M5 5l14 14M19 5L5 19',
  check: 'M4 12l5 5L20 6',
  spark: 'M12 2l3 7 7 3-7 3-3 7-3-7-7-3 7-3z',
  download: 'M12 3v12M7 10l5 5 5-5M4 17v4h16v-4',
};
export const icon = (n) =>
  html`<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
    <path d="${paths[n] || paths.spark}" />
  </svg>`;
export const brand = () =>
  html`<div class="brand">
    <svg viewBox="0 0 32 32" fill="none">
      <path
        d="M4 25Q16-3 28 25M9 18h14"
        stroke="currentColor"
        stroke-width="2.7"
        stroke-linecap="round"
      /></svg
    >ARC<span style="font-size:9px;letter-spacing:0;align-self:flex-start;margin-top:3px">®</span>
  </div>`;
export const themes = [
  ['glass', 'Modern Glass', 'A little clarity. A little depth.', '#d3e2e9'],
  ['cozy', 'Retro Cozy', 'Warm tones. A slower rhythm.', '#d0b891'],
  ['white', 'Plain White', 'Only what matters.', '#fff'],
  ['black', 'Plain Black', 'Focus, without distraction.', '#172126'],
];
export const themeDots = (theme) =>
  html`<div class="theme-switch" aria-label="Choose appearance">
    ${themes
      .map(
        (t) =>
          html`<button
            class="theme-dot ${theme === t[0] ? 'active' : ''}"
            data-theme="${t[0]}"
            title="${t[1]}"
            aria-label="${t[1]}"
            aria-pressed="${theme === t[0]}"
            style="background:${t[3]}"
          ></button>`,
      )
      .join('')}
  </div>`;
export const field = (label, key, val, type = 'text', extra = '') =>
  html`<label
    >${label}<input type="${type}" data-field="${key}" value="${esc(val)}" ${extra}
  /></label>`;
export function mini(t) {
  return html`<div class="mini ${t}">
    <div class="mini-header"><b>ARC</b><span>YOUR ACADEMIC STUDIO</span></div>
    <div class="mini-title">YOUR NEXT CHAPTER</div>
    <div class="mini-number">
      Aa<span style="font-size:10px;letter-spacing:0;margin-left:9px">01 / 08</span>
    </div>
    <div class="mini-bars">
      ${[35, 55, 42, 75, 65, 90].map((h) => html`<i style="height:${h}%"></i>`).join('')}
    </div>
  </div>`;
}
export function scaleView(g) {
  return html`<div class="scale">
    ${[...g.scale]
      .sort((a, b) => a.min - b.min)
      .map((b) => html`<div><b>${esc(b.label)}</b><small>≥ ${b.min} · ${b.points} pt</small></div>`)
      .join('')}
  </div>`;
}
export const projectCredit =
  'Credits to Chayan Kalia for building the first prototype for this project';
export const footerNote = (lead) =>
  html`<footer class="footer-note">
    <p>${lead}</p>
    <p class="project-credit">${projectCredit}</p>
  </footer>`;
