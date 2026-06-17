const boot = window.REACTOR_BOOT || { csrf: "", basePath: "", defaultLanguage: "en" };
const app = document.getElementById("app");
const modalRoot = document.getElementById("modal-root");

const state = {
  lang: localStorage.getItem("reactor_lang") || boot.defaultLanguage || "en",
  messages: {},
  screen: "boot",
  authMode: "login",
  user: null,
  dashboard: null,
  error: "",
  notice: "",
  loading: false,
  onboarding: {
    step: 0,
    habits: [],
    main_reason: "",
    custom_reason: "",
    goal_title: "",
    goal_amount: 300,
    currency: "EUR",
    cigarettes_per_day: 20,
    cigarettes_per_pack: 20,
    pack_price: 8.5,
    alcohol_weekly_spend: 30,
    dangerous_days: []
  },
  craving: {
    id: null,
    timer: null,
    seconds: 90,
    reason: "",
    action: ""
  }
};

const apiPath = (path) => `${boot.basePath || ""}${path}`;
const icon = (name) => `<svg aria-hidden="true" focusable="false"><use href="#i-${name}"></use></svg>`;
const esc = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

function readPath(object, path) {
  return String(path).split(".").reduce((carry, key) => carry && carry[key] !== undefined ? carry[key] : undefined, object);
}

function t(path, vars = {}) {
  let value = readPath(state.messages, path);
  if (value === undefined) value = path;
  if (typeof value !== "string") return value;
  return value.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? "");
}

function list(path) {
  const value = readPath(state.messages, path);
  return Array.isArray(value) ? value : [];
}

function money(amount, currency = "EUR") {
  try {
    return new Intl.NumberFormat(state.lang, { style: "currency", currency }).format(Number(amount || 0));
  } catch {
    return `${Number(amount || 0).toFixed(2)} ${currency}`;
  }
}

function dateTime(value) {
  try {
    return new Intl.DateTimeFormat(state.lang, { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
  } catch {
    return value || "";
  }
}

function duration(hours) {
  const total = Math.max(0, Math.floor(Number(hours || 0)));
  const days = Math.floor(total / 24);
  const rest = total % 24;
  if (days > 0) return t("time.days_hours", { days, hours: rest });
  return t("time.hours", { hours: rest });
}

function flattenPhrases() {
  const phrases = readPath(state.messages, "phrases") || {};
  return Object.values(phrases).flat().filter(Boolean);
}

function mentorPhrase(category = "general") {
  const pool = list(`phrases.${category}`);
  const fallback = flattenPhrases();
  const source = pool.length ? pool : fallback;
  if (!source.length) return "";
  return source[Math.floor(Date.now() / 30000) % source.length];
}

async function api(path, options = {}) {
  const method = options.method || "GET";
  const headers = { Accept: "application/json" };
  const fetchOptions = { method, headers, credentials: "same-origin" };

  if (method !== "GET") {
    headers["Content-Type"] = "application/json";
    headers["X-CSRF-Token"] = boot.csrf || "";
    fetchOptions.body = JSON.stringify(options.body || {});
  }

  const response = await fetch(apiPath(path), fetchOptions);
  const payload = await response.json().catch(() => null);
  if (payload && payload.csrf) boot.csrf = payload.csrf;
  if (!response.ok || !payload || payload.ok !== true) {
    throw new Error(payload?.error?.message || t("errors.generic"));
  }
  return payload.data || {};
}

async function loadLanguage(lang) {
  const normalized = ["ru", "en", "de"].includes(lang) ? lang : "en";
  const data = await api(`/api/i18n?lang=${encodeURIComponent(normalized)}`);
  state.lang = data.language || normalized;
  state.messages = data.messages || {};
  localStorage.setItem("reactor_lang", state.lang);
  document.documentElement.lang = state.lang;
}

async function loadDashboard() {
  const data = await api("/api/dashboard");
  state.dashboard = data;
  state.user = data.user;
  state.screen = data.onboarding_completed ? "dashboard" : "onboarding";
}

async function init() {
  renderBoot();
  try {
    await loadLanguage(state.lang);
    const me = await api("/api/me");
    if (me.authenticated && me.user) {
      if (me.user.language && me.user.language !== state.lang) {
        await loadLanguage(me.user.language);
      }
      await loadDashboard();
    } else {
      state.screen = "auth";
    }
  } catch (error) {
    state.screen = "auth";
    state.error = error.message;
  }
  render();

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register(apiPath("/service-worker.js")).catch(() => {});
    });
  }
}

function renderBoot() {
  app.innerHTML = `<section class="auth-shell"><div class="auth-card"><p class="eyebrow">REACTOR</p><h1>REACTOR: Freedom</h1><p class="muted">Loading control panel...</p></div></section>`;
}

function render() {
  if (state.screen === "boot") return renderBoot();
  if (state.screen === "auth") return renderAuth();
  if (state.screen === "onboarding") return renderOnboarding();
  if (state.screen === "settings") return renderSettings();
  return renderDashboardView();
}

function renderBrand(compact = false) {
  return `
    <div class="brand">
      <div class="brand-mark">${icon("reactor")}</div>
      <div class="brand-title">
        <strong>${esc(t("app.name"))}</strong>
        <span>${esc(compact ? t("app.tagline_short") : t("app.subtitle"))}</span>
      </div>
    </div>`;
}

function renderLanguagePicker() {
  return `
    <div class="segmented" role="group" aria-label="${esc(t("auth.language"))}">
      ${["ru", "en", "de"].map((lang) => `<button type="button" class="${state.lang === lang ? "active" : ""}" data-lang="${lang}">${lang.toUpperCase()}</button>`).join("")}
    </div>`;
}

function attachLanguagePicker(container = app) {
  container.querySelectorAll("[data-lang]").forEach((button) => {
    button.addEventListener("click", async () => {
      await loadLanguage(button.dataset.lang);
      render();
    });
  });
}

