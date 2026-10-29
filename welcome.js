import { html, brand, themeDots, icon, footerNote } from './ui.js';
export function welcome(theme) {
  const shortcut = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl';
  return html`<header class="topbar">
      ${brand()}<span class="top-note">YOUR NEXT CHAPTER STARTS HERE.</span>${themeDots(theme)}
    </header>
    <main class="welcome-shell">
      <section class="welcome-intro">
        <div class="eyebrow">Before we begin</div>
        <h1>A place for<br />your progress.</h1>
        <p class="welcome-lead">
          Give ARC a place in your bookmarks.<br />Keep your academic journey close.
        </p>
        <div class="welcome-facts">
          <div>
            <span class="welcome-fact-icon">${icon('lock')}</span>
            <div>
              <h3>Saved here, ready when you return.</h3>
              <p>
                Your setup, subjects, and marks persist in this browser on this device. Clearing
                browser data can remove them.
              </p>
            </div>
          </div>
          <div>
            <span class="welcome-fact-icon">${icon('overview')}</span>
            <div>
              <h3>Local storage. No automatic device sync.</h3>
              <p>
                Your records do not automatically follow you to another device, browser, or browser
                profile.
              </p>
            </div>
          </div>
          <div>
            <span class="welcome-fact-icon">${icon('download')}</span>
            <div>
              <h3>A backup keeps your story moving.</h3>
              <p>
                Export a JSON backup anytime from Settings. Import it here, during setup, or in
                Settings to continue on another device.
              </p>
            </div>
          </div>
        </div>
        <div class="welcome-actions">
          <button class="btn" data-action="start-setup">Start my setup ${icon('arrow')}</button
          ><button class="btn link" data-action="onboard-import">Import a backup</button>
        </div>
      </section>
      <aside class="panel welcome-bookmark">
        <div class="welcome-browser" aria-hidden="true">
          <div class="welcome-browser-bar"><i></i><i></i><i></i></div>
          <div class="welcome-bookmark-bar">
            <span class="welcome-bookmark-label"
              ><svg viewBox="0 0 32 32" fill="none">
                <path
                  d="M4 25Q16-3 28 25M9 18h14"
                  stroke="currentColor"
                  stroke-width="2.7"
                  stroke-linecap="round"
                />
              </svg>
              ARC</span
            ><span>Your academic studio</span>
          </div>
          <div class="welcome-arc">
            <svg viewBox="0 0 160 140" fill="none">
              <path
                d="M20 120Q80-38 140 120M43 80h74"
                stroke="currentColor"
                stroke-width="5"
                stroke-linecap="round"
              />
            </svg>
          </div>
          <div class="welcome-browser-caption">One semester at a time.</div>
        </div>
        <div class="eyebrow">Make it easy to come back</div>
        <h2>Add ARC to your bookmarks bar.</h2>
        <div class="bookmark-shortcut"><kbd>${shortcut}</kbd><span>+</span><kbd>D</kbd></div>
        <p>
          Use the shortcut or your browser’s Bookmark / Add to favorites menu, then choose the
          bookmarks or favorites bar if available.
        </p>
        <small
          >A bookmark saves the link. A JSON backup saves your records. You can continue setup
          without bookmarking.</small
        >
      </aside>
    </main>
    ${footerNote('No accounts. Your progress, on your terms.')}`;
}
