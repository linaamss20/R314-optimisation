(function () {
  const state = {
    fcp: null,
    lcp: null,
    cls: 0,
    totalBlockingTime: 0,
    totalRequests: 0,
    totalBytes: 0
  };

  const fmtMs = v => v == null ? '-' : `${Math.round(v)} ms`;
  const fmtKB = v => v == null ? '-' : `${(v / 1024).toFixed(1)} KB`;

  let scheduled = false;
  function scheduleUpdate() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      updateUI();
    });
  }

  /* ---------- Observers ---------- */

  // FCP
  new PerformanceObserver(list => {
    const entry = list.getEntries().find(e => e.name === 'first-contentful-paint');
    if (entry && state.fcp == null) {
      state.fcp = entry.startTime;
      scheduleUpdate();
    }
  }).observe({ type: 'paint', buffered: true });

  // LCP
  const poLcp = new PerformanceObserver(list => {
    const last = list.getEntries().at(-1);
    if (last) {
      state.lcp = last.startTime;
      scheduleUpdate();
    }
  });
  poLcp.observe({ type: 'largest-contentful-paint', buffered: true });
  addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') poLcp.disconnect();
  });

  // CLS
  new PerformanceObserver(list => {
    for (const e of list.getEntries()) {
      if (!e.hadRecentInput) state.cls += e.value;
    }
    scheduleUpdate();
  }).observe({ type: 'layout-shift', buffered: true });

  // Long tasks → TBT
  new PerformanceObserver(list => {
    for (const e of list.getEntries()) {
      state.totalBlockingTime += Math.max(0, e.duration - 50);
    }
    scheduleUpdate();
  }).observe({ entryTypes: ['longtask'] });

  /* ---------- Ressources ---------- */

  function collectResources() {
    const resources = performance.getEntriesByType('resource');
    state.totalRequests = resources.length + 1;

    let total = 0;
    for (const r of resources) {
      total += r.transferSize || r.encodedBodySize || 0;
    }
    state.totalBytes = total;
  }

  /* ---------- UI ---------- */

  const panel = document.createElement('div');
  panel.id = 'perf-panel';
  panel.style.cssText = `
    position:fixed;right:16px;bottom:16px;z-index:9999;
    width:320px;font-family:system-ui;
    background:#0a0c1c;color:#e8ecf1;
    border-radius:12px;padding:12px;
    box-shadow:0 10px 40px rgba(0,0,0,.5)
  `;

  panel.innerHTML = `
    <strong>Évaluation perfs</strong>
    <div>FCP: <span id="fcp">-</span></div>
    <div>LCP: <span id="lcp">-</span></div>
    <div>CLS: <span id="cls">-</span></div>
    <div>TBT: <span id="tbt">-</span></div>
    <div>Req: <span id="req">-</span></div>
    <div>Poids: <span id="bytes">-</span></div>
    <button id="refresh">Mesurer</button>
  `;

  document.addEventListener('DOMContentLoaded', () => {
    document.body.appendChild(panel);
  });

  function updateUI() {
    collectResources();
    panel.querySelector('#fcp').textContent = fmtMs(state.fcp);
    panel.querySelector('#lcp').textContent = fmtMs(state.lcp);
    panel.querySelector('#cls').textContent = state.cls.toFixed(3);
    panel.querySelector('#tbt').textContent = fmtMs(state.totalBlockingTime);
    panel.querySelector('#req').textContent = state.totalRequests;
    panel.querySelector('#bytes').textContent = fmtKB(state.totalBytes);

    window.__metrics = { ...state };
  }

  panel.addEventListener('click', e => {
    if (e.target.id === 'refresh') updateUI();
  });

  addEventListener('load', () => setTimeout(updateUI, 0));
})();