function renderAuth() {
  const isRegister = state.authMode === "register";
  app.innerHTML = `
    <section class="auth-shell">
      <div class="reactor-intro glass-card">
        <div class="reactor-logo-large">
          <svg class="reactor-svg" viewBox="0 0 260 260" aria-hidden="true">
            <circle class="ring-back" cx="130" cy="130" r="96"></circle>
            <circle class="ring-ticks" cx="130" cy="130" r="96"></circle>
            <circle class="ring-progress" cx="130" cy="130" r="96" style="stroke-dasharray:${2 * Math.PI * 96};stroke-dashoffset:${2 * Math.PI * 96 * .22};"></circle>
            <circle class="ring-inner" cx="130" cy="130" r="62"></circle>
          </svg>
          <div class="logo-core"></div>
        </div>
        <p class="eyebrow">${esc(t("app.kicker"))}</p>
        <h1>${esc(t("app.name"))}</h1>
        <p class="muted">${esc(t("auth.hero_text"))}</p>
        <div class="chip-grid">
          <span class="chip">${icon("shield")}${esc(t("auth.chip_control"))}</span>
          <span class="chip">${icon("money")}${esc(t("auth.chip_money"))}</span>
          <span class="chip">${icon("trophy")}${esc(t("auth.chip_rewards"))}</span>
        </div>
      </div>
      <div class="auth-card">
        ${renderBrand(true)}
        <div style="height:14px"></div>
        ${renderLanguagePicker()}
        <div style="height:18px"></div>
        <h2>${esc(t(isRegister ? "auth.register_title" : "auth.login_title"))}</h2>
        <p class="muted">${esc(t(isRegister ? "auth.register_subtitle" : "auth.login_subtitle"))}</p>
        ${state.error ? `<div class="alert">${esc(state.error)}</div>` : ""}
        <form id="authForm" class="form-grid">
          ${isRegister ? `<label>${esc(t("auth.name"))}<input name="name" autocomplete="name" required minlength="2" maxlength="80"></label>` : ""}
          <label>${esc(t("auth.email"))}<input name="email" type="email" autocomplete="email" required></label>
          <label>${esc(t("auth.password"))}<input name="password" type="password" autocomplete="${isRegister ? "new-password" : "current-password"}" required minlength="8"></label>
          <div class="form-actions">
            <button class="primary-button full" type="submit" ${state.loading ? "disabled" : ""}>${esc(t(isRegister ? "auth.create_account" : "auth.sign_in"))}</button>
            <button class="text-button" type="button" id="switchAuth">${esc(t(isRegister ? "auth.have_account" : "auth.need_account"))}</button>
          </div>
        </form>
      </div>
    </section>`;

  attachLanguagePicker();
  document.getElementById("switchAuth").addEventListener("click", () => {
    state.error = "";
    state.authMode = isRegister ? "login" : "register";
    renderAuth();
  });
  document.getElementById("authForm").addEventListener("submit", handleAuthSubmit);
}

async function handleAuthSubmit(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  state.loading = true;
  state.error = "";
  renderAuth();
  try {
    const endpoint = state.authMode === "register" ? "/api/register" : "/api/login";
    const data = {
      name: String(form.get("name") || ""),
      email: String(form.get("email") || ""),
      password: String(form.get("password") || ""),
      language: state.lang
    };
    const result = await api(endpoint, { method: "POST", body: data });
    state.user = result.user;
    await loadDashboard();
  } catch (error) {
    state.error = error.message;
  } finally {
    state.loading = false;
    render();
  }
}

function onboardingFlow() {
  const flow = ["habit", "reason", "goal"];
  if (state.onboarding.habits.includes("smoking")) flow.push("smoking");
  if (state.onboarding.habits.includes("alcohol")) flow.push("alcohol");
  flow.push("summary");
  return flow;
}

function renderOnboarding() {
  const flow = onboardingFlow();
  state.onboarding.step = Math.min(state.onboarding.step, flow.length - 1);
  const key = flow[state.onboarding.step];
  app.innerHTML = `
    <section class="onboarding-shell">
      <div class="topbar">
        ${renderBrand(true)}
        ${renderLanguagePicker()}
      </div>
      <div class="step-meter">${flow.map((_, index) => `<span class="${index <= state.onboarding.step ? "active" : ""}"></span>`).join("")}</div>
      <section class="glass-card step-card">
        ${renderOnboardingStep(key)}
        ${state.error ? `<div class="alert">${esc(state.error)}</div>` : ""}
        <div class="form-actions">
          ${state.onboarding.step > 0 ? `<button class="secondary-button" type="button" id="backStep">${esc(t("common.back"))}</button>` : ""}
          ${key === "summary"
            ? `<button class="primary-button full" type="button" id="finishOnboarding">${esc(t("onboarding.launch"))}</button>`
            : `<button class="primary-button full" type="button" id="nextStep">${esc(t("common.next"))}</button>`}
        </div>
      </section>
    </section>`;

  attachLanguagePicker();
  attachOnboardingEvents(key);
}

