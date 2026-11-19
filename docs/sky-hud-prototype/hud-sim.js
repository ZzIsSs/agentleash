/* AgentLeash × SKY Mission Control HUD — Shared Simulation & Accessible Primitives
   Lưu ý: Dữ liệu mô phỏng đồng bộ với web/src/lib/{chain,policy,spends,rejections}.ts để phục vụ thử nghiệm UI. */

(function (global) {
  "use strict";

  const EXPLORER = "https://testnet.snowscan.xyz";
  const ADDRESSES = {
    policyMain: "0x62Ea5e422b3ef66174B6Dd6Aa855F1f036894177",
    policyAlt: "0x91Fa78B0c14D2b391A42e10C88F092D1431032c0",
    factory: "0x369251fC256D8Ae3B25F66Fe1c4b3114A06BA864",
    agent: "0x0F8de357042E53bF0E647066F0Bb1a446133ef9D",
    ownerPrivy: "0x4B82c1eF9A210d84C3a10F7128b00A92e711C4A1",
    erc8004Registry: "0x8004A818BFB912233c491871b3d84c89A494BD9e",
    weatherSeller: "0x9d014376c3296db41770015af074cf4d14c075e1",
    ratesSeller: "0x8d299966b407e9f189c1920f5a7324f13a9a4110",
    flightSandbox: "0x77b20012c9a83c41e19b004128f4402a11c9e821",
    attackerTarget: "0x1111111111111111111111111111111111111111",
  };

  function shortAddr(addr) {
    if (!addr || addr.length <= 10) return addr || "";
    return addr.slice(0, 6) + "…" + addr.slice(-4);
  }

  function formatUsdc(units) {
    const val = Number(units || 0) / 1_000_000;
    if (val === 0) return "0";
    return parseFloat(val.toFixed(6)).toString();
  }

  function formatCountdown(seconds) {
    const s = Math.max(0, Math.floor(seconds));
    const m = String(Math.floor(s / 60)).padStart(2, "0");
    const rem = String(s % 60).padStart(2, "0");
    return `${m}:${rem}`;
  }

  function formatNowClock() {
    const d = new Date();
    return d.toLocaleTimeString("vi-VN", { hour12: false });
  }

  function addressUrl(addr) {
    return `${EXPLORER}/address/${addr}`;
  }

  function txUrl(hash) {
    return `${EXPLORER}/tx/${hash}`;
  }

  function randomTxHash() {
    const hex = "0123456789abcdef";
    let out = "0x";
    for (let i = 0; i < 64; i++) {
      out += hex[Math.floor(Math.random() * 16)];
    }
    return out;
  }

  /* Crisp 1.6px SVG icon snippets (no raw Unicode/emoji) */
  const ICONS = {
    shieldCheck: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M12 3l7 3v5.5c0 4.5-3 8.5-7 9.5-4-1-7-5-7-9.5V6l7-3z" stroke-linejoin="round"/><path d="M9.25 12.25l2 2 3.75-4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    shieldBan: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M12 3l7 3v5.5c0 4.5-3 8.5-7 9.5-4-1-7-5-7-9.5V6l7-3z" stroke-linejoin="round"/><path d="M9.5 9.5l5 5m0-5l-5 5" stroke-linecap="round"/></svg>`,
    alert: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M10.3 4.3a2 2 0 0 1 3.4 0l7.1 12.2A2 2 0 0 1 19.1 19.5H4.9a2 2 0 0 1-1.7-3l7.1-12.2z" stroke-linejoin="round"/><path d="M12 9.5v4" stroke-linecap="round"/><circle cx="12" cy="16.25" r="0.75" fill="currentColor" stroke="none"/></svg>`,
    lock: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2" stroke-linejoin="round"/><path d="M8 11V8a4 4 0 1 1 8 0v3" stroke-linecap="round"/></svg>`,
    unlock: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2" stroke-linejoin="round"/><path d="M8 11V8a4 4 0 0 1 7.6-1.7" stroke-linecap="round"/></svg>`,
    arrowUpRight: `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M7 17L17 7M9 7h8v8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    check: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    play: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M7 5.5l11 6.5-11 6.5V5.5z" stroke-linejoin="round"/></svg>`,
    pause: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>`,
    terminal: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2.5" stroke-linejoin="round"/><path d="M7.5 9.5L10.5 12l-3 2.5M12.5 14.5h4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    flow: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M3 12h4l2.5-6 5 12 2.5-6H21" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    badge: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2.5" stroke-linejoin="round"/><circle cx="8.5" cy="11.5" r="2"/><path d="M13.5 10h4.5m-4.5 3.5h3.5" stroke-linecap="round"/></svg>`,
  };

  /* WAI-ARIA Tabs + hidden="until-found" + beforematch + single-row scrollIntoView */
  function initTabs(root = document) {
    const tablists = root.querySelectorAll('[role="tablist"]');
    tablists.forEach((tablist) => {
      const tabs = Array.from(tablist.querySelectorAll('[role="tab"]'));
      if (!tabs.length) return;

      const panels = tabs.map((tab) => {
        const panel = root.querySelector(`[role="tabpanel"][aria-labelledby="${tab.id}"]`);
        return panel;
      });

      function activate(index, moveFocus = false) {
        tabs.forEach((tab, i) => {
          const selected = i === index;
          tab.setAttribute("aria-selected", selected ? "true" : "false");
          tab.tabIndex = selected ? 0 : -1;
          const panel = panels[i];
          if (panel) {
            if (selected) {
              panel.removeAttribute("hidden");
              panel.setAttribute("tabindex", "0");
            } else {
              panel.setAttribute("hidden", "until-found");
              panel.removeAttribute("tabindex");
            }
          }
          if (selected) {
            tab.scrollIntoView({ block: "nearest", inline: "nearest", container: "nearest" });
            if (moveFocus) tab.focus();
          }
        });
      }

      tabs.forEach((tab, i) => {
        tab.addEventListener("click", () => activate(i, false));
        tab.addEventListener("keydown", (e) => {
          let next = null;
          if (e.key === "ArrowRight") next = (i + 1) % tabs.length;
          else if (e.key === "ArrowLeft") next = (i - 1 + tabs.length) % tabs.length;
          else if (e.key === "Home") next = 0;
          else if (e.key === "End") next = tabs.length - 1;
          if (next === null) return;
          e.preventDefault();
          activate(next, true);
        });
      });

      panels.forEach((panel, i) => {
        if (!panel) return;
        panel.addEventListener("beforematch", () => activate(i, false));
      });
    });
  }

  /* Native <dialog> light-dismiss polyfill for closedby="any" (modern-web-guidance) */
  function initDialogs(root = document) {
    if (!("closedBy" in HTMLDialogElement.prototype)) {
      const outside = (e, dialog) => {
        const r = dialog.getBoundingClientRect();
        return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
      };
      root.querySelectorAll('dialog[closedby="any"]').forEach((dialog) => {
        let pressedOutside = false;
        dialog.addEventListener("pointerdown", (e) => {
          pressedOutside = outside(e, dialog);
        });
        dialog.addEventListener("pointerup", (e) => {
          if (pressedOutside && outside(e, dialog)) dialog.close("dismiss");
        });
      });
    }
  }

  /* Stateful Interactive Simulation Store for AgentLeash Prototypes */
  function createSimulation(onUpdate) {
    const state = {
      authenticated: true,
      userEmail: "giang@agentleash.xyz",
      activePolicy: ADDRESSES.policyMain,
      paused: false,
      bypassRules: false,
      balanceUnits: 51000,
      perTxCapUnits: 2000,
      dailyCapUnits: 3000,
      sandboxPerTxCapUnits: 500,
      sandboxDailyCapUnits: 1000,
      spentUnits: 1500,
      sandboxSpentUnits: 500,
      periodSeconds: 120,
      secondsToReset: 84,
      blockNumber: 41892314,
      updatedAt: formatNowClock(),
      runningDemo: false,
      txBanner: null, // { label, phase: 'signing'|'pending'|'done'|'error', hash }
      whitelist: {
        [ADDRESSES.weatherSeller.toLowerCase()]: true,
        [ADDRESSES.ratesSeller.toLowerCase()]: true,
        [ADDRESSES.flightSandbox.toLowerCase()]: false,
      },
      spends: [
        {
          id: "sp-2",
          time: "15:56:18",
          name: "API Dự báo Chuyến bay",
          payTo: ADDRESSES.flightSandbox,
          amountUnits: 500,
          isSandbox: true,
          txHash: "0x72b9c3124aa10ef8832d4f0199a01c3037e931a8bc21a50192b1a8e4110b8291",
          released: false,
        },
        {
          id: "sp-1",
          time: "15:55:42",
          name: "API Thời tiết",
          payTo: ADDRESSES.weatherSeller,
          amountUnits: 1000,
          isSandbox: false,
          txHash: "0xa4f2b81031e57c04d9812398ca3912b2f80157e1998e02a4b0012a8e4120c7f3",
          released: false,
        },
      ],
      rejections: [
        {
          id: "rej-2",
          time: "15:56:41",
          source: "contract",
          code: "ExceedsSandboxPerTxCap",
          title: "Vượt trần Sandbox mỗi giao dịch (địa chỉ lạ)",
          detail: "Agent bỏ qua Rule Engine thử gửi 0.001 USDC tới 0x1111…1111, vượt trần Sandbox 0.0005 USDC/lần.",
          api: "Địa chỉ lạ (Hack sim)",
          payTo: ADDRESSES.attackerTarget,
          amountUnits: 1000,
          bypassRules: true,
        },
        {
          id: "rej-1",
          time: "15:55:19",
          source: "rule-engine",
          code: "RATE_LIMIT_EXCEEDED",
          title: "Gọi API quá nhanh, vượt giới hạn tần suất",
          detail: "Rule engine chặn trước khi gọi contract (5 lượt/phút), tiết kiệm gas Fuji.",
          api: "API Thời tiết",
          payTo: ADDRESSES.weatherSeller,
          amountUnits: 1000,
          bypassRules: false,
        },
      ],
      insight: {
        visible: true,
        text: "Gần nhất: Dự báo Chuyến bay −0.0005 USDC (Sandbox)",
        txHash: "0x72b9c3124aa10ef8832d4f0199a01c3037e931a8bc21a50192b1a8e4110b8291",
      },
    };

    function isWhitelisted(addr) {
      return state.whitelist[(addr || "").toLowerCase()] === true;
    }

    function sellerLabel(addr) {
      const low = (addr || "").toLowerCase();
      if (low === ADDRESSES.weatherSeller.toLowerCase()) return "API Thời tiết";
      if (low === ADDRESSES.ratesSeller.toLowerCase()) return "API Tỷ giá";
      if (low === ADDRESSES.flightSandbox.toLowerCase()) return "API Dự báo Chuyến bay";
      if (low === ADDRESSES.attackerTarget.toLowerCase()) return "Địa chỉ lạ (0x1111…1111)";
      return "API lạ";
    }

    function derived() {
      const remainingDaily = Math.max(0, state.dailyCapUnits - state.spentUnits);
      const remainingSandbox = Math.min(remainingDaily, Math.max(0, state.sandboxDailyCapUnits - state.sandboxSpentUnits));
      const spendableNow = state.paused ? 0 : Math.min(remainingDaily, state.balanceUnits);
      const spendableRatio = state.dailyCapUnits > 0 ? spendableNow / state.dailyCapUnits : 0;

      const hasSpends = state.spends.some((s) => !s.released);
      const hasWhitelistCapBlock = state.rejections.some(
        (r) => r.code === "ExceedsDailyCap" || r.code === "ExceedsPerTxCap",
      );
      const hasSandboxBlock = state.rejections.some(
        (r) => r.code === "ExceedsSandboxPerTxCap" || r.code === "ExceedsSandboxDailyCap" || r.bypassRules,
      );

      return {
        remainingDaily,
        remainingSandbox,
        spendableNow,
        spendableRatio,
        hasSpends,
        hasWhitelistCapBlock,
        hasSandboxBlock,
      };
    }

    function notify() {
      state.updatedAt = formatNowClock();
      if (typeof onUpdate === "function") onUpdate(state, derived());
    }

    function tickTimer() {
      if (state.secondsToReset > 1) {
        state.secondsToReset -= 1;
      } else {
        state.secondsToReset = state.periodSeconds;
        state.spentUnits = 0;
        state.sandboxSpentUnits = 0;
        state.blockNumber += 1;
      }
      notify();
    }

    let timerHandle = setInterval(tickTimer, 1000);

    function resetCycle() {
      state.secondsToReset = state.periodSeconds;
      state.spentUnits = 0;
      state.sandboxSpentUnits = 0;
      state.blockNumber += 1;
      state.insight = {
        visible: true,
        text: "Chu kỳ 120s đã hồi hạn mức: Chi được ngay " + formatUsdc(derived().spendableNow) + " USDC",
        txHash: null,
      };
      notify();
    }

    function toggleAuth() {
      state.authenticated = !state.authenticated;
      notify();
    }

    function setBypassRules(val) {
      state.bypassRules = Boolean(val);
      notify();
    }

    function switchPolicy(addr) {
      state.activePolicy = addr;
      if (addr === ADDRESSES.policyAlt) {
        state.balanceUnits = 24000;
        state.spentUnits = 0;
        state.sandboxSpentUnits = 0;
      } else {
        state.balanceUnits = 51000;
      }
      state.blockNumber += 1;
      notify();
    }

    function runTxBanner(label, afterDone) {
      const hash = randomTxHash();
      state.txBanner = { label, phase: "signing", hash: null };
      notify();
      setTimeout(() => {
        state.txBanner = { label, phase: "pending", hash };
        notify();
        setTimeout(() => {
          state.blockNumber += 1;
          if (typeof afterDone === "function") afterDone(hash);
          state.txBanner = { label, phase: "done", hash };
          notify();
        }, 700);
      }, 550);
    }

    function togglePause(targetPaused) {
      if (!state.authenticated) return;
      const label = targetPaused ? "Khóa khẩn cấp (pause)" : "Mở khóa policy (unpause)";
      runTxBanner(label, () => {
        state.paused = targetPaused;
        state.insight = {
          visible: true,
          text: targetPaused
            ? "Kill Switch đã kích hoạt: Contract từ chối mọi giao dịch mới & digest chưa settle."
            : "Đã mở khóa policy: Agent tiếp tục hoạt động trong phần hạn mức còn lại.",
          txHash: state.txBanner?.hash || null,
        };
      });
    }

    function toggleWhitelist(addr, allowed) {
      if (!state.authenticated) return;
      const name = sellerLabel(addr);
      const label = allowed ? `Chuyển ${name} thành API quen` : `Gỡ ${name} khỏi Whitelist`;
      runTxBanner(label, (hash) => {
        state.whitelist[addr.toLowerCase()] = allowed;
        state.insight = {
          visible: true,
          text: allowed
            ? `Đã nâng cấp ${shortAddr(addr)} lên Tầng 1 Whitelist qua 1 chữ ký Privy.`
            : `Đã gỡ ${shortAddr(addr)} khỏi Whitelist (về Tầng 2 Sandbox).`,
          txHash: hash,
        };
      });
    }

    function updateCaps(newCaps) {
      if (!state.authenticated) return;
      runTxBanner("Cập nhật hạn mức 2 tầng (setCaps)", () => {
        state.perTxCapUnits = newCaps.perTxCapUnits;
        state.dailyCapUnits = newCaps.dailyCapUnits;
        state.sandboxPerTxCapUnits = newCaps.sandboxPerTxCapUnits;
        state.sandboxDailyCapUnits = newCaps.sandboxDailyCapUnits;
      });
    }

    function attemptSpend(payTo, amountUnits, bypass) {
      const d = derived();
      const time = formatNowClock();
      const name = sellerLabel(payTo);
      const whitelisted = isWhitelisted(payTo);

      if (state.paused) {
        state.rejections.unshift({
          id: "rej-" + Date.now(),
          time,
          source: "contract",
          code: "PausedError",
          title: "Policy đang bị khóa khẩn cấp",
          detail: "AgentPolicy.paused = true. Mọi lệnh authorize & chữ ký ERC-1271 đều bị từ chối trên chuỗi.",
          api: name,
          payTo,
          amountUnits,
          bypassRules: bypass,
        });
        return { ok: false, code: "PausedError" };
      }

      if (!bypass && payTo.toLowerCase() === ADDRESSES.attackerTarget.toLowerCase()) {
        state.rejections.unshift({
          id: "rej-" + Date.now(),
          time,
          source: "rule-engine",
          code: "UNREGISTERED_API",
          title: "API không có trong danh sách được phép",
          detail: "Rule Engine phát hiện URL/payTo lạ trước khi chạm contract, tiết kiệm gas.",
          api: name,
          payTo,
          amountUnits,
          bypassRules: false,
        });
        return { ok: false, code: "UNREGISTERED_API" };
      }

      if (!whitelisted) {
        if (amountUnits > state.sandboxPerTxCapUnits) {
          state.rejections.unshift({
            id: "rej-" + Date.now(),
            time,
            source: "contract",
            code: "ExceedsSandboxPerTxCap",
            title: "Vượt trần Sandbox mỗi giao dịch (địa chỉ lạ)",
            detail: `Yêu cầu ${formatUsdc(amountUnits)} USDC > trần Sandbox ${formatUsdc(state.sandboxPerTxCapUnits)} USDC/lần.`,
            api: name,
            payTo,
            amountUnits,
            bypassRules: bypass,
          });
          return { ok: false, code: "ExceedsSandboxPerTxCap" };
        }
        if (amountUnits > d.remainingSandbox) {
          state.rejections.unshift({
            id: "rej-" + Date.now(),
            time,
            source: "contract",
            code: "ExceedsSandboxDailyCap",
            title: "Vượt hạn mức Sandbox của chu kỳ (địa chỉ lạ)",
            detail: `Còn ${formatUsdc(d.remainingSandbox)} USDC Sandbox, không đủ chi ${formatUsdc(amountUnits)} USDC.`,
            api: name,
            payTo,
            amountUnits,
            bypassRules: bypass,
          });
          return { ok: false, code: "ExceedsSandboxDailyCap" };
        }
        state.sandboxSpentUnits += amountUnits;
      } else {
        if (amountUnits > state.perTxCapUnits) {
          state.rejections.unshift({
            id: "rej-" + Date.now(),
            time,
            source: "contract",
            code: "ExceedsPerTxCap",
            title: "Vượt trần mỗi giao dịch (Whitelist)",
            detail: `Yêu cầu ${formatUsdc(amountUnits)} USDC > trần ${formatUsdc(state.perTxCapUnits)} USDC/lần.`,
            api: name,
            payTo,
            amountUnits,
            bypassRules: bypass,
          });
          return { ok: false, code: "ExceedsPerTxCap" };
        }
      }

      if (amountUnits > d.remainingDaily) {
        state.rejections.unshift({
          id: "rej-" + Date.now(),
          time,
          source: "contract",
          code: "ExceedsDailyCap",
          title: "Vượt hạn mức chung của chu kỳ",
          detail: `Hạn mức chu kỳ còn ${formatUsdc(d.remainingDaily)} USDC, lệnh ${formatUsdc(amountUnits)} USDC bị contract chặn.`,
          api: name,
          payTo,
          amountUnits,
          bypassRules: bypass,
        });
        return { ok: false, code: "ExceedsDailyCap" };
      }

      const txHash = randomTxHash();
      state.spentUnits += amountUnits;
      state.balanceUnits = Math.max(0, state.balanceUnits - amountUnits);
      state.blockNumber += 1;
      state.spends.unshift({
        id: "sp-" + Date.now() + "-" + Math.random().toString(16).slice(2, 6),
        time,
        name,
        payTo,
        amountUnits,
        isSandbox: !whitelisted,
        txHash,
        released: false,
      });
      state.insight = {
        visible: true,
        text: `Giao dịch mới: ${name} −${formatUsdc(amountUnits)} USDC (${whitelisted ? "Whitelist" : "Sandbox"})`,
        txHash,
      };
      return { ok: true, txHash };
    }

    function runDemoSequence() {
      if (state.runningDemo) return;
      state.runningDemo = true;
      notify();

      setTimeout(() => {
        if (state.bypassRules) {
          attemptSpend(ADDRESSES.attackerTarget, 1000, true);
          state.runningDemo = false;
          notify();
          return;
        }
        // Step 1: Buy Rates (0.001) -> usually passes if remaining >= 0.001
        attemptSpend(ADDRESSES.ratesSeller, 1000, false);
        notify();
        setTimeout(() => {
          // Step 2: Buy Weather (0.001) -> triggers ExceedsDailyCap when remaining < 0.001
          attemptSpend(ADDRESSES.weatherSeller, 1000, false);
          state.runningDemo = false;
          notify();
        }, 650);
      }, 450);
    }

    function runSandboxProbe() {
      if (state.runningDemo) return;
      attemptSpend(ADDRESSES.flightSandbox, 500, false);
      notify();
    }

    function dismissInsight() {
      state.insight.visible = false;
      notify();
    }

    function destroy() {
      clearInterval(timerHandle);
    }

    return {
      state,
      derived,
      notify,
      resetCycle,
      toggleAuth,
      setBypassRules,
      switchPolicy,
      togglePause,
      toggleWhitelist,
      updateCaps,
      runDemoSequence,
      runSandboxProbe,
      dismissInsight,
      destroy,
    };
  }

  /* Summarize spends into 3 SVG nodes (Thời tiết, Tỷ giá, Địa chỉ lạ) */
  function summarizeSpendFlows(spends) {
    const buckets = {
      weather: { id: "weather", label: "Thời tiết", amount: 0, trusted: 0, sandbox: 0, count: 0 },
      rates: { id: "rates", label: "Tỷ giá", amount: 0, trusted: 0, sandbox: 0, count: 0 },
      unknown: { id: "unknown", label: "Địa chỉ lạ", amount: 0, trusted: 0, sandbox: 0, count: 0 },
    };
    let totalAmount = 0;
    let totalCount = 0;

    spends.forEach((s) => {
      if (s.released) return;
      const low = s.payTo.toLowerCase();
      const key =
        low === ADDRESSES.weatherSeller.toLowerCase()
          ? "weather"
          : low === ADDRESSES.ratesSeller.toLowerCase()
            ? "rates"
            : "unknown";
      const b = buckets[key];
      b.amount += s.amountUnits;
      b.count += 1;
      if (s.isSandbox) b.sandbox += s.amountUnits;
      else b.trusted += s.amountUnits;
      totalAmount += s.amountUnits;
      totalCount += 1;
    });

    const nodes = ["weather", "rates", "unknown"].map((id) => {
      const b = buckets[id];
      const tier =
        b.amount === 0 ? "idle" : b.sandbox === 0 ? "trusted" : b.trusted === 0 ? "sandbox" : "mixed";
      const share = totalAmount === 0 || b.amount === 0 ? 0 : b.amount / totalAmount;
      const strokeWidth = b.amount === 0 ? 1.5 : Number((2.5 + share * 5.5).toFixed(2));
      return { ...b, tier, share, strokeWidth };
    });

    return { totalAmount, totalCount, nodes };
  }

  /* Render SpendFlow SVG Diagram (Agent -> Policy -> APIs) with optional SKY HUD glow */
  function renderSpendFlowSvg(summary, options = {}) {
    const centers = [31, 92, 153];
    const hasAny = summary.totalAmount > 0;
    const paused = Boolean(options.paused);
    const tierVisual = {
      trusted: { text: "#4ade80", stroke: "#22c55e", badge: "Whitelist" },
      sandbox: { text: "#facc15", stroke: "#eab308", badge: "Sandbox" },
      mixed: { text: "#facc15", stroke: "#eab308", badge: "WL + Sandbox" },
      idle: { text: "#9aa9c4", stroke: "#334155", badge: "Chưa chi" },
    };

    const branches = summary.nodes
      .map((node, idx) => {
        const cy = centers[idx];
        const path = `M 332 92 C 370 92, 370 ${cy}, 408 ${cy}`;
        const stroke =
          node.tier === "mixed" ? "url(#al-mixed-grad)" : node.tier === "idle" ? "#3b4c6b" : tierVisual[node.tier].stroke;
        const dashClass = node.amount > 0 && !paused ? "al-svg-flow-pulse" : "";
        return `
          <g>
            <path d="${path}" fill="none" stroke="${stroke}" stroke-width="${node.strokeWidth}"
              stroke-dasharray="${node.tier === "idle" ? "4 4" : ""}"
              stroke-opacity="${node.tier === "idle" ? "0.5" : "0.9"}" stroke-linecap="round" />
            ${
              node.amount > 0 && !paused
                ? `<path d="${path}" fill="none" stroke="#ffffff" stroke-opacity="0.45" stroke-width="1.6" stroke-linecap="round" class="${dashClass}" />`
                : ""
            }
            ${
              node.amount > 0
                ? `<circle cx="408" cy="${cy}" r="3.5" fill="${node.tier === "trusted" ? "#22c55e" : "#eab308"}" />`
                : ""
            }
          </g>
        `;
      })
      .join("");

    const targetBoxes = summary.nodes
      .map((node, idx) => {
        const cy = centers[idx];
        const top = cy - 23;
        const vis = tierVisual[node.tier];
        return `
          <g>
            <rect x="408" y="${top}" width="184" height="46" rx="11" fill="rgba(7, 18, 36, 0.9)" stroke="${vis.stroke}" stroke-opacity="${node.tier === "idle" ? "0.7" : "0.8"}" stroke-width="1.4" />
            <text x="419" y="${cy - 4}" fill="#e8eef9" font-size="12" font-weight="600">${node.label}</text>
            <text x="419" y="${cy + 13}" fill="${vis.text}" font-size="11" font-weight="500">${vis.badge}</text>
            <text x="582" y="${cy - 4}" text-anchor="end" fill="${node.amount > 0 ? vis.text : "#9aa9c4"}" font-size="12" font-weight="600" font-family="var(--font-mono)">${formatUsdc(node.amount)}</text>
            <text x="582" y="${cy + 13}" text-anchor="end" fill="#9aa9c4" font-size="10.5">${node.count > 0 ? `${node.count}× · USDC` : "USDC"}</text>
          </g>
        `;
      })
      .join("");

    const policyStroke = paused ? "#ef4444" : hasAny ? "#22d3ee" : "#3b4c6b";

    return `
      <svg viewBox="0 0 600 184" role="img" aria-label="Sơ đồ dòng tiền từ AI Agent qua AgentPolicy tới các API" style="display:block;width:100%;height:auto;user-select:none;">
        <defs>
          <linearGradient id="al-mixed-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#22c55e" />
            <stop offset="100%" stop-color="#eab308" />
          </linearGradient>
        </defs>

        <path d="M 118 92 C 150 92, 164 92, 194 92" fill="none" stroke="${paused ? "#ef4444" : hasAny ? "#22d3ee" : "#3b4c6b"}" stroke-width="${hasAny ? 5 : 1.5}" stroke-dasharray="${hasAny ? "" : "4 4"}" stroke-linecap="round" />
        ${hasAny && !paused ? `<path d="M 118 92 C 150 92, 164 92, 194 92" fill="none" stroke="#ffffff" stroke-opacity="0.45" stroke-width="1.6" stroke-linecap="round" class="al-svg-flow-pulse" />` : ""}
        <circle cx="194" cy="92" r="${hasAny ? 4 : 2.5}" fill="${paused ? "#ef4444" : hasAny ? "#22d3ee" : "#64748b"}" />

        ${branches}

        <rect x="8" y="64" width="110" height="56" rx="11" fill="rgba(7, 18, 36, 0.9)" stroke="rgba(122, 222, 255, 0.3)" stroke-width="1.4" />
        <text x="63" y="89" text-anchor="middle" fill="#e8eef9" font-size="12" font-weight="600">AI Agent</text>
        <text x="63" y="106" text-anchor="middle" fill="#9aa9c4" font-size="11">Xin chi x402</text>

        <rect x="194" y="56" width="138" height="72" rx="12" fill="rgba(9, 24, 46, 0.95)" stroke="${policyStroke}" stroke-width="1.6" />
        <text x="263" y="80" text-anchor="middle" fill="#e8eef9" font-size="12" font-weight="600">AgentPolicy</text>
        <text x="263" y="99" text-anchor="middle" fill="${paused ? "#fca5a5" : "#67e8f9"}" font-size="12" font-weight="600" font-family="var(--font-mono)">${formatUsdc(summary.totalAmount)} USDC</text>
        <text x="263" y="116" text-anchor="middle" fill="#9aa9c4" font-size="11">${paused ? "Đã khóa (paused)" : `${summary.totalCount} khoản đã chi`}</text>

        ${targetBoxes}
      </svg>
    `;
  }

  /* Lightweight 2D Canvas Particle Orb for Center Leash Core (NO Three.js, respects prefers-reduced-motion + user pause control) */
  function initLeashCoreCanvas(canvas, getMode, toggleBtn) {
    if (!canvas) return () => {};
    const ctx = canvas.getContext("2d");
    const reducedMedia = window.matchMedia("(prefers-reduced-motion: reduce)");
    let userPaused = reducedMedia.matches;
    let rafId = 0;
    let t = 0;

    const particles = Array.from({ length: 68 }, (_, i) => {
      const phi = Math.acos(1 - (2 * (i + 0.5)) / 68);
      const theta = Math.PI * (1 + Math.sqrt(5)) * i;
      return { phi, theta, rOffset: (i % 5) * 2.5, size: (i % 3) + 1.1 };
    });

    function resize() {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(220, Math.round(rect.width * dpr));
      canvas.height = Math.max(220, Math.round(rect.height * dpr));
    }

    function drawFrame() {
      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h / 2;
      const radius = Math.min(w, h) * 0.34;
      const mode = getMode ? getMode() : "active";

      ctx.clearRect(0, 0, w, h);

      const coreColor =
        mode === "paused"
          ? "rgba(239, 68, 68,"
          : mode === "hack"
            ? "rgba(250, 204, 21,"
            : "rgba(94, 234, 212,";
      const secondaryColor =
        mode === "paused"
          ? "rgba(248, 113, 113,"
          : mode === "hack"
            ? "rgba(239, 68, 68,"
            : "rgba(168, 85, 247,";

      /* Soft ambient core glow */
      const grad = ctx.createRadialGradient(cx, cy, radius * 0.1, cx, cy, radius * 1.45);
      grad.addColorStop(0, coreColor + "0.22)");
      grad.addColorStop(0.55, secondaryColor + "0.08)");
      grad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 1.45, 0, Math.PI * 2);
      ctx.fill();

      /* Outer policy ring ("the leash") */
      ctx.save();
      ctx.strokeStyle = coreColor + "0.35)";
      ctx.lineWidth = Math.max(1.2, w * 0.004);
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 1.12, t * 0.4, t * 0.4 + Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      /* 3D projected particle sphere */
      const projected = particles
        .map((p, idx) => {
          const rotY = p.theta + t * 0.55;
          const x = Math.sin(p.phi) * Math.cos(rotY);
          const y = Math.cos(p.phi);
          const z = Math.sin(p.phi) * Math.sin(rotY);
          const scale = (z + 1.8) / 2.8;
          return {
            sx: cx + x * (radius + p.rOffset),
            sy: cy + y * (radius + p.rOffset) * 0.92,
            z,
            alpha: 0.25 + scale * 0.7,
            r: p.size * (0.75 + scale * 0.8),
            alt: idx % 4 === 0,
          };
        })
        .sort((a, b) => a.z - b.z);

      for (const pt of projected) {
        ctx.fillStyle = (pt.alt ? secondaryColor : coreColor) + pt.alpha.toFixed(2) + ")";
        ctx.beginPath();
        ctx.arc(pt.sx, pt.sy, pt.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function loop() {
      drawFrame();
      if (!userPaused) {
        t += 0.016;
        rafId = requestAnimationFrame(loop);
      }
    }

    function syncButtonLabel() {
      if (!toggleBtn) return;
      toggleBtn.textContent = userPaused ? "Phát hiệu ứng" : "Tạm dừng hiệu ứng";
    }

    if (toggleBtn) {
      syncButtonLabel();
      toggleBtn.addEventListener("click", () => {
        userPaused = !userPaused;
        syncButtonLabel();
        if (!userPaused) {
          cancelAnimationFrame(rafId);
          loop();
        } else {
          cancelAnimationFrame(rafId);
          drawFrame();
        }
      });
    }

    resize();
    drawFrame();
    if (!userPaused) loop();

    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
    };
  }

  global.AgentLeashHud = {
    ADDRESSES,
    ICONS,
    shortAddr,
    formatUsdc,
    formatCountdown,
    addressUrl,
    txUrl,
    initTabs,
    initDialogs,
    createSimulation,
    summarizeSpendFlows,
    renderSpendFlowSvg,
    initLeashCoreCanvas,
  };
})(window);
