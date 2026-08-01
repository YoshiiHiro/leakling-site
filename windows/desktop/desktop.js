import {
  DEATH_AUTOPSY_EVENT,
  DEATH_CAUSES,
  MATCH_AUTOPSY_SUMMARY_EVENT,
  AUTOPSY_TAGGED_EVENT,
  OVERLAY_VISIBLE_MS
} from '../../scripts/constants.js';

const causeLabel = Object.fromEntries(DEATH_CAUSES.map((c) => [c.id, c.label]));

let feedbackTimer = null;

function getMain() {
  // In Electron, the controller runs in this same window
  if (window.electronAPI?.isElectron) {
    return window;
  }
  // Overwolf: background window is the "main" window
  return overwolf.windows.getMainWindow();
}

function getStore() {
  return getMain()?.autopsyStore || null;
}

function setStatus(text) {
  const el = document.getElementById('mock-status');
  if (el) el.textContent = text;
}

function formatDeath(payload) {
  if (!payload) return 'No payload';
  return `DEATH_AUTOPSY · ${payload.source} · round ${payload.round} · ${payload.side} · deaths ${payload.deaths}`;
}

function formatTime(ts) {
  try {
    return new Date(ts).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  } catch {
    return '—';
  }
}

function populateFocusSelect() {
  const select = document.getElementById('focus-select');
  if (!select) return;

  DEATH_CAUSES.forEach((cause) => {
    const opt = document.createElement('option');
    opt.value = cause.id;
    opt.textContent = cause.label;
    select.appendChild(opt);
  });
}

function renderFocus(store) {
  const valueEl = document.getElementById('focus-value');
  const select = document.getElementById('focus-select');
  const goal = store.getFocusGoal();

  if (valueEl) {
    valueEl.textContent = goal ? causeLabel[goal] || goal : 'No focus set';
  }
  if (select && select.value !== (goal || '')) {
    select.value = goal || '';
  }
}

function renderCauses(store) {
  const root = document.getElementById('cause-breakdown');
  const empty = document.getElementById('cause-empty');
  if (!root || !empty) return;

  const counts = store.aggregateCauseCounts(store.getAll());
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);

  root.innerHTML = '';

  if (!total) {
    empty.hidden = false;
    return;
  }

  empty.hidden = true;

  DEATH_CAUSES.forEach((cause) => {
    const count = counts[cause.id] || 0;
    const pct = total ? Math.round((count / total) * 100) : 0;

    const row = document.createElement('div');
    row.className = 'cause-row';
    row.innerHTML = `
      <span class="label">${cause.label}</span>
      <div class="track"><div class="fill" style="width:${pct}%"></div></div>
      <span class="count">${count}</span>
    `;
    root.appendChild(row);
  });
}

function renderRecent(store) {
  const list = document.getElementById('recent-list');
  const empty = document.getElementById('recent-empty');
  if (!list || !empty) return;

  const recent = store.listRecent(20);
  list.innerHTML = '';

  if (!recent.length) {
    empty.hidden = false;
    return;
  }

  empty.hidden = true;

  recent.forEach((entry) => {
    const li = document.createElement('li');
    if (entry.skipped) li.classList.add('skipped');

    const causeText = entry.skipped
      ? 'Skipped'
      : causeLabel[entry.cause] || entry.cause || '—';

    const metaParts = [];
    if (entry.round != null) metaParts.push(`R${entry.round}`);
    if (entry.side) metaParts.push(entry.side);
    metaParts.push(formatTime(entry.timestamp));

    li.innerHTML = `
      <span class="cause">${causeText}</span>
      <span class="meta">${metaParts.join(' · ')}</span>
    `;
    list.appendChild(li);
  });
}

function renderSummary(summary) {
  const panel = document.getElementById('summary-panel');
  const headline = document.getElementById('summary-headline');
  const topList = document.getElementById('summary-top');
  const focusEl = document.getElementById('summary-focus');
  if (!panel || !headline || !topList || !focusEl) return;

  if (!summary) {
    panel.hidden = true;
    return;
  }

  const outcome = summary.outcome ? String(summary.outcome) : 'match over';
  const tagged = summary.taggedCount ?? 0;
  headline.textContent = `${outcome} · ${tagged} tagged death${tagged === 1 ? '' : 's'}`;

  topList.innerHTML = '';
  const top = Array.isArray(summary.topCauses) ? summary.topCauses : [];
  if (!top.length) {
    const li = document.createElement('li');
    li.textContent = 'No tags this match';
    topList.appendChild(li);
  } else {
    top.forEach((item, index) => {
      const li = document.createElement('li');
      li.textContent = `${index + 1}. ${causeLabel[item.cause] || item.cause} (${item.count})`;
      topList.appendChild(li);
    });
  }

  const suggested = summary.suggestedFocus;
  focusEl.textContent = suggested
    ? `Suggested focus: ${causeLabel[suggested] || suggested}`
    : 'Suggested focus: none yet — tag a few deaths next match';

  panel.hidden = false;
}

function renderAll() {
  const store = getStore();
  if (!store) return;
  renderFocus(store);
  renderCauses(store);
  renderRecent(store);
}

function wireWindowControls() {
  document.getElementById('btn-minimize')?.addEventListener('click', () => {
    if (window.electronAPI?.minimizeWindow) {
      window.electronAPI.minimizeWindow();
    } else {
      // Overwolf fallback
      overwolf.windows.getCurrentWindow((result) => {
        if (result.success) overwolf.windows.minimize(result.window.id);
      });
    }
  });

  document.getElementById('btn-close')?.addEventListener('click', () => {
    if (window.electronAPI?.closeWindow) {
      window.electronAPI.closeWindow();
    } else {
      // Overwolf fallback
      overwolf.windows.getCurrentWindow((result) => {
        if (result.success) overwolf.windows.close(result.window.id);
      });
    }
  });
}