function renderOnboardingStep(key) {
  if (key === "habit") {
    const options = list("onboarding.habit_options");
    return `
      <p class="eyebrow">${esc(t("onboarding.kicker"))}</p>
      <h2>${esc(t("onboarding.habit_title"))}</h2>
      <p class="muted">${esc(t("onboarding.habit_subtitle"))}</p>
      <div class="choice-grid">
        ${options.map((option) => `
          <button class="choice-card ${arraysEqual(state.onboarding.habits, option.value) ? "selected" : ""}" type="button" data-habits="${esc(option.value.join(","))}">
            <div class="icon-token ${esc(option.token)}">${icon(option.icon)}</div>
            <strong>${esc(option.title)}</strong>
            <span>${esc(option.body)}</span>
          </button>`).join("")}
      </div>`;
  }

  if (key === "reason") {
    return `
      <p class="eyebrow">${esc(t("onboarding.kicker"))}</p>
      <h2>${esc(t("onboarding.reason_title"))}</h2>
      <div class="choice-grid two">
        ${list("onboarding.reason_options").map((option) => `
          <button class="choice-card ${state.onboarding.main_reason === option.code ? "selected" : ""}" type="button" data-reason="${esc(option.code)}">
            <div class="icon-token ${esc(option.token)}">${icon(option.icon)}</div>
            <strong>${esc(option.title)}</strong>
            <span>${esc(option.body)}</span>
          </button>`).join("")}
      </div>
      <div class="${state.onboarding.main_reason === "custom" ? "" : "hidden"}">
        <label>${esc(t("onboarding.custom_reason"))}<input id="customReason" value="${esc(state.onboarding.custom_reason)}"></label>
      </div>`;
  }

  if (key === "goal") {
    return `
      <p class="eyebrow">${esc(t("onboarding.kicker"))}</p>
      <h2>${esc(t("onboarding.goal_title"))}</h2>
      <p class="muted">${esc(t("onboarding.goal_subtitle"))}</p>
      <div class="wizard-fields">
        <label>${esc(t("onboarding.goal_name"))}<input id="goalTitle" value="${esc(state.onboarding.goal_title)}" placeholder="${esc(t("onboarding.goal_placeholder"))}"></label>
        <label>${esc(t("onboarding.goal_amount"))}<input id="goalAmount" type="number" min="1" step="1" value="${esc(state.onboarding.goal_amount)}"></label>
        <label>${esc(t("onboarding.currency"))}<input id="currency" maxlength="3" value="${esc(state.onboarding.currency)}"></label>
      </div>`;
  }

  if (key === "smoking") {
    return `
      <p class="eyebrow">${esc(t("habits.smoking"))}</p>
      <h2>${esc(t("onboarding.smoking_title"))}</h2>
      <div class="wizard-fields">
        <label>${esc(t("onboarding.cigarettes_per_day"))}<input id="cigarettesPerDay" type="number" min="0" step="1" value="${esc(state.onboarding.cigarettes_per_day)}"></label>
        <label>${esc(t("onboarding.cigarettes_per_pack"))}<input id="cigarettesPerPack" type="number" min="1" step="1" value="${esc(state.onboarding.cigarettes_per_pack)}"></label>
        <label>${esc(t("onboarding.pack_price"))}<input id="packPrice" type="number" min="0" step="0.1" value="${esc(state.onboarding.pack_price)}"></label>
      </div>`;
  }

  if (key === "alcohol") {
    return `
      <p class="eyebrow">${esc(t("habits.alcohol"))}</p>
      <h2>${esc(t("onboarding.alcohol_title"))}</h2>
      <div class="wizard-fields">
        <label>${esc(t("onboarding.alcohol_weekly_spend"))}<input id="alcoholWeeklySpend" type="number" min="0" step="0.1" value="${esc(state.onboarding.alcohol_weekly_spend)}"></label>
      </div>
      <h3>${esc(t("onboarding.dangerous_days"))}</h3>
      <div class="pill-grid">
        ${list("dangerous_days").map((day) => `<button class="pill ${state.onboarding.dangerous_days.includes(day.code) ? "selected" : ""}" type="button" data-danger="${esc(day.code)}">${esc(day.title)}</button>`).join("")}
      </div>
      <div class="warning-note"><strong>${esc(t("common.important"))}</strong> ${esc(t("onboarding.alcohol_warning"))}</div>`;
  }

  const estimate = onboardingSavings();
  return `
    <p class="eyebrow">${esc(t("onboarding.summary_kicker"))}</p>
    <h2>${esc(t("onboarding.summary_title"))}</h2>
    <div class="summary-grid">
      <div class="goal-box"><strong>${esc(t("onboarding.summary_habits"))}</strong><p class="muted">${esc(summaryHabits())}</p></div>
      <div class="goal-box"><strong>${esc(t("onboarding.summary_reason"))}</strong><p class="muted">${esc(summaryReason())}</p></div>
      <div class="goal-box"><strong>${esc(t("onboarding.summary_goal"))}</strong><p class="muted">${esc(state.onboarding.goal_title || t("onboarding.goal_placeholder"))} · ${money(state.onboarding.goal_amount, state.onboarding.currency)}</p></div>
      <div class="goal-box"><strong>${esc(t("onboarding.summary_savings"))}</strong><p class="muted">${money(estimate.day, state.onboarding.currency)} / ${esc(t("time.day"))} · ${money(estimate.week, state.onboarding.currency)} / ${esc(t("time.week"))} · ${money(estimate.month, state.onboarding.currency)} / ${esc(t("time.month"))}</p></div>
    </div>`;
}

function attachOnboardingEvents(key) {
  if (key === "habit") {
    app.querySelectorAll("[data-habits]").forEach((button) => {
      button.addEventListener("click", () => {
        state.onboarding.habits = button.dataset.habits.split(",");
        state.error = "";
        renderOnboarding();
      });
    });
  }

  if (key === "reason") {
    app.querySelectorAll("[data-reason]").forEach((button) => {
      button.addEventListener("click", () => {
        state.onboarding.main_reason = button.dataset.reason;
        state.error = "";
        renderOnboarding();
      });
    });
    app.querySelector("#customReason")?.addEventListener("input", (event) => state.onboarding.custom_reason = event.target.value);
  }

  if (key === "goal") {
    app.querySelector("#goalTitle")?.addEventListener("input", (event) => state.onboarding.goal_title = event.target.value);
    app.querySelector("#goalAmount")?.addEventListener("input", (event) => state.onboarding.goal_amount = Number(event.target.value || 0));
    app.querySelector("#currency")?.addEventListener("input", (event) => state.onboarding.currency = event.target.value.toUpperCase().slice(0, 3));
  }

  if (key === "smoking") {
    app.querySelector("#cigarettesPerDay")?.addEventListener("input", (event) => state.onboarding.cigarettes_per_day = Number(event.target.value || 0));
    app.querySelector("#cigarettesPerPack")?.addEventListener("input", (event) => state.onboarding.cigarettes_per_pack = Number(event.target.value || 20));
    app.querySelector("#packPrice")?.addEventListener("input", (event) => state.onboarding.pack_price = Number(event.target.value || 0));
  }

  if (key === "alcohol") {
    app.querySelector("#alcoholWeeklySpend")?.addEventListener("input", (event) => state.onboarding.alcohol_weekly_spend = Number(event.target.value || 0));
    app.querySelectorAll("[data-danger]").forEach((button) => {
      button.addEventListener("click", () => {
        const code = button.dataset.danger;
        state.onboarding.dangerous_days = state.onboarding.dangerous_days.includes(code)
          ? state.onboarding.dangerous_days.filter((item) => item !== code)
          : [...state.onboarding.dangerous_days, code];
        renderOnboarding();
      });
    });
  }

  app.querySelector("#backStep")?.addEventListener("click", () => {
    state.error = "";
    state.onboarding.step = Math.max(0, state.onboarding.step - 1);
    renderOnboarding();
  });
  app.querySelector("#nextStep")?.addEventListener("click", () => {
    if (!validateOnboardingStep(key)) return renderOnboarding();
    state.error = "";
    state.onboarding.step += 1;
    renderOnboarding();
  });
  app.querySelector("#finishOnboarding")?.addEventListener("click", finishOnboarding);
}

function validateOnboardingStep(key) {
  if (key === "habit" && state.onboarding.habits.length === 0) {
    state.error = t("errors.choose_habit");
    return false;
  }
  if (key === "reason" && !state.onboarding.main_reason) {
    state.error = t("errors.choose_reason");
    return false;
  }
  if (key === "goal" && Number(state.onboarding.goal_amount) <= 0) {
    state.error = t("errors.goal_amount");
    return false;
  }
  return true;
}

