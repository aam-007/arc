import { $, html, esc, icon } from './ui.js';
function focusDashboardHeading() {
  const h = $('#app h1');
  if (h) {
    h.tabIndex = -1;
    h.focus({ preventScroll: true });
  }
}
export async function playArrival({ render, name, loading = false }) {
  const root = $('#app'),
    reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) {
    render();
    const fade = root.animate([{ opacity: 0.8 }, { opacity: 1 }], { duration: 120 });
    await fade.finished.catch(() => {});
    focusDashboardHeading();
    return;
  }
  const overlay = document.createElement('div');
  overlay.className = 'dashboard-handoff';
  overlay.setAttribute('role', 'status');
  overlay.setAttribute('aria-live', 'polite');
  overlay.innerHTML = html`<div class="handoff-light"></div>
    <div class="handoff-copy">
      <svg class="handoff-mark" viewBox="0 0 160 140" fill="none" aria-hidden="true">
        <path
          pathLength="1"
          d="M20 120Q80-38 140 120M43 80h74"
          stroke="currentColor"
          stroke-width="4"
          stroke-linecap="round"
        />
      </svg>
      <div class="eyebrow">${loading ? 'Your academic studio' : 'A new perspective'}</div>
      <h1>
        ${loading
          ? name
            ? 'Welcome back, ' + esc(name) + '.'
            : 'Welcome to ARC.'
          : 'All set, ' + esc(name) + '.'}
      </h1>
      <p>
        ${loading ? 'A little clarity. A lot of possibility.' : 'Welcome to your academic studio.'}
      </p>
      <span class="handoff-saved"
        >${icon('check')}
        ${loading
          ? 'Saved locally. Not synced across devices.'
          : 'Your semester is saved on this device.'}</span
      >
    </div>
    <div class="handoff-dust" aria-hidden="true">
      ${Array.from(
        { length: 24 },
        (_, i) =>
          html`<i
            style="--x:${14 + ((i * 29) % 75)}%;--y:${12 + ((i * 17) % 79)}%;--delay:${(i % 7) *
            65}ms;--drift:${(i % 2 ? 1 : -1) * (18 + (i % 5) * 8)}px"
          ></i>`,
      ).join('')}
    </div>`;
  document.body.append(overlay);
  document.body.classList.add('in-handoff');
  root.inert = true;
  const dissolve = overlay.animate(
    [
      { opacity: 0, maskPosition: '0% 0%', offset: 0 },
      { opacity: 1, maskPosition: '0% 0%', offset: 0.16 },
      { opacity: 1, maskPosition: '0% 0%', offset: 0.4 },
      { opacity: 0, maskPosition: '100% 100%', offset: 1 },
    ],
    { duration: 1900, easing: 'cubic-bezier(.22,.61,.36,1)', fill: 'forwards' },
  );
  try {
    await root.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: 'forwards' })
      .finished;
    render();
    window.scrollTo(0, 0);
    root.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 950, delay: 180, fill: 'forwards' });
    root
      .querySelectorAll('.metrics .panel,.cgpa-panel,.page-content>section,.chart-row>.panel')
      .forEach((el, i) =>
        el.animate([{ transform: 'translateY(16px)' }, { transform: 'translateY(0)' }], {
          duration: 850,
          delay: 250 + Math.min(i, 6) * 60,
          easing: 'cubic-bezier(.16,1,.3,1)',
          fill: 'backwards',
        }),
      );
    await dissolve.finished;
  } catch {
    render();
  } finally {
    overlay.remove();
    document.body.classList.remove('in-handoff');
    root.inert = false;
    root.getAnimations().forEach((a) => a.cancel());
    focusDashboardHeading();
  }
}