function showOverlayPreview() {
  const el = document.getElementById('mock-feedback-overlay');
  if (!el) return;
  el.hidden = false;

  const timerEl = document.getElementById('mock-feedback-timer');
  const tagsEl = document.getElementById('mock-feedback-tags');
  if (!timerEl || !tagsEl) return;

  let seconds = Math.ceil(OVERLAY_VISIBLE_MS / 1000);
  timerEl.textContent = String(seconds);

  tagsEl.innerHTML = '';
  DEATH_CAUSES.forEach((c) => {
    const btn = document.createElement('button');
    btn.className = 'mock-tag-btn';
    btn.textContent = c.label;
    tagsEl.appendChild(btn);
  });

  if (feedbackTimer) clearInterval(feedbackTimer);
  feedbackTimer = setInterval(() => {
    seconds -= 1;
    timerEl.textContent = String(Math.max(0, seconds));
    if (seconds <= 0) {
      clearInterval(feedbackTimer);
      feedbackTimer = null;
      el.hidden = true;
    }
  }, 1000);
}

function pickRandomCause() {
  return DEATH_CAUSES[Math.floor(Math.random() * DEATH_CAUSES.length)];
}

async function mainReady(main) {
  if (main?.simulateDeathAutopsy) return true;
  await new Promise((r) => setTimeout(r, 500));
  main = getMain();
  return Boolean(main?.simulateDeathAutopsy);
}

function wireMockControls(main) {
  const panel = document.getElementById('mock-panel');
  const pill = document.getElementById('mock-pill');
  const toggle = document.getElementById('mock-toggle');
  const actions = document.getElementById('mock-actions');

  if (panel) panel.hidden = false;
  if (pill) pill.hidden = false;

  let mockActive = true;

  function setMockActive(active) {
    mockActive = active;
    if (toggle) toggle.checked = active;
    if (actions) actions.style.opacity = active ? '1' : '0.4';
    if (actions) actions.style.pointerEvents = active ? 'auto' : 'none';
    setStatus(active ? 'Mock mode on — ready to simulate deaths' : 'Mock mode off — waiting for live game events');
  }

  toggle?.addEventListener('change', () => {
    setMockActive(toggle.checked);
  });

  document.getElementById('btn-simulate-death')?.addEventListener('click', async () => {
    if (!mockActive) return;
    if (!await mainReady(main)) {
      setStatus('Background not ready — reload the unpacked app.');
      return;
    }
    main = getMain();
    main.simulateDeathAutopsy();
    showOverlayPreview();
    setStatus('💀 Death simulated — overlay shown (6s)');
  });

  document.getElementById('btn-simulate-tag')?.addEventListener('click', async () => {
    if (!mockActive) return;
    if (!await mainReady(main)) {
      setStatus('Background not ready — reload the unpacked app.');
      return;
    }
    main = getMain();
    const payload = main.simulateDeathAutopsy();
    if (!payload) return;

    // Wait a beat, then auto-pick a random cause via the event bus
    setTimeout(() => {
      const cause = pickRandomCause();
      const bus = main?.owEventBus;
      if (bus) {
        bus.trigger(AUTOPSY_TAGGED_EVENT, {
          cause: cause.id,
          matchId: payload.matchId,
          round: payload.round,
          side: payload.side,
          timestamp: Date.now()
        });
      }
      setStatus(`🏷️ Auto-tagged: ${cause.label} (R${payload.round})`);
    }, 1200);

    showOverlayPreview();
  });

  document.getElementById('btn-end-mock-match')?.addEventListener('click', async () => {
    if (!mockActive) return;
    if (!await mainReady(main)) {
      setStatus('Background not ready — reload the unpacked app.');
      return;
    }
    main = getMain();
    const summary = main.endMockMatch('defeat');
    if (summary) {
      setStatus(
        `⏹ Match ended · ${summary.outcome} · ${summary.taggedCount} tagged · top: ${causeLabel[summary.topCauses?.[0]?.cause] || 'none'}`
      );
    }
  });

  document.getElementById('btn-reset-data')?.addEventListener('click', () => {
    const store = getStore();
    if (!store) {
      setStatus('Store not available');
      return;
    }
    store.clearAll();
    renderAll();
    const summaryPanel = document.getElementById('summary-panel');
    if (summaryPanel) summaryPanel.hidden = true;
    setStatus('🗑 All test data cleared');
  });
}

function wireFocusSelect() {
  document.getElementById('focus-select')?.addEventListener('change', (e) => {
    const store = getStore();
    if (!store) return;
    const value = e.target.value || null;
    store.setFocusGoal(value);
    renderFocus(store);
  });
}

function bindBus(main) {
  const bus = main?.owEventBus;
  if (!bus) {
    setTimeout(() => bindBus(getMain()), 250);
    return;
  }

  bus.on(DEATH_AUTOPSY_EVENT, (payload) => {
    setStatus(formatDeath(payload));
  });

  bus.on('autopsy-saved', () => {
    renderAll();
  });

  bus.on(MATCH_AUTOPSY_SUMMARY_EVENT, (summary) => {
    renderSummary(summary);
    renderAll();
  });

  renderAll();

}

populateFocusSelect();
wireWindowControls();
wireFocusSelect();

const main = getMain();
wireMockControls(main);
bindBus(main);