async function finishOnboarding() {
  state.loading = true;
  state.error = "";
  renderOnboarding();
  try {
    const data = await api("/api/onboarding", { method: "POST", body: state.onboarding });
    state.dashboard = data.dashboard;
    state.user = data.dashboard.user;
    state.screen = "dashboard";
  } catch (error) {
    state.error = error.message;
  } finally {
    state.loading = false;
    render();
  }
}

function arraysEqual(a, b) {
  return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((value, index) => value === b[index]);
}

function onboardingSavings() {
  const hasSmoking = state.onboarding.habits.includes("smoking");
  const hasAlcohol = state.onboarding.habits.includes("alcohol");
  const smoking = hasSmoking ? (Number(state.onboarding.cigarettes_per_day || 0) / Math.max(1, Number(state.onboarding.cigarettes_per_pack || 20))) * Number(state.onboarding.pack_price || 0) : 0;
  const alcohol = hasAlcohol ? Number(state.onboarding.alcohol_weekly_spend || 0) / 7 : 0;
  const day = smoking + alcohol;
  return { day, week: day * 7, month: day * 30 };
}

function summaryHabits() {
  const habits = state.onboarding.habits;
  if (habits.includes("smoking") && habits.includes("alcohol")) return t("habits.both");
  if (habits.includes("smoking")) return t("habits.smoking");
  return t("habits.alcohol");
}

function summaryReason() {
  if (state.onboarding.main_reason === "custom") return state.onboarding.custom_reason || t("onboarding.custom_reason");
  const option = list("onboarding.reason_options").find((item) => item.code === state.onboarding.main_reason);
  return option ? option.title : "";
}

