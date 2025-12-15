/* metrics.js — Widget d'évaluation des performances (Optimized)
   Shadow DOM, RAF Debouncing, Modern Syntax. */
(function() {
  // Configuration
  const CONF = {
    refreshRate: 500, // Ms min entre 2 scans de ressources lourds
    styles: `
      :host { font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; }
      #perf-panel {
        position: fixed; right: 16px; bottom: 16px; z-index: 10000;
        width: 300px; max-width: 90vw;
        background: rgba(10, 12, 28, 0.95); color: #E8ECF1;
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 12px; box-shadow: 0 10px 40px rgba(0,0,0,0.5);
        backdrop-filter: blur(8px); padding: 14px;
        font-size: 13px; line-height: 1.4;
      }
      .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
      .title { font-weight: 700; letter-spacing: 0.5px; color: #fff; }
      .btn-group { display: flex; gap: 6px; }
      button { cursor: pointer; border: none; border-radius: 6px; font-size: 11px; font-weight: 600; padding: 4px 8px; transition: opacity 0.2s; }
      button:hover { opacity: 0.8; }
      #btn-meas { background: #7C5CFF; color: white; }
      #btn-close { background: rgba(255,255,255,0.1); color: #ccc; }
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 12px; }
      .metric { display: flex; justify-content: space-between; }
      .label { opacity: 0.7; }
      .val { font-weight: 600; font-feature-settings: "tnum"; }
      .note { margin-top: 10px; font-size: 11px; opacity: 0.5; font-style: italic; text-align: center; }
    `
  };

  const state = {
    fcp: null, lcp: null, cls: 0,
    longTasks: 0, tbt: 0,
    reqCount: 0, reqBytes: 0,
    rafId: null
  };

  // Formatters
  const fmt = (n, u) => n == null ? '-' : `${n.toFixed(n < 1 ? 3 : 0)}${u}`;
  const fmtKB = n => n == null ? '-' : `${(n / 1024).toFixed(1)} KB`;

  // --- Observers ---
  const observers = [];
  const safeObserve = (type, cb, opts) => {
    try {
      const po = new PerformanceObserver(list => cb(list));
      po.observe({ type, ...opts });
      observers.push(po);
      return po;
    } catch (e) { /* Pas supporté */ }
  };

  // 1. Paint (FCP)
  safeObserve('paint', (list) => {
    const entry = list.getEntriesByName('first-contentful-paint')[0];
    if (entry && !state.fcp) {
      state.fcp = entry.startTime;
      scheduleUpdate();
    }
  }, { buffered: true });

  // 2. LCP
  const poLcp = safeObserve('largest-contentful-paint', (list) => {
    const entry = list.getEntries().pop();
    if (entry) {
      state.lcp = entry.renderTime || entry.loadTime;
      scheduleUpdate();
    }
  }, { buffered: true });

  // Stop LCP on interaction
  ['click', 'keydown', 'scroll'].forEach(evt => {
    addEventListener(evt, () => poLcp?.disconnect(), { once: true, passive: true });
  });

  // 3. CLS
  safeObserve('layout-shift', (list) => {
    for (const e of list.getEntries()) {
      if (!e.hadRecentInput) state.cls += e.value;
    }
    scheduleUpdate();
  }, { buffered: true });

  // 4. Long Tasks (TBT Approx)
  safeObserve('longtask', (list) => {
    for (const e of list.getEntries()) {
      state.longTasks++;
      state.tbt += Math.max(0, e.duration - 50);
    }
    scheduleUpdate();
  });

  // --- Logic ---
  function scanResources() {
    const entries = performance.getEntriesByType('resource');
    state.reqCount = entries.length + 1; // + document
    state.reqBytes = entries.reduce((acc, r) => 
      acc + (r.transferSize > 0 ? r.transferSize : (r.encodedBodySize || 0)), 0);
  }

  // UI Render Loop (Debounced)
  function scheduleUpdate(fullScan = false) {
    if (fullScan) scanResources();
    if (state.rafId) return;
    
    state.rafId = requestAnimationFrame(() => {
      render();
      state.rafId = null;
    });
  }

  // UI Construction (Shadow DOM)
  const host = document.createElement('div');
  const shadow = host.attachShadow({ mode: 'closed' }); 
  // Note: 'closed' empêche l'accès facile via JS externe, 'open' est ok aussi.
  
  function initUI() {
    host.id = 'web-vitals-widget';
    shadow.innerHTML = `<style>${CONF.styles}</style>
      <div id="perf-panel">
        <div class="header">
          <span class="title">Perf. Metrics</span>
          <div class="btn-group">
            <button id="btn-meas">Scan</button>
            <button id="btn-close">×</button>
          </div>
        </div>
        <div class="grid">
          <div class="metric"><span class="label">FCP</span><span class="val" id="v-fcp">-</span></div>
          <div class="metric"><span class="label">LCP</span><span class="val" id="v-lcp">-</span></div>
          <div class="metric"><span class="label">CLS</span><span class="val" id="v-cls">-</span></div>
          <div class="metric"><span class="label">TBT</span><span class="val" id="v-tbt">-</span></div>
          <div class="metric"><span class="label">Reqs</span><span class="val" id="v-req">-</span></div>
          <div class="metric"><span class="label">Weight</span><span class="val" id="v-wgt">-</span></div>
        </div>
        <div class="note">Valeurs approximatives (Client-side)</div>
      </div>`;
    
    document.body.appendChild(host);

    // Bind Events inside Shadow DOM
    shadow.getElementById('btn-meas').onclick = () => scheduleUpdate(true);
    shadow.getElementById('btn-close').onclick = () => {
        host.remove();
        observers.forEach(po => po.disconnect());
    };
  }

  function render() {
    // Helper pour cibler dans le shadow
    const $ = id => shadow.getElementById(id);
    if (!$('v-fcp')) return; // UI pas encore prête

    $('v-fcp').textContent = fmt(state.fcp, ' ms');
    $('v-lcp').textContent = fmt(state.lcp, ' ms');
    $('v-cls').textContent = state.cls.toFixed(3);
    $('v-tbt').textContent = fmt(state.tbt, ' ms');
    $('v-req').textContent = state.reqCount || '-';
    $('v-wgt').textContent = fmtKB(state.reqBytes);

    // Expose API
    window.__metrics = { ...state };
  }

  // Init
  if (document.readyState === 'loading') {
    addEventListener('DOMContentLoaded', () => {
        initUI();
        setTimeout(() => scheduleUpdate(true), 500); // Délai pour laisser charger
    });
  } else {
    initUI();
    scanResources();
    render();
  }

})();
