/* AgentLeash × SKY Multi-Page App Shell & Cross-Page State Persistence */

(function (global) {
  "use strict";

  const STORAGE_KEY = "agentleash_mp_state_v1";

  const ROUTES = [
    { id: "overview", href: "./index.html", route: "/", label: "Tổng quan & Demo" },
    { id: "flows", href: "./flows.html", route: "/flows", label: "Dòng tiền x402" },
    { id: "policies", href: "./policies.html", route: "/policies", label: "Policy & Luật 2 tầng" },
    { id: "audit", href: "./audit.html", route: "/audit", label: "Bị từ chối & Rules" },
    { id: "mcp", href: "./mcp.html", route: "/mcp", label: "MCP Bên A – Bên B" },
  ];

  function mountMultiPageApp(pageId, onRenderPage) {
    const H = global.AgentLeashHud;
    if (!H) return;

    /* Inject shared Ribbon + Header + Shell + Kill Dialog once */
    const root = document.getElementById("mp-root");
    const activeRoute = ROUTES.find((r) => r.id === pageId) || ROUTES[0];

    root.innerHTML = `
      <a href="#mp-page-main" class="al-skip-link">Chuyển tới nội dung trang ${activeRoute.label}</a>

      <div class="al-proto-ribbon">
        <div style="display:flex;align-items:center;gap:0.55rem;flex-wrap:wrap;">
          <span class="al-chip al-chip--flow">BẢN CHIA NHIỀU TRANG (NEXT.JS APP ROUTER)</span>
          <span>Dữ liệu mô phỏng tự đồng bộ khi chuyển trang</span>
          <button type="button" id="mp-reset-all" class="al-btn" style="min-block-size:1.75rem;padding:0.15rem 0.6rem;font-size:0.75rem;">Đặt lại mẫu</button>
        </div>
        <nav class="al-proto-nav" aria-label="Chuyển giữa các bản mô phỏng">
          <a class="al-proto-link" href="../index.html">Cổng so sánh</a>
          <a class="al-proto-link" href="../01-hud-glass-skin.html">PA 1 (1 trang)</a>
          <a class="al-proto-link" href="../02-mission-control-3col.html">PA 2 (3 cột SKY)</a>
          <a class="al-proto-link" href="./index.html" aria-current="page">Nhiều trang (5 routes)</a>
        </nav>
      </div>

      <header class="al-hud-header">
        <div class="al-brand">
          <div class="mp-mobile-nav-wrap">
            <button type="button" class="al-btn mp-menu-trigger" popovertarget="mp-nav-popover" popovertargetaction="toggle" aria-controls="mp-nav-popover" style="min-block-size:2.1rem;padding:0.25rem 0.65rem;">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" stroke-linecap="round"/></svg>
              <span>Trang</span>
            </button>
            <div id="mp-nav-popover" class="mp-mobile-popover" popover="auto">
              <div class="al-hud-heading" style="margin-block-end:0.5rem;">Điều hướng Multi-Page</div>
              <nav aria-label="Điều hướng các trang di động">
                <ul class="mp-nav-list" id="mp-mobile-nav-list"></ul>
              </nav>
            </div>
          </div>

          <a href="./index.html" style="display:flex;align-items:center;gap:0.65rem;text-decoration:none;color:inherit;">
            <svg viewBox="0 0 28 28" width="30" height="30" fill="none" aria-hidden="true">
              <rect x="2" y="2" width="24" height="24" rx="7" fill="#0d1e38" stroke="rgba(122,222,255,0.35)" stroke-width="1.25"/>
              <path d="M14 6.25L20 8.75V13.6C20 17.35 17.45 20.65 14 21.75C10.55 20.65 8 17.35 8 13.6V8.75L14 6.25Z" stroke="#22d3ee" stroke-width="1.6" stroke-linejoin="round"/>
              <circle cx="14" cy="13.5" r="2.25" fill="#22c55e"/>
              <path d="M14 15.75V18.5" stroke="#22d3ee" stroke-width="1.6" stroke-linecap="round"/>
            </svg>
            <div>
              <div class="al-brand-title" translate="no">Agent<span>Leash</span></div>
              <div class="al-brand-sub">Route <code class="mono" style="color:var(--flow-text);">${activeRoute.route}</code> · ${activeRoute.label}</div>
            </div>
          </a>

          <span class="al-pill al-pill--amber">
            <span class="al-dot al-dot--sandbox al-dot--live" aria-hidden="true"></span>
            <span>DEMO: 120s (thực tế: 24h)</span>
          </span>
        </div>

        <div class="al-hud-cluster" id="mp-header-right"></div>
      </header>

      <div class="mp-shell">
        <aside class="mp-sidebar" aria-label="Thanh điều hướng và trạng thái nhanh">
          <section class="al-glass-panel mp-nav-card">
            <div style="display:flex;align-items:center;justify-content:space-between;">
              <span class="al-hud-heading">Các trang (Routes)</span>
              <span class="mono" style="font-size:0.75rem;color:var(--sky-muted);">App Router</span>
            </div>
            <nav aria-label="Điều hướng các trang AgentLeash">
              <ul class="mp-nav-list" id="mp-sidebar-nav-list"></ul>
            </nav>
          </section>

          <section class="al-glass-panel mp-nav-card" id="mp-sidebar-status"></section>
        </aside>

        <main id="mp-page-main" tabindex="-1" class="mp-main">
          <div id="mp-tx-mount"></div>
          <div id="mp-page-content" style="display:flex;flex-direction:column;gap:1.15rem;"></div>
        </main>
      </div>

      <dialog id="mp-kill-dialog" class="al-dialog al-dialog--danger" aria-labelledby="mp-kill-title">
        <form method="dialog" style="padding:1.35rem 1.5rem;display:flex;flex-direction:column;gap:1rem;">
          <div style="display:flex;align-items:flex-start;gap:0.85rem;">
            <div id="mp-kill-icon" style="inline-size:2.5rem;block-size:2.5rem;border-radius:10px;display:grid;place-items:center;flex-shrink:0;"></div>
            <div>
              <h2 id="mp-kill-title" style="font-size:1rem;font-weight:700;"></h2>
              <p id="mp-kill-desc" style="font-size:0.8125rem;color:var(--sky-muted);margin-block-start:0.25rem;"></p>
            </div>
          </div>
          <div class="al-inset-well mono" style="padding:0.55rem 0.75rem;font-size:0.75rem;color:var(--sky-muted);word-break:break-all;" id="mp-kill-policy"></div>
          <div style="display:flex;justify-content:flex-end;gap:0.625rem;">
            <button type="submit" value="cancel" autofocus class="al-btn">Hủy</button>
            <button type="submit" value="confirm" id="mp-kill-confirm" class="al-btn al-btn--danger">Xác nhận</button>
          </div>
        </form>
      </dialog>
    `;

    let lastStructureKey = "";
    const sim = H.createSimulation(renderShellAndPage);

    /* Restore persisted simulation state across real page navigations */
    try {
      const savedRaw = sessionStorage.getItem(STORAGE_KEY);
      if (savedRaw) {
        const saved = JSON.parse(savedRaw);
        Object.assign(sim.state, saved, { runningDemo: false, txBanner: null });
      }
    } catch {
      // Ignore storage errors on restricted file:// environments
    }

    function persistState() {
      try {
        const { runningDemo, txBanner, ...snapshot } = sim.state;
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
      } catch {
        // Ignore
      }
    }

    function computeStructureKey(s) {
      return JSON.stringify({
        a: s.authenticated,
        p: s.activePolicy,
        z: s.paused,
        b: s.bypassRules,
        bal: s.balanceUnits,
        sp: s.spentUnits,
        sb: s.sandboxSpentUnits,
        caps: [s.perTxCapUnits, s.dailyCapUnits, s.sandboxPerTxCapUnits, s.sandboxDailyCapUnits],
        wl: s.whitelist,
        sc: s.spends.length,
        rc: s.rejections.length,
        rd: s.runningDemo,
        tx: s.txBanner,
      });
    }

    document.getElementById("mp-reset-all").addEventListener("click", () => {
      try {
        sessionStorage.removeItem(STORAGE_KEY);
      } catch {}
      location.reload();
    });

    const killDialog = document.getElementById("mp-kill-dialog");
    H.initDialogs(document);

    function openKillDialog() {
      const pausing = !sim.state.paused;
      document.getElementById("mp-kill-title").textContent = pausing
        ? "Khóa khẩn cấp toàn bộ policy?"
        : "Mở khóa hoạt động policy?";
      document.getElementById("mp-kill-desc").textContent = pausing
        ? "Mọi khoản chi tiếp theo và các digest đã duyệt nhưng chưa settle đều bị chặn ở mọi trang."
        : "Agent được phép xin chi trở lại trong phần hạn mức còn lại.";
      document.getElementById("mp-kill-policy").textContent = "Policy: " + sim.state.activePolicy;
      const icon = document.getElementById("mp-kill-icon");
      icon.innerHTML = pausing ? H.ICONS.lock : H.ICONS.unlock;
      icon.style.background = pausing ? "rgba(239,68,68,0.14)" : "rgba(34,197,94,0.14)";
      icon.style.color = pausing ? "var(--danger-text)" : "var(--trusted-text)";
      const btn = document.getElementById("mp-kill-confirm");
      btn.textContent = pausing ? "Xác nhận khóa ngay" : "Mở khóa policy";
      btn.className = pausing ? "al-btn al-btn--danger" : "al-btn al-btn--trusted";
      killDialog.showModal();
    }

    killDialog.addEventListener("close", () => {
      const val = killDialog.returnValue;
      killDialog.returnValue = "";
      if (val === "confirm") sim.togglePause(!sim.state.paused);
    });

    function buildNavItems(s) {
      return ROUTES.map((r) => {
        const isCurrent = r.id === pageId;
        let badge = "";
        if (r.id === "flows") badge = `<span class="al-chip al-chip--flow tabular-nums">${s.spends.length}</span>`;
        else if (r.id === "audit") badge = `<span class="al-chip al-chip--danger tabular-nums">${s.rejections.length}</span>`;
        else if (r.id === "overview") {
          badge = `<span class="al-dot ${s.paused ? "al-dot--danger" : "al-dot--trusted"}" aria-hidden="true"></span>`;
        }
        return `
          <li>
            <a href="${r.href}" class="mp-nav-link" ${isCurrent ? 'aria-current="page"' : ""}>
              <span class="mp-nav-left">
                <span class="mp-nav-route">${r.route}</span>
                <span>${r.label}</span>
              </span>
              ${badge}
            </a>
          </li>
        `;
      }).join("");
    }

    function renderShellAndPage(s, d) {
      persistState();
      const key = computeStructureKey(s);
      if (key === lastStructureKey) {
        /* 1-second timer tick only: update countdowns/clocks in-place so form inputs never lose focus */
        const cd = H.formatCountdown(s.secondsToReset);
        const sideCd = document.getElementById("mp-side-countdown");
        if (sideCd) sideCd.textContent = cd;
        document.querySelectorAll("[data-mp-countdown]").forEach((el) => (el.textContent = cd));
        document.querySelectorAll("[data-mp-updated]").forEach((el) => (el.textContent = s.updatedAt));
        return;
      }
      lastStructureKey = key;

      /* Header right controls (always visible across every page) */
      document.getElementById("mp-header-right").innerHTML = `
        <span class="al-pill"><span class="al-dot al-dot--trusted"></span>Fuji Testnet</span>
        <a href="${H.addressUrl(s.activePolicy)}" target="_blank" rel="noreferrer" class="al-pill mono" style="color:var(--flow);">${H.shortAddr(s.activePolicy)} ${H.ICONS.arrowUpRight}</a>
        <span class="al-pill mono tabular-nums" style="color:var(--sky-text);font-weight:600;">${H.formatUsdc(s.balanceUnits)} USDC</span>
        ${
          s.authenticated
            ? `<button type="button" id="mp-auth-btn" class="al-pill" style="cursor:pointer;" title="Bấm để chuyển sang chế độ Khách">${s.userEmail}</button>`
            : `<button type="button" id="mp-auth-btn" class="al-btn al-btn--primary" style="min-block-size:2rem;">Đăng nhập Privy</button>`
        }
        <button type="button" id="mp-kill-btn" ${!s.authenticated ? "disabled" : ""} class="al-btn ${s.paused ? "al-btn--trusted" : "al-btn--danger"}">
          ${s.paused ? H.ICONS.unlock : H.ICONS.lock}
          <span>${s.paused ? "MỞ KHÓA" : "KHÓA KHẨN CẤP"}</span>
        </button>
      `;
      document.getElementById("mp-auth-btn").addEventListener("click", sim.toggleAuth);
      document.getElementById("mp-kill-btn").addEventListener("click", openKillDialog);

      /* Sidebar & Mobile Popover Nav */
      const navMarkup = buildNavItems(s);
      document.getElementById("mp-sidebar-nav-list").innerHTML = navMarkup;
      document.getElementById("mp-mobile-nav-list").innerHTML = navMarkup;

      /* Sidebar Quick Status Card */
      document.getElementById("mp-sidebar-status").innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span class="al-hud-heading">Trạng thái nhanh</span>
          <span class="al-chip ${s.paused ? "al-chip--danger" : "al-chip--trusted"}">${s.paused ? "PAUSED" : "ACTIVE"}</span>
        </div>
        <div class="al-inset-well" style="padding:0.65rem 0.75rem;display:flex;flex-direction:column;gap:0.35rem;font-size:0.78rem;">
          <div style="display:flex;justify-content:space-between;">
            <span style="color:var(--sky-muted);">Chi được ngay</span>
            <strong class="mono tabular-nums" style="color:${s.paused ? "var(--danger-text)" : "var(--flow-text)"};">${H.formatUsdc(d.spendableNow)} USDC</strong>
          </div>
          <div style="display:flex;justify-content:space-between;">
            <span style="color:var(--sky-muted);">Hồi chu kỳ sau</span>
            <strong id="mp-side-countdown" class="mono tabular-nums">${H.formatCountdown(s.secondsToReset)}</strong>
          </div>
        </div>
        <label style="display:flex;align-items:center;justify-content:space-between;gap:0.5rem;cursor:pointer;font-size:0.78rem;padding:0.25rem 0.1rem;">
          <span>Hack <code class="mono" style="color:var(--sandbox-text);">--bypass-rules</code></span>
          <input id="mp-side-bypass" type="checkbox" switch role="switch" aria-checked="${s.bypassRules}" ${s.bypassRules ? "checked" : ""} class="al-switch">
        </label>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.45rem;">
          <button type="button" id="mp-side-demo" ${s.runningDemo ? "disabled" : ""} class="al-btn al-btn--primary" style="min-block-size:2.1rem;font-size:0.75rem;padding:0.25rem 0.5rem;">
            ${s.runningDemo ? "Đang chạy…" : "Chạy Demo"}
          </button>
          <button type="button" id="mp-side-reset" class="al-btn" style="min-block-size:2.1rem;font-size:0.75rem;padding:0.25rem 0.5rem;">Hồi 120s</button>
        </div>
      `;
      document.getElementById("mp-side-bypass").addEventListener("change", (e) => sim.setBypassRules(e.target.checked));
      document.getElementById("mp-side-demo").addEventListener("click", sim.runDemoSequence);
      document.getElementById("mp-side-reset").addEventListener("click", sim.resetCycle);

      /* Persistent TxBanner */
      const txMount = document.getElementById("mp-tx-mount");
      if (!s.txBanner) {
        txMount.innerHTML = "";
      } else {
        const b = s.txBanner;
        txMount.innerHTML = `
          <div role="status" aria-live="polite" class="al-glass-panel" style="padding:0.65rem 1rem;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:0.75rem;border-color:${b.phase === "done" ? "rgba(34,197,94,0.45)" : "rgba(34,211,238,0.45)"};">
            <span style="display:inline-flex;align-items:center;gap:0.5rem;font-size:0.8125rem;font-weight:600;">
              ${b.phase === "done" ? H.ICONS.check : `<span class="al-dot al-dot--flow al-dot--live"></span>`}
              ${b.label} · ${b.phase === "signing" ? "Đang ký Privy…" : b.phase === "pending" ? "Chờ xác nhận Fuji…" : "Hoàn tất"}
            </span>
            ${b.hash ? `<a href="${H.txUrl(b.hash)}" target="_blank" rel="noreferrer" class="mono" style="font-size:0.75rem;color:var(--flow);text-decoration:none;">${H.shortAddr(b.hash)} · Snowscan</a>` : ""}
          </div>
        `;
      }

      /* Render current page's specific content */
      if (typeof onRenderPage === "function") {
        onRenderPage(document.getElementById("mp-page-content"), sim, s, d, H);
      }
    }

    sim.notify();
    return sim;
  }

  global.AgentLeashMultiPage = { mountMultiPageApp, ROUTES };
})(window);