function renderDashboardView() {
  const data = state.dashboard;
  if (!data) return renderBoot();
  const percent = Number(data.reactor.percent || 0);
  const radius = 96;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - circumference * percent / 100;
  const hasSmoking = data.habit_types.includes("smoking");
  const hasAlcohol = data.habit_types.includes("alcohol");
  const currency = data.money.goal.currency || "EUR";

  app.innerHTML = `
    <div class="topbar">
      ${renderBrand(true)}
      <div class="top-actions">
        <button class="icon-button" id="settingsBtn" aria-label="${esc(t("settings.title"))}">${icon("settings")}</button>
        <button class="icon-button" id="logoutBtn" aria-label="${esc(t("settings.logout"))}">${icon("log-out")}</button>
      </div>
    </div>
    ${state.notice ? `<div class="alert success">${esc(state.notice)}</div>` : ""}
    <main class="dashboard-grid">
      <section class="hero-card glass-card">
        <div class="ring-wrap">
          <svg class="reactor-svg" viewBox="0 0 260 260" aria-label="${esc(t("dashboard.progress_ring"))}">
            <circle class="ring-back" cx="130" cy="130" r="${radius}"></circle>
            <circle class="ring-ticks" cx="130" cy="130" r="${radius}"></circle>
            <circle class="ring-progress" cx="130" cy="130" r="${radius}" style="stroke-dasharray:${circumference};stroke-dashoffset:${offset};"></circle>
            <circle class="ring-inner" cx="130" cy="130" r="62"></circle>
          </svg>
          <div class="ring-center">
            <div>
              <div class="status-pill">${esc(t(data.reactor.status_key))}</div>
              <strong>${percent}%</strong>
              <span>${esc(t("dashboard.reactor"))}</span>
            </div>
          </div>
        </div>
        <div class="hero-copy">
          <p class="eyebrow">${esc(t("dashboard.control_active", { name: data.user.name }))}</p>
          <h2>${esc(t("dashboard.status_line"))}</h2>
          <p class="hero-quote">${esc(mentorPhrase("general"))}</p>
          <div class="chip-grid">
            <span class="chip">${icon("flame")}${esc(t("dashboard.clean_streak", { days: data.reactor.control_days }))}</span>
            <span class="chip">${icon("shield")}${esc(t("dashboard.craving_wins", { wins: data.stats.craving_wins }))}</span>
            <span class="chip">${icon("trophy")}${esc(t(data.reactor.level_key))}</span>
          </div>
          <div class="mission-card">
            <div class="icon-token token-gold">${icon("star")}</div>
            <div>
              <p class="eyebrow">${esc(t("dashboard.mission_kicker"))}</p>
              <strong>${esc(t("dashboard.mission_title"))}</strong>
              <p class="muted">${esc(t("dashboard.mission_text"))}</p>
            </div>
          </div>
        </div>
      </section>

      <section class="action-grid">
        <button id="cravingBtn" class="craving-button">
          <span class="button-content">
            <span class="button-icon">${icon("shield")}</span>
            <span><strong>${esc(t("craving.button"))}</strong><small>${esc(t("craving.button_subtitle"))}</small></span>
          </span>
        </button>
        <button id="shareBtn" class="share-button">
          <span class="button-content">
            <span class="button-icon">${icon("reactor")}</span>
            <span><strong>${esc(t("share.button"))}</strong><small>${esc(t("share.button_subtitle"))}</small></span>
          </span>
        </button>
      </section>

      <section class="stat-grid">
        ${hasSmoking ? statCard("smoke", "token-red", t("dashboard.without_smoking"), duration(data.habits.smoking.hours), t("dashboard.series_days", { days: data.habits.smoking.days })) : ""}
        ${hasAlcohol ? statCard("alcohol", "token-blue", t("dashboard.without_alcohol"), duration(data.habits.alcohol.hours), t("dashboard.series_days", { days: data.habits.alcohol.days })) : ""}
        ${statCard("money", "token-green", t("dashboard.saved"), money(data.money.saved_total, currency), t("dashboard.saved_today", { amount: money(data.money.saved_today, currency) }))}
        ${statCard("trophy", "token-violet", t("dashboard.level"), t(data.reactor.level_key), t("dashboard.xp", { xp: data.stats.xp }))}
      </section>

      <section class="two-column">
        <section class="panel">
          <div class="section-head">
            <div><p class="eyebrow">${esc(t("dashboard.goal_kicker"))}</p><h3>${esc(t("dashboard.goal_title"))}</h3></div>
            <span class="badge">${esc(data.money.goal.progress_percent)}%</span>
          </div>
          <div class="goal-box">
            <div class="goal-row">
              <div><span class="muted">${esc(t("dashboard.goal"))}</span><h3>${esc(data.money.goal.title || t("dashboard.personal_goal"))}</h3></div>
              <div class="goal-amounts"><strong>${money(data.money.saved_total, currency)}</strong><small>${esc(t("dashboard.of_goal", { amount: money(data.money.goal.target_amount, currency) }))}</small></div>
            </div>
            <div class="progress-bar"><div class="progress-fill" style="width:${data.money.goal.progress_percent}%"></div></div>
            <p class="muted">${esc(t("dashboard.goal_remaining", { amount: money(data.money.goal.remaining, currency) }))}</p>
          </div>
        </section>
        <section class="panel">
          <div class="section-head">
            <div><p class="eyebrow">${esc(t("dashboard.daily_kicker"))}</p><h3>${esc(t("dashboard.today"))}</h3></div>
            <span class="badge">${esc(t("dashboard.checkin"))}</span>
          </div>
          <div class="check-grid">
            ${hasSmoking ? `<button class="secondary-button" data-checkin="smoke">${icon("smoke")}${esc(t("dashboard.mark_smoke_clean"))}</button>` : ""}
            ${hasAlcohol ? `<button class="secondary-button" data-checkin="alcohol">${icon("alcohol")}${esc(t("dashboard.mark_alcohol_clean"))}</button>` : ""}
          </div>
          <div style="height:10px"></div>
          <div class="incident-grid">
            ${hasSmoking ? `<button class="danger-button" data-incident="smoking">${icon("smoke")}${esc(t("incident.smoked"))}</button>` : ""}
            ${hasAlcohol ? `<button class="danger-button" data-incident="alcohol">${icon("alcohol")}${esc(t("incident.drank"))}</button>` : ""}
          </div>
        </section>
      </section>

      <section class="panel">
        <div class="section-head">
          <div><p class="eyebrow">${esc(t("dashboard.money_kicker"))}</p><h3>${esc(t("dashboard.money_title"))}</h3></div>
          <span class="badge">${money(data.money.saved_week, currency)}</span>
        </div>
        <div class="money-story">${esc(t("dashboard.money_story", { amount: money(data.money.saved_week, currency) }))}</div>
      </section>

      <section class="panel">
        <div class="section-head"><div><p class="eyebrow">${esc(t("dashboard.treats_kicker"))}</p><h3>${esc(t("dashboard.treats_title"))}</h3></div></div>
        <div class="treat-grid">
          ${data.money.treats.map((treat) => `
            <div class="treat-card ${treat.unlocked ? "unlocked" : "locked"}">
              <strong>${esc(t(treat.title_key))}</strong>
              <span>${treat.unlocked ? esc(t("dashboard.treat_available")) : esc(t("dashboard.treat_remaining", { amount: money(treat.remaining, currency) }))}</span>
              <span class="rarity">${money(treat.amount, currency)}</span>
            </div>`).join("")}
        </div>
      </section>

      <section class="panel">
        <div class="section-head">
          <div><p class="eyebrow">${esc(t("dashboard.rewards_kicker"))}</p><h3>${esc(t("dashboard.rewards_title"))}</h3></div>
          <span class="badge">${data.reactor.next_reward ? esc(t("dashboard.next_reward", { reward: t(data.reactor.next_reward.title_key) })) : esc(t("dashboard.all_rewards"))}</span>
        </div>
        <div class="rewards-grid">
          ${data.rewards.map((reward) => `
            <div class="reward-card ${reward.unlocked ? "unlocked" : "locked"}">
              <div class="icon-token ${reward.unlocked ? "token-violet" : ""}">${icon("trophy")}</div>
              <strong>${esc(t(reward.title_key))}</strong>
              <span>${esc(t(reward.description_key))}</span>
              <span class="rarity ${esc(reward.rarity)}">${esc(t(`rarity.${reward.rarity}`))}</span>
            </div>`).join("")}
        </div>
      </section>

      <section class="panel">
        <div class="section-head"><div><p class="eyebrow">${esc(t("dashboard.logs_kicker"))}</p><h3>${esc(t("dashboard.logs_title"))}</h3></div></div>
        <div class="log-list">
          ${data.logs.length ? data.logs.map(renderLog).join("") : `<p class="muted">${esc(t("dashboard.empty_logs"))}</p>`}
        </div>
      </section>
    </main>`;

  app.querySelector("#settingsBtn").addEventListener("click", () => { state.screen = "settings"; state.notice = ""; render(); });
  app.querySelector("#logoutBtn").addEventListener("click", logout);
  app.querySelector("#cravingBtn").addEventListener("click", openCraving);
  app.querySelector("#shareBtn").addEventListener("click", openShareModal);
  app.querySelectorAll("[data-checkin]").forEach((button) => button.addEventListener("click", () => saveCheckin(button.dataset.checkin)));
  app.querySelectorAll("[data-incident]").forEach((button) => button.addEventListener("click", () => openIncident(button.dataset.incident)));
}

function statCard(iconName, tokenClass, label, value, small) {
  return `
    <article class="stat-card glass-card">
      <div class="stat-top"><div class="icon-token ${tokenClass}">${icon(iconName)}</div><span class="stat-label">${esc(label)}</span></div>
      <strong>${esc(value)}</strong>
      <small>${esc(small)}</small>
    </article>`;
}

function renderLog(log) {
  const body = log.body && readPath(state.messages, log.body) ? t(log.body) : log.body;
  return `
    <div class="log-item ${esc(log.type)}">
      <strong>${esc(readPath(state.messages, log.title_key) ? t(log.title_key) : log.title_key)}</strong>
      ${body ? `<div>${esc(body)}</div>` : ""}
      <small>${esc(dateTime(log.created_at))}</small>
    </div>`;
}

async function saveCheckin(type) {
  try {
    const body = { smoke_clean: type === "smoke", alcohol_clean: type === "alcohol" };
    const data = await api("/api/checkin", { method: "POST", body });
    state.dashboard = data.dashboard;
    state.notice = t("dashboard.checkin_saved");
    render();
  } catch (error) {
    state.notice = "";
    state.error = error.message;
    render();
  }
}

function renderSettings() {
  const data = state.dashboard;
  const profile = data.profile || {};
  const goal = data.money.goal || {};
  const smoking = data.habits.smoking || {};
  const alcohol = data.habits.alcohol || {};
  app.innerHTML = `
    <div class="topbar">
      ${renderBrand(true)}
      <button class="secondary-button" id="backDashboard">${esc(t("common.back"))}</button>
    </div>
    <section class="panel">
      <div class="section-head"><div><p class="eyebrow">${esc(t("settings.kicker"))}</p><h2>${esc(t("settings.title"))}</h2></div></div>
      ${state.error ? `<div class="alert">${esc(state.error)}</div>` : ""}
      <form id="settingsForm" class="form-grid">
        <div class="settings-section">
          <h3>${esc(t("settings.account"))}</h3>
          <div class="settings-grid">
            <label>${esc(t("auth.name"))}<input name="name" value="${esc(data.user.name)}"></label>
            <label>${esc(t("auth.language"))}<select name="language">${["ru","en","de"].map((lang) => `<option value="${lang}" ${data.user.language === lang ? "selected" : ""}>${lang.toUpperCase()}</option>`).join("")}</select></label>
            <label>${esc(t("onboarding.currency"))}<input name="currency" maxlength="3" value="${esc(profile.currency || goal.currency || "EUR")}"></label>
          </div>
        </div>
        <div class="settings-section">
          <h3>${esc(t("settings.goal"))}</h3>
          <div class="settings-grid">
            <label>${esc(t("onboarding.goal_name"))}<input name="goal_title" value="${esc(goal.title || "")}"></label>
            <label>${esc(t("onboarding.goal_amount"))}<input name="goal_amount" type="number" min="1" step="1" value="${esc(goal.target_amount || 1)}"></label>
          </div>
        </div>
        ${data.habit_types.includes("smoking") ? `
        <div class="settings-section">
          <h3>${esc(t("settings.smoking"))}</h3>
          <div class="settings-grid">
            <label>${esc(t("onboarding.cigarettes_per_day"))}<input name="cigarettes_per_day" type="number" min="0" step="1" value="${esc(smoking.cigarettes_per_day || 0)}"></label>
            <label>${esc(t("onboarding.cigarettes_per_pack"))}<input name="cigarettes_per_pack" type="number" min="1" step="1" value="${esc(smoking.cigarettes_per_pack || 20)}"></label>
            <label>${esc(t("onboarding.pack_price"))}<input name="pack_price" type="number" min="0" step="0.1" value="${esc(smoking.pack_price || 0)}"></label>
          </div>
        </div>` : ""}
        ${data.habit_types.includes("alcohol") ? `
        <div class="settings-section">
          <h3>${esc(t("settings.alcohol"))}</h3>
          <div class="settings-grid">
            <label>${esc(t("onboarding.alcohol_weekly_spend"))}<input name="alcohol_weekly_spend" type="number" min="0" step="0.1" value="${esc(alcohol.alcohol_weekly_spend || 0)}"></label>
          </div>
        </div>` : ""}
        <div class="settings-section">
          <h3>${esc(t("settings.reset_title"))}</h3>
          <p class="muted">${esc(t("settings.reset_body"))}</p>
          <div class="settings-grid">
            <label><span>${esc(t("settings.confirm_reset"))}</span><input name="confirm_reset" placeholder="RESET"></label>
          </div>
        </div>
        <div class="form-actions">
          <button class="primary-button full" type="submit">${esc(t("settings.save"))}</button>
          <button class="danger-button full" id="logoutSettings" type="button">${esc(t("settings.logout"))}</button>
        </div>
      </form>
    </section>`;

  app.querySelector("#backDashboard").addEventListener("click", () => { state.screen = "dashboard"; state.error = ""; render(); });
  app.querySelector("#logoutSettings").addEventListener("click", logout);
  app.querySelector("#settingsForm").addEventListener("submit", saveSettings);
}

async function saveSettings(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const body = {
    name: String(form.get("name") || ""),
    language: String(form.get("language") || state.lang),
    currency: String(form.get("currency") || "EUR").toUpperCase().slice(0, 3),
    main_reason: state.dashboard.profile?.main_reason || "",
    custom_reason: state.dashboard.profile?.custom_reason || "",
    goal_title: String(form.get("goal_title") || ""),
    goal_amount: Number(form.get("goal_amount") || 1),
    reset_progress: String(form.get("confirm_reset") || "") === "RESET",
    confirm_reset: String(form.get("confirm_reset") || "")
  };

  if (state.dashboard.habit_types.includes("smoking")) {
    body.smoking = {
      is_active: true,
      cigarettes_per_day: Number(form.get("cigarettes_per_day") || 0),
      cigarettes_per_pack: Number(form.get("cigarettes_per_pack") || 20),
      pack_price: Number(form.get("pack_price") || 0)
    };
  }
  if (state.dashboard.habit_types.includes("alcohol")) {
    body.alcohol = {
      is_active: true,
      alcohol_weekly_spend: Number(form.get("alcohol_weekly_spend") || 0),
      dangerous_days: state.dashboard.habits.alcohol?.dangerous_days || []
    };
  }

  try {
    const data = await api("/api/settings", { method: "POST", body });
    state.dashboard = data.dashboard;
    if (body.language !== state.lang) await loadLanguage(body.language);
    state.screen = "dashboard";
    state.notice = t("settings.saved");
  } catch (error) {
    state.error = error.message;
  }
  render();
}

async function logout() {
  try {
    await api("/api/logout", { method: "POST", body: {} });
  } catch {}
  try {
    await loadLanguage(state.lang);
  } catch {}
  state.user = null;
  state.dashboard = null;
  state.screen = "auth";
  state.authMode = "login";
  state.notice = "";
  render();
}

async function openCraving() {
  const habitType = state.dashboard?.habit_types?.[0] || null;
  state.craving = { id: null, timer: null, seconds: 90, reason: "", action: "", habitType };
  try {
    const data = await api("/api/craving/start", { method: "POST", body: { habit_type: habitType } });
    state.craving.id = data.craving_id;
  } catch {}
  renderCravingModal("reason");
  startCravingTimer();
}

function startCravingTimer() {
  clearInterval(state.craving.timer);
  state.craving.timer = setInterval(() => {
    state.craving.seconds = Math.max(0, state.craving.seconds - 1);
    const timer = modalRoot.querySelector("#timerText");
    if (timer) timer.textContent = formatTimer(state.craving.seconds);
    if (state.craving.seconds <= 0) clearInterval(state.craving.timer);
  }, 1000);
}

function formatTimer(seconds) {
  const min = String(Math.floor(seconds / 60)).padStart(2, "0");
  const sec = String(seconds % 60).padStart(2, "0");
  return `${min}:${sec}`;
}

function renderCravingModal(phase) {
  const reasons = list("craving.reasons");
  modalRoot.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true">
      <div class="modal-card">
        <button class="icon-button close-button" id="closeModal">${icon("x")}</button>
        <p class="eyebrow">${esc(t("craving.kicker"))}</p>
        <h2>${esc(t("craving.title"))}</h2>
        <p class="muted">${esc(t("craving.subtitle"))}</p>
        <div class="timer-block"><div class="timer-ring"><div class="timer-ring-inner"><strong id="timerText">${formatTimer(state.craving.seconds)}</strong><span>${esc(t("craving.timer_label"))}</span></div></div></div>
        ${phase === "reason" ? `
          <h3>${esc(t("craving.reason_title"))}</h3>
          <div class="pill-grid">${reasons.map((reason) => `<button class="pill" type="button" data-reason="${esc(reason)}">${esc(reason)}</button>`).join("")}</div>
        ` : `
          <h3>${esc(t("craving.action_title"))}</h3>
          <p class="rescue-action">${esc(state.craving.action)}</p>
          <button class="primary-button full" id="completeCraving">${esc(t("craving.complete"))}</button>
        `}
      </div>
    </div>`;

  modalRoot.querySelector("#closeModal").addEventListener("click", closeModal);
  modalRoot.querySelectorAll("[data-reason]").forEach((button) => {
    button.addEventListener("click", () => {
      state.craving.reason = button.dataset.reason;
      const actions = list("craving.actions");
      state.craving.action = actions[Math.floor(Math.random() * actions.length)] || "";
      renderCravingModal("action");
    });
  });
  modalRoot.querySelector("#completeCraving")?.addEventListener("click", completeCraving);
}

async function completeCraving() {
  try {
    const data = await api("/api/craving/complete", {
      method: "POST",
      body: {
        craving_id: state.craving.id,
        habit_type: state.craving.habitType,
        reason: state.craving.reason,
        rescue_action: state.craving.action
      }
    });
    state.dashboard = data.dashboard;
    state.notice = t("craving.saved");
    closeModal();
    render();
  } catch (error) {
    state.error = error.message;
    closeModal();
    render();
  }
}

function openIncident(habitType) {
  modalRoot.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true">
      <div class="modal-card">
        <button class="icon-button close-button" id="closeModal">${icon("x")}</button>
        <p class="eyebrow">${esc(t("incident.kicker"))}</p>
        <h2>${esc(t("incident.title"))}</h2>
        <p class="muted">${esc(t("incident.subtitle"))}</p>
        <label>${esc(t("incident.note"))}<textarea id="incidentNote" rows="4" placeholder="${esc(t("incident.placeholder"))}"></textarea></label>
        <div class="form-actions">
          <button class="primary-button full" id="saveIncident">${esc(t("incident.save"))}</button>
        </div>
      </div>
    </div>`;
  modalRoot.querySelector("#closeModal").addEventListener("click", closeModal);
  modalRoot.querySelector("#saveIncident").addEventListener("click", async () => {
    try {
      const data = await api("/api/incident", { method: "POST", body: { habit_type: habitType, note: modalRoot.querySelector("#incidentNote").value } });
      state.dashboard = data.dashboard;
      state.notice = t("incident.saved");
      closeModal();
      render();
    } catch (error) {
      state.error = error.message;
      closeModal();
      render();
    }
  });
}

function sharePayload() {
  const data = state.dashboard;
  const currency = data.money.goal.currency || "EUR";
  const hasSmoking = data.habit_types.includes("smoking");
  const hasAlcohol = data.habit_types.includes("alcohol");
  const controlDays = Number(data.reactor.control_days || 0);
  const habits = hasSmoking && hasAlcohol
    ? t("habits.both")
    : hasSmoking
      ? t("habits.smoking")
      : t("habits.alcohol");
  const motivationKey = hasSmoking && hasAlcohol
    ? "share.motivation_both"
    : hasSmoking
      ? "share.motivation_smoking"
      : "share.motivation_alcohol";
  const url = new URL(location.href);
  url.hash = "";

  return {
    appName: t("app.name"),
    title: t("share.card_title"),
    subtitle: t("share.card_subtitle", { habit: habits }),
    motivation: t(motivationKey, { days: controlDays }),
    name: data.user.name,
    percent: Number(data.reactor.percent || 0),
    status: t(data.reactor.status_key),
    days: controlDays,
    wins: Number(data.stats.craving_wins || 0),
    saved: money(data.money.saved_total, currency),
    savedWeek: money(data.money.saved_week, currency),
    goal: data.money.goal.title || t("dashboard.personal_goal"),
    goalPercent: Number(data.money.goal.progress_percent || 0),
    level: t(data.reactor.level_key),
    phrase: mentorPhrase("milestone") || mentorPhrase("general"),
    url: url.toString()
  };
}

function shareText(payload) {
  return t("share.text", {
    app: payload.appName,
    motivation: payload.motivation,
    percent: `${payload.percent}%`,
    days: payload.days,
    saved: payload.saved,
    goal: payload.goal,
    url: payload.url
  });
}

function openShareModal() {
  const payload = sharePayload();

  modalRoot.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true">
      <div class="modal-card share-modal">
        <button class="icon-button close-button" id="closeModal">${icon("x")}</button>
        <p class="eyebrow">${esc(t("share.kicker"))}</p>
        <h2>${esc(t("share.title"))}</h2>
        <canvas id="shareCanvas" class="share-canvas" width="1080" height="1350"></canvas>
        <div class="share-actions">
          <button class="primary-button" id="nativeShare">${icon("reactor")}${esc(t("share.system"))}</button>
          <button class="share-channel" id="whatsappShare" type="button">${esc(t("share.whatsapp"))}</button>
          <button class="share-channel" id="telegramShare" type="button">${esc(t("share.telegram"))}</button>
          <button class="secondary-button" id="downloadShare">${esc(t("share.download"))}</button>
        </div>
        <p class="share-status" id="shareStatus" aria-live="polite"></p>
      </div>
    </div>`;

  const canvas = modalRoot.querySelector("#shareCanvas");
  drawShareCanvas(canvas, payload);
  modalRoot.querySelector("#closeModal").addEventListener("click", closeModal);
  modalRoot.querySelector("#nativeShare").addEventListener("click", () => shareImageOrDownload(canvas, payload));
  modalRoot.querySelector("#whatsappShare").addEventListener("click", () => shareImageOrDownload(canvas, payload));
  modalRoot.querySelector("#telegramShare").addEventListener("click", () => shareImageOrDownload(canvas, payload));
  modalRoot.querySelector("#downloadShare").addEventListener("click", () => downloadShareImage(canvas));
}

function drawShareCanvas(canvas, payload) {
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  const cx = width / 2;
  const ringRadius = 250;
  const ringWidth = 38;
  const ringStart = -Math.PI / 2;
  const ringEnd = ringStart + 2 * Math.PI * (payload.percent / 100);
  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, "#070b18");
  bg.addColorStop(.5, "#101828");
  bg.addColorStop(1, "#061826");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  drawGrid(ctx, width, height);
  drawGlow(ctx, 185, 140, 260, "rgba(138, 92, 255, .28)");
  drawGlow(ctx, 900, 260, 240, "rgba(0, 215, 255, .22)");
  drawGlow(ctx, 540, 900, 360, "rgba(123, 255, 207, .13)");

  ctx.fillStyle = "#f4f8ff";
  ctx.textAlign = "center";
  ctx.font = "800 44px Inter, Segoe UI, Arial, sans-serif";
  ctx.fillText(payload.appName, cx, 108);
  ctx.fillStyle = "rgba(244, 248, 255, .68)";
  fitCanvasText(ctx, payload.motivation, cx, 158, 920, 30, 22, 700);

  ctx.save();
  ctx.shadowColor = "rgba(0, 215, 255, .35)";
  ctx.shadowBlur = 34;
  ctx.lineWidth = ringWidth;
  ctx.strokeStyle = "rgba(255,255,255,.11)";
  ctx.beginPath();
  ctx.arc(cx, 470, ringRadius, 0, Math.PI * 2);
  ctx.stroke();
  const ring = ctx.createLinearGradient(cx - ringRadius, 220, cx + ringRadius, 720);
  ring.addColorStop(0, "#8a5cff");
  ring.addColorStop(.35, "#00d7ff");
  ring.addColorStop(.72, "#7bffcf");
  ring.addColorStop(1, "#ffd166");
  ctx.lineCap = "round";
  ctx.strokeStyle = ring;
  ctx.beginPath();
  ctx.arc(cx, 470, ringRadius, ringStart, ringEnd);
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = "rgba(255,255,255,.04)";
  ctx.beginPath();
  ctx.arc(cx, 470, 148, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,.12)";
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = "#f4f8ff";
  ctx.font = "900 116px Inter, Segoe UI, Arial, sans-serif";
  ctx.fillText(`${payload.percent}%`, cx, 468);
  ctx.fillStyle = "#00d7ff";
  ctx.font = "800 28px Inter, Segoe UI, Arial, sans-serif";
  ctx.fillText(payload.status.toUpperCase(), cx, 525);

  const cards = [
    [t("share.days"), String(payload.days)],
    [t("share.saved"), payload.saved],
    [t("share.wins"), String(payload.wins)],
    [t("share.level"), payload.level]
  ];
  cards.forEach((card, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    drawShareMetric(ctx, 92 + col * 462, 790 + row * 160, 402, 118, card[0], card[1]);
  });

  drawShareMetric(ctx, 92, 1110, 864, 112, t("share.goal"), `${payload.goal} · ${payload.goalPercent}%`);

  ctx.fillStyle = "rgba(244,248,255,.78)";
  ctx.font = "600 28px Inter, Segoe UI, Arial, sans-serif";
  wrapCanvasText(ctx, payload.phrase, cx, 1278, 860, 36);
}

function drawGrid(ctx, width, height) {
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,.035)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= width; x += 42) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y <= height; y += 42) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawGlow(ctx, x, y, radius, color) {
  const glow = ctx.createRadialGradient(x, y, 0, x, y, radius);
  glow.addColorStop(0, color);
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

function drawShareMetric(ctx, x, y, width, height, label, value) {
  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,.075)";
  ctx.strokeStyle = "rgba(255,255,255,.13)";
  ctx.lineWidth = 2;
  roundRect(ctx, x, y, width, height, 18);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "rgba(244,248,255,.62)";
  ctx.font = "700 24px Inter, Segoe UI, Arial, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(label.toUpperCase(), x + 28, y + 42);
  ctx.fillStyle = "#f4f8ff";
  fitCanvasText(ctx, value, x + 28, y + 91, width - 56, 42, 24, 900);
  ctx.restore();
}

function fitCanvasText(ctx, text, x, y, maxWidth, maxFontSize, minFontSize, weight) {
  const family = "Inter, Segoe UI, Arial, sans-serif";
  let fontSize = maxFontSize;
  let value = String(text);

  while (fontSize > minFontSize) {
    ctx.font = `${weight} ${fontSize}px ${family}`;
    if (ctx.measureText(value).width <= maxWidth) break;
    fontSize -= 2;
  }

  ctx.font = `${weight} ${fontSize}px ${family}`;
  while (value.length > 3 && ctx.measureText(value).width > maxWidth) {
    value = value.slice(0, -1);
  }
  if (value !== String(text)) value = `${value.slice(0, -3)}...`;
  ctx.fillText(value, x, y);
}

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = String(text).split(" ");
  let line = "";
  const lines = [];
  words.forEach((word) => {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  });
  if (line) lines.push(line);
  lines.slice(0, 2).forEach((item, index) => ctx.fillText(item, x, y + index * lineHeight));
}

function canvasBlob(canvas) {
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png", .95));
}

function setShareStatus(message) {
  const status = modalRoot.querySelector("#shareStatus");
  if (status) status.textContent = message;
}

async function shareImageOrDownload(canvas, payload) {
  try {
    if (await nativeShareImage(canvas, payload)) {
      setShareStatus("");
      return;
    }
    if (await downloadShareImage(canvas)) {
      setShareStatus(t("share.fallback_downloaded"));
    }
  } catch (error) {
    if (error?.name === "AbortError") return;
    if (await downloadShareImage(canvas)) {
      setShareStatus(t("share.fallback_downloaded"));
    }
  }
}

async function nativeShareImage(canvas, payload) {
  const text = shareText(payload);
  const blob = await canvasBlob(canvas);
  if (!blob || !("File" in window) || !navigator.share || !navigator.canShare) {
    return false;
  }
  const file = new File([blob], "reactor-progress.png", { type: "image/png" });
  if (!navigator.canShare({ files: [file] })) {
    return false;
  }
  await navigator.share({ title: payload.appName, text, files: [file] });
  return true;
}

async function downloadShareImage(canvas) {
  const blob = await canvasBlob(canvas);
  if (!blob) return false;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "reactor-progress.png";
  link.click();
  URL.revokeObjectURL(url);
  return true;
}

function closeModal() {
  clearInterval(state.craving.timer);
  modalRoot.innerHTML = "";
}

init();
