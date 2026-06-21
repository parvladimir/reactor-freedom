const boot = window.REACTOR_BOOT || { csrf: "", basePath: "", defaultLanguage: "en" };
const app = document.getElementById("app");
const modalRoot = document.getElementById("modal-root");

if ("scrollRestoration" in history) history.scrollRestoration = "manual";

const state = {
  lang: localStorage.getItem("reactor_lang") || boot.defaultLanguage || "en",
  messages: {},
  screen: "boot",
  authMode: "login",
  user: null,
  dashboard: null,
  error: "",
  errorCode: "",
  notice: "",
  photoPreviewUrl: null,
  enterDashboardAtTop: false,
  pendingVerificationEmail: "",
  loading: false,
  social: {
    view: "feed",
    loading: false,
    data: null,
    query: "",
    results: [],
    unreadCount: 0,
    notice: "",
    invite: {
      email: "",
      name: "",
      message: ""
    }
  },
  authForm: {
    name: "",
    email: "",
    password: "",
    password_confirmation: "",
    marketing_opt_in: false
  },
  passwordVisible: {
    password: false,
    password_confirmation: false
  },
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

let socialPollTimer = null;
let socialPollBusy = false;
let socialPollingUserId = null;
const RETURN_BRIEF_MIN_MS = 4 * 60 * 60 * 1000;

const apiPath = (path) => `${boot.basePath || ""}${path}`;
const icon = (name) => `<svg aria-hidden="true" focusable="false"><use href="#i-${name}"></use></svg>`;
const AVATAR_CODES = ["pulse", "nova", "focus", "mint", "ember", "orbit"];
const esc = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

function avatarMarkup(name, code = "pulse", extraClass = "", userId = null, hasAvatar = false) {
  const safeCode = AVATAR_CODES.includes(code) ? code : "pulse";
  const photo = hasAvatar && Number(userId) > 0
    ? `<img src="${esc(apiPath(`/api/profile/avatar?user_id=${encodeURIComponent(userId)}`))}" alt="">`
    : `<span>${esc(initials(name))}</span><i></i>`;
  return `<span class="user-avatar avatar-${safeCode} ${hasAvatar ? "has-photo" : ""} ${esc(extraClass)}" aria-hidden="true">${photo}</span>`;
}

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

function dashboardMotion(data) {
  const key = `reactor_dashboard_snapshot_${data.user.id}`;
  const stage = data.reactor.next_reward?.code || "complete";
  const targetPercent = Number(data.reactor.percent || 0);
  const progression = data.progression || {};
  let previous = null;

  try {
    previous = JSON.parse(localStorage.getItem(key) || "null");
  } catch {
    previous = null;
  }

  const sameStage = previous?.stage === stage;
  const sameLevel = Number(previous?.level) === Number(progression.level);
  const seenAt = Date.parse(previous?.seen_at || "");
  const awayMs = Number.isFinite(seenAt) ? Math.max(0, Date.now() - seenAt) : 0;
  const previousControlHours = Number(previous?.control_hours);
  const controlHoursDelta = Number.isFinite(previousControlHours)
    ? Math.max(0, Number(data.reactor.control_hours || 0) - previousControlHours)
    : 0;
  const savedDelta = Math.max(0, Number(data.money.saved_total || 0) - Number(previous?.saved_total || 0));
  const xpDelta = Math.max(0, Number(progression.xp || 0) - Number(previous?.xp || 0));
  const reactorDelta = sameStage ? Math.max(0, targetPercent - Number(previous?.percent || 0)) : 0;
  const levelChanged = Boolean(previous) && Number(progression.level || 1) > Number(previous?.level || 1);
  const unlockedRewards = Array.isArray(data.unlocked_now) ? data.unlocked_now : [];
  const hasReturnProgress = controlHoursDelta >= 1
    || savedDelta >= 0.01
    || xpDelta > 0
    || reactorDelta >= 1
    || levelChanged
    || unlockedRewards.length > 0;

  return {
    key,
    stage,
    hadPrevious: Boolean(previous),
    reactorFrom: sameStage ? Math.min(targetPercent, Math.max(0, Number(previous?.percent || 0))) : 0,
    reactorTo: targetPercent,
    xpFrom: sameLevel ? Math.min(Number(progression.xp || 0), Math.max(0, Number(previous?.xp || 0))) : Number(progression.level_start_xp || 0),
    xpPercentFrom: sameLevel ? Math.min(Number(progression.progress_percent || 0), Math.max(0, Number(previous?.xp_percent || 0))) : 0,
    savedFrom: Math.min(Number(data.money.saved_total || 0), Math.max(0, Number(previous?.saved_total || 0))),
    returnBrief: previous && awayMs >= RETURN_BRIEF_MIN_MS && hasReturnProgress ? {
      awayMs,
      controlHoursDelta,
      savedDelta,
      xpDelta,
      reactorDelta,
      levelChanged,
      unlockedRewards
    } : null
  };
}

function animateDashboardProgress(data, motion, currency) {
  const progression = data.progression || {};
  const ring = app.querySelector(".hero-card .ring-progress");
  const reactorValue = app.querySelector("#reactorPercentValue");
  const xpValue = app.querySelector("#xpValueAnimated");
  const xpFill = app.querySelector("#xpProgressAnimated");
  const savedValue = app.querySelector("#savedTotalAnimated");
  const ringWrap = app.querySelector(".ring-wrap");
  const radius = 96;
  const circumference = 2 * Math.PI * radius;
  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const durationMs = reduceMotion ? 0 : 2100;
  const startedAt = performance.now();

  if (motion.reactorTo !== motion.reactorFrom) ringWrap?.classList.add("is-counting");

  localStorage.setItem(motion.key, JSON.stringify({
    stage: motion.stage,
    percent: motion.reactorTo,
    level: progression.level,
    xp: progression.xp,
    xp_percent: progression.progress_percent,
    saved_total: data.money.saved_total,
    control_hours: data.reactor.control_hours,
    control_days: data.reactor.control_days,
    seen_at: new Date().toISOString()
  }));

  function frame(now) {
    const raw = durationMs === 0 ? 1 : Math.min(1, (now - startedAt) / durationMs);
    const eased = 1 - Math.pow(1 - raw, 3);
    const percent = motion.reactorFrom + (motion.reactorTo - motion.reactorFrom) * eased;
    const xp = motion.xpFrom + (Number(progression.xp || 0) - motion.xpFrom) * eased;
    const xpPercent = motion.xpPercentFrom + (Number(progression.progress_percent || 0) - motion.xpPercentFrom) * eased;
    const saved = motion.savedFrom + (Number(data.money.saved_total || 0) - motion.savedFrom) * eased;

    if (ring) ring.style.strokeDashoffset = String(circumference - circumference * percent / 100);
    if (reactorValue) reactorValue.textContent = `${Math.round(percent)}%`;
    if (xpValue) xpValue.textContent = t("progression.xp_value", { xp: Math.round(xp) });
    if (xpFill) xpFill.style.width = `${xpPercent}%`;
    if (savedValue) savedValue.textContent = money(saved, currency);
    if (raw < 1) {
      requestAnimationFrame(frame);
    } else {
      ringWrap?.classList.remove("is-counting");
      window.setTimeout(() => openReturnBrief(data, motion, currency), reduceMotion ? 120 : 360);
    }
  }

  requestAnimationFrame(frame);
}

function returnBriefItems(data, motion, currency) {
  const brief = motion.returnBrief;
  if (!brief) return [];
  const progression = data.progression || {};
  const items = [];

  if (brief.levelChanged) {
    items.push({
      icon: "trophy",
      token: "token-violet",
      label: t("return_brief.new_level"),
      value: t("return_brief.new_level_value", { level: progression.level, title: t(progression.title_key) })
    });
  } else if (brief.xpDelta > 0) {
    items.push({
      icon: "trophy",
      token: "token-violet",
      label: t("return_brief.xp"),
      value: t("return_brief.xp_value", { xp: Math.round(brief.xpDelta) })
    });
  }

  if (brief.controlHoursDelta >= 1) {
    items.push({
      icon: "shield",
      token: "token-green",
      label: t("return_brief.control"),
      value: t("return_brief.control_value", { time: duration(brief.controlHoursDelta) })
    });
  }

  if (brief.savedDelta >= 0.01) {
    items.push({
      icon: "money",
      token: "token-green",
      label: t("return_brief.saved"),
      value: t("return_brief.saved_value", { amount: money(brief.savedDelta, currency) })
    });
  }

  if (!brief.unlockedRewards.length && brief.reactorDelta >= 1) {
    items.push({
      icon: "reactor",
      token: "token-blue",
      label: t("return_brief.reactor"),
      value: t("return_brief.reactor_value", { percent: Math.round(brief.reactorDelta) })
    });
  }

  brief.unlockedRewards.slice(0, 2).forEach((reward) => {
    items.push({
      icon: "star",
      token: "token-gold",
      label: t("return_brief.milestone"),
      value: t(reward.title_key)
    });
  });

  return items.slice(0, 4);
}

function openReturnBrief(data, motion, currency) {
  if (!motion.returnBrief || state.screen !== "dashboard" || modalRoot.childElementCount > 0) return;
  const items = returnBriefItems(data, motion, currency);
  if (!items.length) return;

  const away = duration(motion.returnBrief.awayMs / 3600000);
  modalRoot.innerHTML = `
    <div class="modal return-brief-overlay" role="dialog" aria-modal="true" aria-labelledby="returnBriefTitle">
      <div class="modal-card return-brief-modal">
        <button class="icon-button close-button" id="closeReturnBrief" type="button" aria-label="${esc(t("return_brief.close"))}">${icon("x")}</button>
        <div class="return-brief-orbit" aria-hidden="true">
          <span>${icon("reactor")}</span>
        </div>
        <div class="return-brief-heading">
          <p class="eyebrow">${esc(t("return_brief.kicker"))}</p>
          <h2 id="returnBriefTitle">${esc(t("return_brief.title"))}</h2>
          <p>${esc(t("return_brief.subtitle", { time: away }))}</p>
        </div>
        <div class="return-brief-grid">
          ${items.map((item) => `
            <div class="return-brief-item">
              <span class="icon-token ${esc(item.token)}">${icon(item.icon)}</span>
              <div><small>${esc(item.label)}</small><strong>${esc(item.value)}</strong></div>
            </div>`).join("")}
        </div>
        <blockquote>${esc(mentorPhrase("return"))}</blockquote>
        <button class="primary-button full" id="continueReturnBrief" type="button">${esc(t("return_brief.continue"))}</button>
      </div>
    </div>`;

  const close = () => closeModal();
  modalRoot.querySelector("#closeReturnBrief").addEventListener("click", close);
  modalRoot.querySelector("#continueReturnBrief").addEventListener("click", close);
  modalRoot.querySelector(".return-brief-overlay").addEventListener("click", (event) => {
    if (event.target === event.currentTarget) close();
  });
}

function startSocialNotificationPolling() {
  const userId = Number(state.user?.id || 0);
  if (!userId) return;
  if (socialPollingUserId === userId && socialPollTimer) {
    updateSocialBadges();
    return;
  }

  stopSocialNotificationPolling();
  socialPollingUserId = userId;
  void pollSocialNotifications();
  socialPollTimer = window.setInterval(pollSocialNotifications, 20000);
}

function stopSocialNotificationPolling() {
  if (socialPollTimer) window.clearInterval(socialPollTimer);
  socialPollTimer = null;
  socialPollBusy = false;
  socialPollingUserId = null;
}

async function pollSocialNotifications() {
  if (socialPollBusy || !state.user?.id) return;
  socialPollBusy = true;

  try {
    const data = await api("/api/social/notifications/poll");
    const notifications = Array.isArray(data.notifications) ? data.notifications : [];
    state.social.unreadCount = Number(data.unread_count || 0);
    if (state.social.data) {
      state.social.data.notifications = notifications;
      state.social.data.unread_count = state.social.unreadCount;
    }
    updateSocialBadges();

    const storageKey = `reactor_social_notice_${state.user.id}`;
    const lastAnnouncedId = Number(localStorage.getItem(storageKey) || 0);
    const fresh = notifications
      .filter((notification) => !notification.read && Number(notification.id) > lastAnnouncedId)
      .sort((a, b) => Number(a.id) - Number(b.id));

    fresh.slice(-3).forEach((notification) => {
      showSocialToast(notification);
      void showBrowserSocialNotification(notification);
    });

    const newestId = notifications.reduce((max, notification) => Math.max(max, Number(notification.id || 0)), lastAnnouncedId);
    if (newestId > lastAnnouncedId) localStorage.setItem(storageKey, String(newestId));
  } catch {
    // The dashboard stays usable if a background notification check fails.
  } finally {
    socialPollBusy = false;
  }
}

function updateSocialBadges() {
  const count = Number(state.social.unreadCount || 0);
  document.querySelectorAll("[data-social-unread]").forEach((badge) => {
    badge.textContent = count > 99 ? "99+" : String(count);
    badge.hidden = count < 1;
  });
}

function showSocialToast(notification) {
  const stack = app.querySelector("#socialToastStack");
  if (!stack || stack.querySelector(`[data-notification-id="${Number(notification.id)}"]`)) return;

  const toast = document.createElement("button");
  toast.type = "button";
  toast.className = "social-toast";
  toast.dataset.notificationId = String(notification.id);
  toast.innerHTML = `
    ${avatarMarkup(notification.actor?.name || "?", notification.actor?.avatar_code, "social-toast-avatar", notification.actor?.id, notification.actor?.has_avatar)}
    <span><strong>${esc(socialNotificationTitle(notification))}</strong>${notification.body ? `<small>${esc(notification.body)}</small>` : ""}</span>`;
  toast.addEventListener("click", () => {
    toast.remove();
    void openSocialModal("notifications");
  });
  stack.appendChild(toast);
  window.setTimeout(() => toast.remove(), 7500);
}

async function showBrowserSocialNotification(notification) {
  if (!("Notification" in window) || Notification.permission !== "granted" || document.visibilityState === "visible") return;

  const title = socialNotificationTitle(notification);
  const options = {
    body: notification.body || t("social.notification_open"),
    icon: apiPath("/assets/icons/icon.svg"),
    badge: apiPath("/assets/icons/icon.svg"),
    tag: `reactor-social-${notification.id}`,
    data: { url: `${location.pathname}?social=notifications` }
  };

  try {
    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(title, options);
    } else {
      new Notification(title, options);
    }
  } catch {
    // In-app notifications remain available when the browser blocks system notifications.
  }
}

function notificationPermissionMarkup() {
  if (!("Notification" in window)) {
    return `<span class="notification-permission-state">${esc(t("social.browser_notifications_unsupported"))}</span>`;
  }
  if (Notification.permission === "granted") {
    return `<span class="notification-permission-state enabled">${icon("bell")}${esc(t("social.browser_notifications_enabled"))}</span>`;
  }
  if (Notification.permission === "denied") {
    return `<span class="notification-permission-state">${esc(t("social.browser_notifications_denied"))}</span>`;
  }
  return `<button class="secondary-button compact-action" id="enableBrowserNotifications" type="button">${icon("bell")}${esc(t("social.browser_notifications_enable"))}</button>`;
}

async function enableBrowserNotifications() {
  if (!("Notification" in window)) return;
  const permission = await Notification.requestPermission();
  state.social.notice = permission === "granted"
    ? t("social.browser_notifications_enabled")
    : t("social.browser_notifications_denied");
  renderSocialModal();
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
    const error = new Error(payload?.error?.message || t("errors.generic"));
    error.code = payload?.error?.code || "error";
    error.meta = payload?.meta || {};
    throw error;
  }
  return payload.data || {};
}

async function apiForm(path, formData) {
  const response = await fetch(apiPath(path), {
    method: "POST",
    headers: { Accept: "application/json", "X-CSRF-Token": boot.csrf || "" },
    credentials: "same-origin",
    body: formData
  });
  const payload = await response.json().catch(() => null);
  if (payload?.csrf) boot.csrf = payload.csrf;
  if (!response.ok || !payload || payload.ok !== true) {
    const error = new Error(payload?.error?.message || t("errors.generic"));
    error.code = payload?.error?.code || "error";
    throw error;
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
  state.enterDashboardAtTop = state.screen === "dashboard";
}

async function init() {
  renderBoot();
  const urlParams = new URLSearchParams(location.search);
  const requestedLang = urlParams.get("lang");
  if (["ru", "en", "de"].includes(requestedLang)) state.lang = requestedLang;
  const inviteMode = urlParams.has("invite") || urlParams.has("register");

  try {
    await loadLanguage(state.lang);
    const verifyToken = urlParams.get("verify_email");
    if (verifyToken) {
      const verified = await api(`/api/email/verify?token=${encodeURIComponent(verifyToken)}`);
      window.history.replaceState({}, document.title, location.pathname);
      if (verified.user?.language && verified.user.language !== state.lang) {
        await loadLanguage(verified.user.language);
      }
      state.notice = t("auth.email_verified");
      await loadDashboard();
      render();
      return;
    }
    const me = await api("/api/me");
    if (me.authenticated && me.user) {
      if (me.user.language && me.user.language !== state.lang) {
        await loadLanguage(me.user.language);
      }
      await loadDashboard();
    } else {
      state.screen = "auth";
      state.authMode = inviteMode ? "register" : "login";
    }
  } catch (error) {
    state.screen = "auth";
    state.authMode = inviteMode ? "register" : state.authMode;
    state.error = error.code === "email_verification_invalid" ? t("auth.email_verify_failed") : error.message;
  }
  render();

  if (state.screen === "dashboard" && urlParams.get("social") === "notifications") {
    window.history.replaceState({}, document.title, location.pathname);
    requestAnimationFrame(() => openSocialModal("notifications"));
  }

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register(apiPath(`/service-worker.js?v=${encodeURIComponent(boot.assetVersion || "18")}`)).catch(() => {});
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

function emptyAuthForm(email = "") {
  return {
    name: "",
    email,
    password: "",
    password_confirmation: "",
    marketing_opt_in: false
  };
}

function captureAuthForm(formElement) {
  if (!formElement) return;
  const form = new FormData(formElement);
  state.authForm = {
    name: String(form.get("name") || ""),
    email: String(form.get("email") || ""),
    password: String(form.get("password") || ""),
    password_confirmation: String(form.get("password_confirmation") || ""),
    marketing_opt_in: form.get("marketing_opt_in") === "1"
  };
}

function renderPasswordInput(name, label, autocomplete) {
  const visible = state.passwordVisible[name] === true;
  const actionLabel = t(visible ? "auth.hide_password" : "auth.show_password");
  return `
    <label class="password-label">
      ${esc(label)}
      <span class="password-field">
        <input name="${esc(name)}" type="${visible ? "text" : "password"}" autocomplete="${esc(autocomplete)}" required minlength="8" value="${esc(state.authForm[name] || "")}">
        <button class="password-toggle" type="button" data-password-toggle="${esc(name)}" aria-label="${esc(actionLabel)}" title="${esc(actionLabel)}">
          ${icon(visible ? "eye-off" : "eye")}
        </button>
      </span>
    </label>`;
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
        <div class="auth-promise">
          <strong>${esc(t("auth.hero_motto"))}</strong>
          <span>${esc(t("auth.hero_motto_body"))}</span>
        </div>
        <div class="auth-feature-grid">
          ${list("auth.hero_features").map((feature) => `
            <div class="auth-feature">
              <div class="icon-token ${esc(feature.token || "token-blue")}">${icon(feature.icon || "star")}</div>
              <strong>${esc(feature.title)}</strong>
              <span>${esc(feature.body)}</span>
            </div>`).join("")}
        </div>
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
        ${state.notice ? `<div class="alert success">${esc(state.notice)}</div>` : ""}
        <form id="authForm" class="form-grid">
          ${isRegister ? `<label>${esc(t("auth.name"))}<input name="name" autocomplete="name" required minlength="2" maxlength="80" value="${esc(state.authForm.name)}"></label>` : ""}
          <label>${esc(t("auth.email"))}<input name="email" type="email" autocomplete="email" required value="${esc(state.authForm.email)}"></label>
          ${renderPasswordInput("password", t("auth.password"), isRegister ? "new-password" : "current-password")}
          ${isRegister ? renderPasswordInput("password_confirmation", t("auth.password_confirm"), "new-password") : ""}
          ${isRegister ? `<label class="checkbox-line"><input name="marketing_opt_in" type="checkbox" value="1" ${state.authForm.marketing_opt_in ? "checked" : ""}><span>${esc(t("auth.marketing_opt_in"))}</span></label>` : ""}
          <div class="form-actions">
            <button class="primary-button full" type="submit" ${state.loading ? "disabled" : ""}>${esc(t(isRegister ? "auth.create_account" : "auth.sign_in"))}</button>
            <button class="text-button" type="button" id="switchAuth">${esc(t(isRegister ? "auth.have_account" : "auth.need_account"))}</button>
          </div>
        </form>
        ${!isRegister && state.pendingVerificationEmail ? `<button class="secondary-button" type="button" id="resendVerification" ${state.loading ? "disabled" : ""}>${esc(t("auth.resend_verification"))}</button>` : ""}
      </div>
    </section>`;

  attachLanguagePicker();
  document.getElementById("switchAuth").addEventListener("click", () => {
    const email = state.authForm.email;
    state.error = "";
    state.errorCode = "";
    state.notice = "";
    state.authMode = isRegister ? "login" : "register";
    state.authForm = emptyAuthForm(email);
    state.passwordVisible = { password: false, password_confirmation: false };
    renderAuth();
  });
  const authForm = document.getElementById("authForm");
  authForm.addEventListener("input", () => captureAuthForm(authForm));
  authForm.addEventListener("change", () => captureAuthForm(authForm));
  authForm.addEventListener("submit", handleAuthSubmit);
  app.querySelectorAll("[data-password-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      captureAuthForm(authForm);
      const field = button.dataset.passwordToggle;
      state.passwordVisible[field] = !state.passwordVisible[field];
      renderAuth();
      app.querySelector(`[name="${field}"]`)?.focus();
    });
  });
  const resendButton = document.getElementById("resendVerification");
  if (resendButton) resendButton.addEventListener("click", resendVerificationEmail);
}

async function handleAuthSubmit(event) {
  event.preventDefault();
  captureAuthForm(event.currentTarget);
  const form = new FormData(event.currentTarget);
  if (state.authMode === "register" && String(form.get("password") || "") !== String(form.get("password_confirmation") || "")) {
    state.error = t("auth.password_mismatch");
    state.errorCode = "password_mismatch";
    state.notice = "";
    renderAuth();
    return;
  }
  state.loading = true;
  state.error = "";
  state.errorCode = "";
  state.notice = "";
  renderAuth();
  try {
    const endpoint = state.authMode === "register" ? "/api/register" : "/api/login";
    const data = {
      name: String(form.get("name") || ""),
      email: String(form.get("email") || ""),
      password: String(form.get("password") || ""),
      password_confirmation: String(form.get("password_confirmation") || ""),
      marketing_opt_in: form.get("marketing_opt_in") === "1",
      language: state.lang
    };
    const result = await api(endpoint, { method: "POST", body: data });
    if (state.authMode === "register" && result.verification_required) {
      state.authMode = "login";
      state.pendingVerificationEmail = result.email || data.email;
      state.authForm = emptyAuthForm(state.pendingVerificationEmail);
      state.passwordVisible = { password: false, password_confirmation: false };
      state.notice = t("auth.verify_sent", { email: state.pendingVerificationEmail });
      state.screen = "auth";
      return;
    }
    state.authForm = emptyAuthForm();
    state.passwordVisible = { password: false, password_confirmation: false };
    state.user = result.user;
    await loadDashboard();
  } catch (error) {
    state.errorCode = error.code || "error";
    if (error.code === "email_not_verified") {
      state.pendingVerificationEmail = error.meta?.email || String(form.get("email") || "");
      state.error = t("auth.email_not_verified");
    } else if (error.code === "password_mismatch") {
      state.error = t("auth.password_mismatch");
    } else if (error.code === "email_send_failed") {
      state.error = t("auth.email_send_failed");
    } else {
      state.error = error.message;
    }
  } finally {
    state.loading = false;
    render();
  }
}

async function resendVerificationEmail() {
  if (!state.pendingVerificationEmail) return;
  state.loading = true;
  state.error = "";
  state.notice = "";
  renderAuth();

  try {
    await api("/api/email/resend", {
      method: "POST",
      body: {
        email: state.pendingVerificationEmail,
        language: state.lang
      }
    });
    state.notice = t("auth.verification_resent", { email: state.pendingVerificationEmail });
  } catch (error) {
    state.error = error.code === "email_send_failed" ? t("auth.email_send_failed") : error.message;
  } finally {
    state.loading = false;
    renderAuth();
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
    state.enterDashboardAtTop = true;
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
  const progression = data.progression || { level: 1, xp: data.stats.xp || 0, progress_percent: 0, title_key: "progression.levels.spark.title" };
  const motion = dashboardMotion(data);
  const radius = 96;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - circumference * motion.reactorFrom / 100;
  const hasSmoking = data.habit_types.includes("smoking");
  const hasAlcohol = data.habit_types.includes("alcohol");
  const currency = data.money.goal.currency || "EUR";
  const missions = data.missions || [];
  const missionSummary = data.missions_summary || { completed: 0, total: missions.length, percent: 0 };

  app.innerHTML = `
    <div class="topbar">
      ${renderBrand(true)}
      <div class="top-actions">
        <button class="secondary-button journal-button notification-anchor" id="socialBtn" type="button">${icon("users")}<span>${esc(t("social.button"))}</span><b class="unread-badge" data-social-unread hidden>0</b></button>
        <button class="secondary-button journal-button" id="journalBtn" type="button">${icon("star")}<span>${esc(t("dashboard.journal_button"))}</span></button>
        <button class="icon-button notification-anchor" id="notificationBtn" type="button" aria-label="${esc(t("social.notifications"))}">${icon("bell")}<b class="unread-badge" data-social-unread hidden>0</b></button>
        <button class="profile-button" id="settingsBtn" aria-label="${esc(t("settings.title"))}" title="${esc(t("settings.title"))}">
          ${avatarMarkup(data.user.name, data.user.avatar_code, "", data.user.id, data.user.has_avatar)}
          <span class="profile-level">${esc(progression.level)}</span>
        </button>
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
              <strong id="reactorPercentValue">${Math.round(motion.reactorFrom)}%</strong>
              <span>${esc(t("dashboard.reactor"))}</span>
              ${motion.hadPrevious && percent > motion.reactorFrom ? `<span class="progress-delta">${esc(t("dashboard.progress_since_visit", { percent: percent - motion.reactorFrom }))}</span>` : ""}
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
            <span class="chip">${icon("trophy")}${esc(t("progression.level_short", { level: progression.level }))}</span>
          </div>
          <div class="mission-card">
            <div class="icon-token token-gold">${icon("star")}</div>
            <div>
              <p class="eyebrow">${esc(t("dashboard.missions_kicker"))}</p>
              <strong>${esc(t("dashboard.missions_progress", { done: missionSummary.completed, total: missionSummary.total }))}</strong>
              <p class="muted">${esc(t("dashboard.missions_text"))}</p>
            </div>
          </div>
          ${renderNextSignal(data)}
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

      ${renderGrowthPanels(data, currency, motion)}

      ${renderMissionPanel(data)}

      <section class="stat-grid">
        ${hasSmoking ? statCard("smoke", "token-red", t("dashboard.without_smoking"), duration(data.habits.smoking.hours), t("dashboard.series_days", { days: data.habits.smoking.days })) : ""}
        ${hasAlcohol ? statCard("alcohol", "token-blue", t("dashboard.without_alcohol"), duration(data.habits.alcohol.hours), t("dashboard.series_days", { days: data.habits.alcohol.days })) : ""}
        ${statCard("money", "token-green", t("dashboard.saved"), money(data.money.saved_total, currency), t("dashboard.saved_today", { amount: money(data.money.saved_today, currency) }))}
        ${statCard("trophy", "token-violet", t("dashboard.level"), t(progression.title_key), t("progression.level_xp", { level: progression.level, xp: progression.xp }))}
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

      ${renderInsightsPanel(data)}

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
    </main>
    <nav class="mobile-nav" aria-label="${esc(t("navigation.label"))}">
      <button class="active" id="mobileHome" type="button">${icon("reactor")}<span>${esc(t("navigation.home"))}</span></button>
      <button id="mobileProgress" type="button">${icon("trophy")}<span>${esc(t("navigation.progress"))}</span></button>
      <button class="notification-anchor" id="mobileSocial" type="button">${icon("users")}<span>${esc(t("navigation.social"))}</span><b class="unread-badge" data-social-unread hidden>0</b></button>
      <button id="mobileProfile" type="button">${icon("settings")}<span>${esc(t("navigation.profile"))}</span></button>
    </nav>
    <div class="social-toast-stack" id="socialToastStack" aria-live="polite"></div>`;

  if (state.enterDashboardAtTop) {
    state.enterDashboardAtTop = false;
    requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: "auto" }));
  }

  app.querySelector("#socialBtn").addEventListener("click", () => openSocialModal("feed"));
  app.querySelector("#journalBtn").addEventListener("click", openJournalModal);
  app.querySelector("#notificationBtn").addEventListener("click", () => openSocialModal("notifications"));
  app.querySelector("#settingsBtn").addEventListener("click", () => { state.screen = "settings"; state.notice = ""; render(); });
  app.querySelector("#logoutBtn").addEventListener("click", logout);
  app.querySelector("#cravingBtn").addEventListener("click", openCraving);
  app.querySelector("#shareBtn").addEventListener("click", openShareModal);
  app.querySelectorAll("[data-checkin]").forEach((button) => button.addEventListener("click", () => saveCheckin(button.dataset.checkin)));
  app.querySelectorAll("[data-incident]").forEach((button) => button.addEventListener("click", () => openIncident(button.dataset.incident)));
  app.querySelector("#mobileHome").addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
  app.querySelector("#mobileProgress").addEventListener("click", () => app.querySelector(".progression-panel")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  app.querySelector("#mobileSocial").addEventListener("click", () => openSocialModal("feed"));
  app.querySelector("#mobileProfile").addEventListener("click", () => { state.screen = "settings"; state.notice = ""; render(); });
  animateDashboardProgress(data, motion, currency);
  startSocialNotificationPolling();
  updateSocialBadges();
}

function renderNextSignal(data) {
  const nextReward = data.reactor?.next_reward;
  if (!nextReward) {
    return `
      <div class="next-signal">
        <span class="next-signal-icon">${icon("bell")}</span>
        <div><small>${esc(t("return_brief.next_signal"))}</small><strong>${esc(t("return_brief.next_complete_title"))}</strong><span>${esc(t("return_brief.next_complete_body"))}</span></div>
      </div>`;
  }

  const remainingHours = Math.max(1, Math.ceil(Number(nextReward.required_hours || 0) - Number(data.reactor.control_hours || 0)));
  return `
    <div class="next-signal">
      <span class="next-signal-icon">${icon("bell")}</span>
      <div>
        <small>${esc(t("return_brief.next_signal"))}</small>
        <strong>${esc(t("return_brief.next_title", { reward: t(nextReward.title_key) }))}</strong>
        <span>${esc(t("return_brief.next_in", { time: duration(remainingHours) }))}</span>
      </div>
    </div>`;
}

function renderGrowthPanels(data, currency, motion) {
  const moneyData = data.money || {};
  const target = moneyData.next_target;
  const progression = data.progression || {};
  const targetTitle = target
    ? (target.title_key ? t(target.title_key) : (target.title || t("dashboard.personal_goal")))
    : "";
  const targetStatus = target
    ? (target.days_remaining === null
      ? t("dashboard.money_rate_missing")
      : t("dashboard.money_eta", { days: target.days_remaining }))
    : t("dashboard.money_all_open");
  const activeSystems = Math.min(3, Math.max(1, Math.ceil(Number(progression.level || 1) / 2)));

  return `
    <section class="growth-grid">
      <section class="panel money-signal-panel">
        <div class="section-head">
          <div><p class="eyebrow">${esc(t("dashboard.money_kicker"))}</p><h3>${esc(t("dashboard.money_title"))}</h3></div>
          <span class="badge">${esc(t("dashboard.money_last_week"))}</span>
        </div>
        <div class="money-metrics">
          <div class="money-metric primary"><span>${esc(t("dashboard.money_returned"))}</span><strong id="savedTotalAnimated">${money(motion.savedFrom, currency)}</strong></div>
          <div class="money-metric"><span>${esc(t("dashboard.money_daily_rate"))}</span><strong>${money(moneyData.daily_rate, currency)}</strong></div>
          <div class="money-metric"><span>${esc(t("dashboard.money_month_projection"))}</span><strong>${money(moneyData.month_projection, currency)}</strong></div>
        </div>
        ${target ? `
          <div class="money-next">
            <div><span>${esc(t("dashboard.money_next_target"))}</span><strong>${esc(targetTitle)}</strong></div>
            <span class="money-eta">${esc(targetStatus)}</span>
          </div>
          <div class="progress-bar"><div class="progress-fill" style="width:${Number(target.progress_percent || 0)}%"></div></div>
          <p class="muted">${esc(t("dashboard.money_target_remaining", { amount: money(target.remaining, currency) }))}</p>` : `
          <div class="money-next complete"><strong>${esc(targetStatus)}</strong></div>`}
      </section>

      <section class="panel progression-panel">
        <div class="section-head">
          <div><p class="eyebrow">${esc(t("progression.kicker"))}</p><h3>${esc(t("progression.title"))}</h3></div>
          <span class="level-badge">${esc(t("progression.level_short", { level: progression.level }))}</span>
        </div>
        <div class="progression-layout">
          <div class="recovery-system" aria-label="${esc(t("progression.systems_label"))}">
            ${recoveryNode("brain", "progression.brain", activeSystems >= 1)}
            ${recoveryNode("lungs", "progression.breath", activeSystems >= 2)}
            ${recoveryNode("heart", "progression.heart", activeSystems >= 3)}
          </div>
          <div class="level-copy">
            <strong>${esc(t(progression.title_key))}</strong>
            <p>${esc(t(progression.body_key))}</p>
            <div class="xp-row"><span id="xpValueAnimated">${esc(t("progression.xp_value", { xp: Math.round(motion.xpFrom) }))}</span><span>${esc(progression.max_level ? t("progression.max_level") : t("progression.xp_to_next", { xp: progression.remaining_xp }))}</span></div>
            <div class="progress-bar xp-progress"><div class="progress-fill" id="xpProgressAnimated" style="width:${motion.xpPercentFrom}%"></div></div>
          </div>
        </div>
      </section>
    </section>`;
}

function recoveryNode(iconName, labelKey, active) {
  return `<div class="recovery-node ${active ? "active" : ""}"><span>${icon(iconName)}</span><small>${esc(t(labelKey))}</small></div>`;
}

function renderMissionPanel(data) {
  const missions = data.missions || [];
  const summary = data.missions_summary || { completed: 0, total: missions.length, percent: 0 };
  if (!missions.length) return "";

  return `
    <section class="panel mission-panel">
      <div class="section-head">
        <div><p class="eyebrow">${esc(t("dashboard.missions_kicker"))}</p><h3>${esc(t("dashboard.missions_title"))}</h3></div>
        <span class="badge">${esc(t("dashboard.missions_progress", { done: summary.completed, total: summary.total }))}</span>
      </div>
      <div class="mission-progress">
        <div class="progress-bar"><div class="progress-fill" style="width:${Number(summary.percent || 0)}%"></div></div>
      </div>
      <div class="mission-list">
        ${missions.map(renderMissionItem).join("")}
      </div>
    </section>`;
}

function renderMissionItem(mission) {
  const completed = Boolean(mission.completed);
  const reward = Number(mission.reward_xp || 0) > 0
    ? t(mission.reward_key, { xp: mission.reward_xp })
    : t(mission.reward_key);

  return `
    <article class="daily-mission ${completed ? "completed" : ""}">
      <div class="mission-check">${completed ? icon("shield") : icon(mission.icon || "star")}</div>
      <div>
        <strong>${esc(t(mission.title_key))}</strong>
        <span>${esc(t(mission.body_key))}</span>
      </div>
      <div class="mission-meta">
        <span class="mission-reward">${esc(reward)}</span>
        <small>${esc(t(completed ? "dashboard.mission_done" : "dashboard.mission_open"))}</small>
      </div>
    </article>`;
}

function renderInsightsPanel(data) {
  const map = data.trigger_map || {};
  const report = data.weekly_report || {};
  const topReasons = map.top_reasons || [];
  const topTrigger = map.top_trigger || t("dashboard.trigger_none");
  const dangerHour = map.danger_hour || t("dashboard.trigger_no_hour");
  const focus = t(report.focus_key || "dashboard.weekly_focus_start", { trigger: report.focus_trigger || t("dashboard.trigger_none") });

  return `
    <section class="two-column insights-grid">
      <section class="panel">
        <div class="section-head">
          <div><p class="eyebrow">${esc(t("dashboard.trigger_kicker"))}</p><h3>${esc(t("dashboard.trigger_title"))}</h3></div>
          <span class="badge">${esc(t("dashboard.trigger_events", { count: map.events || 0 }))}</span>
        </div>
        <div class="insight-metrics">
          <div class="insight-card"><span>${esc(t("dashboard.trigger_top"))}</span><strong>${esc(topTrigger)}</strong></div>
          <div class="insight-card"><span>${esc(t("dashboard.trigger_hour"))}</span><strong>${esc(dangerHour)}</strong></div>
        </div>
        <div class="trigger-bars">
          ${topReasons.length ? topReasons.map(renderTriggerReason).join("") : `<p class="muted">${esc(t("dashboard.trigger_empty"))}</p>`}
        </div>
      </section>
      <section class="panel">
        <div class="section-head">
          <div><p class="eyebrow">${esc(t("dashboard.weekly_kicker"))}</p><h3>${esc(t("dashboard.weekly_title"))}</h3></div>
          <span class="badge">${esc(t("dashboard.weekly_period", { days: report.period_days || 7 }))}</span>
        </div>
        <div class="weekly-grid">
          <div><span>${esc(t("dashboard.weekly_wins"))}</span><strong>${esc(report.craving_wins || 0)}</strong></div>
          <div><span>${esc(t("dashboard.weekly_incidents"))}</span><strong>${esc(report.incidents || 0)}</strong></div>
          <div><span>${esc(t("dashboard.weekly_checkins"))}</span><strong>${esc(report.clean_checkins || 0)}</strong></div>
        </div>
        <div class="focus-box">
          <span>${esc(t("dashboard.weekly_focus"))}</span>
          <p>${esc(focus)}</p>
        </div>
      </section>
    </section>`;
}

function renderTriggerReason(reason) {
  return `
    <div class="trigger-row">
      <div>
        <strong>${esc(reason.label)}</strong>
        <span>${esc(t("dashboard.trigger_count", { count: reason.count }))}</span>
      </div>
      <div class="bar-track"><div style="width:${Number(reason.percent || 0)}%"></div></div>
    </div>`;
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

function openJournalModal() {
  const logs = state.dashboard?.logs || [];
  modalRoot.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true">
      <div class="modal-card journal-modal">
        <button class="icon-button close-button" id="closeModal">${icon("x")}</button>
        <p class="eyebrow">${esc(t("dashboard.logs_kicker"))}</p>
        <h2>${esc(t("dashboard.logs_title"))}</h2>
        <div class="log-list journal-list">
          ${logs.length ? logs.map(renderLog).join("") : `<p class="muted">${esc(t("dashboard.empty_logs"))}</p>`}
        </div>
      </div>
    </div>`;
  modalRoot.querySelector("#closeModal").addEventListener("click", closeModal);
}

async function openSocialModal(view = "feed") {
  state.social.view = view;
  state.social.notice = "";
  modalRoot.innerHTML = socialShell(true);
  modalRoot.querySelector("#closeModal").addEventListener("click", closeModal);

  try {
    const data = await api("/api/social");
    state.social.data = data;
    state.social.unreadCount = Number(data.unread_count || 0);
    updateSocialBadges();
  } catch (error) {
    state.social.notice = error.message;
  }

  renderSocialModal();
}

function socialShell(loading = false) {
  return `
    <div class="modal" role="dialog" aria-modal="true">
      <div class="modal-card social-modal">
        <button class="icon-button close-button" id="closeModal">${icon("x")}</button>
        <p class="eyebrow">${esc(t("social.kicker"))}</p>
        <h2>${esc(t("social.title"))}</h2>
        <p class="muted">${esc(t("social.subtitle"))}</p>
        ${loading ? `<div class="social-loading">${esc(t("social.loading"))}</div>` : `<div id="socialContent"></div>`}
      </div>
    </div>`;
}

function renderSocialModal() {
  modalRoot.innerHTML = socialShell(false);
  const content = modalRoot.querySelector("#socialContent");
  const data = state.social.data || { feed: [], following: [], followers: [], notifications: [], unread_count: state.social.unreadCount };
  content.innerHTML = `
    <div class="social-tabs" role="tablist">
      ${socialTab("feed", t("social.feed"), data.feed?.length || 0)}
      ${socialTab("search", t("social.search"), "")}
      ${socialTab("invite", t("social.invite"), "")}
      ${socialTab("friends", t("social.friends"), data.following?.length || 0)}
      ${socialTab("notifications", t("social.notifications"), data.unread_count || 0)}
    </div>
    ${state.social.notice ? `<div class="alert">${esc(state.social.notice)}</div>` : ""}
    ${state.social.view === "feed" ? renderSocialFeed(data.feed || []) : ""}
    ${state.social.view === "search" ? renderSocialSearch() : ""}
    ${state.social.view === "invite" ? renderSocialInvite() : ""}
    ${state.social.view === "friends" ? renderSocialFriends(data) : ""}
    ${state.social.view === "notifications" ? renderSocialNotifications(data.notifications || [], data.unread_count || 0) : ""}
  `;

  attachSocialEvents();
}

function socialTab(view, label, count) {
  return `
    <button class="${state.social.view === view ? "active" : ""}" data-social-view="${esc(view)}" type="button">
      <span>${esc(label)}</span>${count !== "" ? `<strong>${esc(count)}</strong>` : ""}
    </button>`;
}

function renderSocialFeed(feed) {
  return `
    <div class="social-feed">
      ${feed.length ? feed.map(renderSocialEvent).join("") : `
        <div class="empty-social">
          <strong>${esc(t("social.empty_feed_title"))}</strong>
          <span>${esc(t("social.empty_feed_body"))}</span>
        </div>`}
    </div>`;
}

function renderSocialEvent(event) {
  return `
    <article class="social-event">
      ${avatarMarkup(event.user?.name || "?", event.user?.avatar_code, "social-avatar", event.user?.id, event.user?.has_avatar)}
      <div class="social-event-main">
        <div class="social-event-head">
          <div>
            <strong>${esc(event.user?.name || t("social.friend"))}</strong>
            <span>${esc(dateTime(event.created_at))}</span>
          </div>
          <span class="badge">${esc(t(event.title_key))}</span>
        </div>
        ${socialEventBody(event) ? `<p>${esc(socialEventBody(event))}</p>` : ""}
        <div class="social-actions">
          <button class="secondary-button compact-action ${event.liked_by_me ? "liked" : ""}" data-like-log="${esc(event.id)}" type="button">
            ${icon("heart")}${esc(t(event.liked_by_me ? "social.liked" : "social.like"))} · ${esc(event.likes_count || 0)}
          </button>
          <span class="support-count">${icon("message")}${esc(t("social.supports_count", { count: event.supports_count || 0 }))}</span>
        </div>
        <div class="support-row">
          <input data-support-input="${esc(event.id)}" maxlength="300" placeholder="${esc(t("social.support_placeholder"))}">
          <button class="primary-button compact-action" data-support-log="${esc(event.id)}" type="button">${esc(t("social.send_support"))}</button>
        </div>
      </div>
    </article>`;
}

function renderSocialSearch() {
  return `
    <form id="socialSearchForm" class="social-search">
      <label>${esc(t("social.search_label"))}<input id="socialSearchInput" value="${esc(state.social.query)}" placeholder="${esc(t("social.search_placeholder"))}"></label>
      <button class="primary-button" type="submit">${icon("search")}${esc(t("social.search_button"))}</button>
    </form>
    <div class="people-list">
      ${state.social.results.length ? state.social.results.map(renderPersonCard).join("") : `<p class="muted">${esc(t("social.search_empty"))}</p>`}
    </div>`;
}

function renderSocialInvite() {
  return `
    <form id="inviteFriendForm" class="invite-form">
      <div class="invite-card">
        <div class="icon-token token-green">${icon("message")}</div>
        <div>
          <strong>${esc(t("social.invite_title"))}</strong>
          <span>${esc(t("social.invite_body"))}</span>
        </div>
      </div>
      <div class="settings-grid">
        <label>${esc(t("social.invite_email"))}<input name="email" type="email" required value="${esc(state.social.invite.email)}" placeholder="${esc(t("social.invite_email_placeholder"))}"></label>
        <label>${esc(t("social.invite_name"))}<input name="name" value="${esc(state.social.invite.name)}" placeholder="${esc(t("social.invite_name_placeholder"))}"></label>
      </div>
      <label>${esc(t("social.invite_message"))}<textarea name="message" maxlength="300" rows="3" placeholder="${esc(t("social.invite_message_placeholder"))}">${esc(state.social.invite.message)}</textarea></label>
      <button class="primary-button full" type="submit">${icon("message")}${esc(t("social.invite_send"))}</button>
    </form>`;
}

function renderSocialFriends(data) {
  const following = data.following || [];
  const followers = data.followers || [];

  return `
    <div class="friends-grid">
      <section>
        <h3>${esc(t("social.following"))}</h3>
        <div class="people-list">
          ${following.length ? following.map((person) => renderPersonCard(person, true)).join("") : `<p class="muted">${esc(t("social.no_following"))}</p>`}
        </div>
      </section>
      <section>
        <h3>${esc(t("social.followers"))}</h3>
        <div class="people-list">
          ${followers.length ? followers.map(renderPersonCard).join("") : `<p class="muted">${esc(t("social.no_followers"))}</p>`}
        </div>
      </section>
    </div>`;
}

function renderPersonCard(person, forceFollowing = false) {
  const isFollowing = forceFollowing || Boolean(person.is_following);
  return `
    <article class="person-card">
      ${avatarMarkup(person.name || "?", person.avatar_code, "social-avatar", person.id, person.has_avatar)}
      <div>
        <strong>${esc(person.name)}</strong>
        <span>${esc(person.email)}</span>
      </div>
      <button class="${isFollowing ? "secondary-button" : "primary-button"} compact-action" data-${isFollowing ? "unfollow" : "follow"}-id="${esc(person.id)}" type="button">
        ${esc(t(isFollowing ? "social.unfollow" : "social.follow"))}
      </button>
    </article>`;
}

function renderSocialNotifications(notifications, unreadCount) {
  return `
    <div class="notification-permission">
      <div><strong>${esc(t("social.browser_notifications_title"))}</strong><span>${esc(t("social.browser_notifications_body"))}</span></div>
      ${notificationPermissionMarkup()}
    </div>
    <div class="notification-head">
      <span>${esc(t("social.unread_count", { count: unreadCount }))}</span>
      <button class="secondary-button compact-action" id="markSocialRead" type="button">${esc(t("social.mark_read"))}</button>
    </div>
    <div class="notification-list">
      ${notifications.length ? notifications.map(renderSocialNotification).join("") : `<p class="muted">${esc(t("social.no_notifications"))}</p>`}
    </div>`;
}

function renderSocialNotification(notification) {
  return `
    <article class="notification-card ${notification.read ? "" : "unread"}">
      ${avatarMarkup(notification.actor?.name || "?", notification.actor?.avatar_code, "social-avatar", notification.actor?.id, notification.actor?.has_avatar)}
      <div>
        <strong>${esc(socialNotificationTitle(notification))}</strong>
        ${notification.body ? `<p>${esc(notification.body)}</p>` : ""}
        <span>${esc(dateTime(notification.created_at))}</span>
      </div>
    </article>`;
}

function attachSocialEvents() {
  modalRoot.querySelector("#closeModal").addEventListener("click", closeModal);
  modalRoot.querySelectorAll("[data-social-view]").forEach((button) => {
    button.addEventListener("click", () => {
      state.social.view = button.dataset.socialView;
      state.social.notice = "";
      renderSocialModal();
    });
  });
  modalRoot.querySelector("#socialSearchForm")?.addEventListener("submit", searchSocialPeople);
  modalRoot.querySelector("#inviteFriendForm")?.addEventListener("submit", sendSocialInvite);
  modalRoot.querySelectorAll("[data-follow-id]").forEach((button) => button.addEventListener("click", () => followSocialUser(Number(button.dataset.followId))));
  modalRoot.querySelectorAll("[data-unfollow-id]").forEach((button) => button.addEventListener("click", () => unfollowSocialUser(Number(button.dataset.unfollowId))));
  modalRoot.querySelectorAll("[data-like-log]").forEach((button) => button.addEventListener("click", () => likeSocialEvent(Number(button.dataset.likeLog))));
  modalRoot.querySelectorAll("[data-support-log]").forEach((button) => button.addEventListener("click", () => sendSocialSupport(Number(button.dataset.supportLog))));
  modalRoot.querySelector("#markSocialRead")?.addEventListener("click", markSocialNotificationsRead);
  modalRoot.querySelector("#enableBrowserNotifications")?.addEventListener("click", enableBrowserNotifications);
}

async function searchSocialPeople(event) {
  event.preventDefault();
  const input = modalRoot.querySelector("#socialSearchInput");
  state.social.query = String(input?.value || "").trim();
  state.social.notice = "";

  try {
    const data = await api(`/api/social/search?q=${encodeURIComponent(state.social.query)}`);
    state.social.results = data.results || [];
  } catch (error) {
    state.social.notice = error.message;
  }

  renderSocialModal();
}

async function sendSocialInvite(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  state.social.invite = {
    email: String(form.get("email") || "").trim(),
    name: String(form.get("name") || "").trim(),
    message: String(form.get("message") || "").trim()
  };
  state.social.notice = "";

  try {
    const data = await api("/api/social/invite", { method: "POST", body: state.social.invite });
    state.social.data = data;
    state.social.notice = t("social.invite_sent");
    state.social.invite = { email: "", name: "", message: "" };
  } catch (error) {
    state.social.notice = error.code === "invite_email_failed" ? t("social.invite_failed") : error.message;
  }

  renderSocialModal();
}

async function followSocialUser(userId) {
  const data = await api("/api/social/follow", { method: "POST", body: { user_id: userId } });
  state.social.data = data;
  state.social.results = state.social.results.map((person) => person.id === userId ? { ...person, is_following: true } : person);
  state.social.notice = t("social.followed");
  renderSocialModal();
}

async function unfollowSocialUser(userId) {
  const data = await api("/api/social/unfollow", { method: "POST", body: { user_id: userId } });
  state.social.data = data;
  state.social.results = state.social.results.map((person) => person.id === userId ? { ...person, is_following: false } : person);
  state.social.notice = t("social.unfollowed");
  renderSocialModal();
}

async function likeSocialEvent(logId) {
  const data = await api("/api/social/like", { method: "POST", body: { log_id: logId } });
  state.social.data = data;
  renderSocialModal();
}

async function sendSocialSupport(logId) {
  const input = modalRoot.querySelector(`[data-support-input="${logId}"]`);
  const message = String(input?.value || "").trim();
  if (!message) return;

  const data = await api("/api/social/support", { method: "POST", body: { log_id: logId, message } });
  state.social.data = data;
  state.social.notice = t("social.support_sent");
  renderSocialModal();
}

async function markSocialNotificationsRead() {
  const data = await api("/api/social/notifications/read", { method: "POST", body: {} });
  state.social.data = data;
  state.social.unreadCount = Number(data.unread_count || 0);
  updateSocialBadges();
  renderSocialModal();
}

function socialEventBody(event) {
  if (!event.body) return "";
  return readPath(state.messages, event.body) ? t(event.body) : event.body;
}

function socialNotificationTitle(notification) {
  const name = notification.actor?.name || t("social.friend");
  if (notification.type === "follow") return t("social.notice_follow", { name });
  if (notification.type === "like") return t("social.notice_like", { name });
  if (notification.type === "support") return t("social.notice_support", { name });
  return t("social.notice_generic", { name });
}

function initials(name) {
  return String(name || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] || "")
    .join("")
    .toUpperCase() || "?";
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
      ${state.notice ? `<div class="alert success">${esc(state.notice)}</div>` : ""}
      <form id="settingsForm" class="form-grid">
        <div class="settings-section">
          <h3>${esc(t("settings.account"))}</h3>
          <div class="profile-photo-editor">
            <div id="profilePhotoPreview">
              ${avatarMarkup(data.user.name, data.user.avatar_code, "profile-photo-preview", data.user.id, data.user.has_avatar)}
            </div>
            <div class="profile-photo-copy">
              <strong>${esc(t("settings.photo_title"))}</strong>
              <span>${esc(t("settings.photo_help"))}</span>
              <div class="profile-photo-actions">
                <label class="secondary-button photo-file-button">
                  ${icon("camera")}<span>${esc(t("settings.photo_choose"))}</span>
                  <input id="avatarFileInput" type="file" accept="image/jpeg,image/png,image/webp">
                </label>
                <button class="primary-button" id="uploadAvatarBtn" type="button" disabled>${esc(t("settings.photo_upload"))}</button>
                ${data.user.has_avatar ? `<button class="danger-button" id="deleteAvatarBtn" type="button">${esc(t("settings.photo_delete"))}</button>` : ""}
              </div>
              <small id="photoStatus" class="muted"></small>
            </div>
          </div>
          <fieldset class="avatar-picker">
            <legend>${esc(t("settings.avatar_fallback"))}</legend>
            <div class="avatar-options">
              ${AVATAR_CODES.map((code) => `
                <label class="avatar-option">
                  <input type="radio" name="avatar_code" value="${code}" ${(data.user.avatar_code || "pulse") === code ? "checked" : ""}>
                  ${avatarMarkup(data.user.name, code)}
                  <span>${esc(t(`avatars.${code}`))}</span>
                </label>`).join("")}
            </div>
          </fieldset>
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
  app.querySelector("#avatarFileInput").addEventListener("change", previewProfilePhoto);
  app.querySelector("#uploadAvatarBtn").addEventListener("click", uploadProfilePhoto);
  app.querySelector("#deleteAvatarBtn")?.addEventListener("click", deleteProfilePhoto);
}

function previewProfilePhoto(event) {
  const file = event.currentTarget.files?.[0];
  const status = app.querySelector("#photoStatus");
  const uploadButton = app.querySelector("#uploadAvatarBtn");
  const preview = app.querySelector("#profilePhotoPreview");
  if (!file || !status || !uploadButton || !preview) return;

  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    event.currentTarget.value = "";
    status.textContent = t("errors.avatar_invalid");
    uploadButton.disabled = true;
    return;
  }
  if (file.size > 4 * 1024 * 1024) {
    event.currentTarget.value = "";
    status.textContent = t("errors.avatar_too_large");
    uploadButton.disabled = true;
    return;
  }

  if (state.photoPreviewUrl) URL.revokeObjectURL(state.photoPreviewUrl);
  state.photoPreviewUrl = URL.createObjectURL(file);
  preview.innerHTML = `<span class="user-avatar has-photo profile-photo-preview" aria-hidden="true"><img src="${esc(state.photoPreviewUrl)}" alt=""></span>`;
  status.textContent = `${file.name} · ${Math.max(1, Math.round(file.size / 1024))} KB`;
  uploadButton.disabled = false;
}

async function uploadProfilePhoto() {
  const input = app.querySelector("#avatarFileInput");
  const button = app.querySelector("#uploadAvatarBtn");
  const file = input?.files?.[0];
  if (!file || !button) return;

  button.disabled = true;
  button.textContent = t("settings.photo_uploading");
  const form = new FormData();
  form.append("avatar", file);

  try {
    const data = await apiForm("/api/profile/avatar", form);
    if (state.photoPreviewUrl) URL.revokeObjectURL(state.photoPreviewUrl);
    state.photoPreviewUrl = null;
    state.dashboard = data.dashboard;
    state.user = data.dashboard.user;
    state.error = "";
    state.notice = t("settings.photo_saved");
  } catch (error) {
    const translated = readPath(state.messages, `errors.${error.code}`);
    state.error = typeof translated === "string" ? translated : error.message;
  }
  renderSettings();
}

async function deleteProfilePhoto() {
  if (!window.confirm(t("settings.photo_delete_confirm"))) return;

  try {
    const data = await api("/api/profile/avatar/delete", { method: "POST", body: {} });
    state.dashboard = data.dashboard;
    state.user = data.dashboard.user;
    state.error = "";
    state.notice = t("settings.photo_deleted");
  } catch (error) {
    state.error = error.message;
  }
  renderSettings();
}

async function saveSettings(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const body = {
    name: String(form.get("name") || ""),
    avatar_code: String(form.get("avatar_code") || "pulse"),
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
    state.enterDashboardAtTop = true;
    state.notice = t("settings.saved");
  } catch (error) {
    state.error = error.message;
  }
  render();
}

async function logout() {
  stopSocialNotificationPolling();
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
  state.social.unreadCount = 0;
  render();
}

async function openCraving() {
  const habitType = state.dashboard?.habit_types?.[0] || null;
  state.craving = { id: null, timer: null, seconds: 90, totalSeconds: 90, reason: "", action: "", tool: "", toolBody: "", habitType };
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
    updateCravingTimerDisplay();
    if (state.craving.seconds <= 0) clearInterval(state.craving.timer);
  }, 1000);
}

function formatTimer(seconds) {
  const min = String(Math.floor(seconds / 60)).padStart(2, "0");
  const sec = String(seconds % 60).padStart(2, "0");
  return `${min}:${sec}`;
}

function cravingHealthPercent() {
  const total = Number(state.craving.totalSeconds || 90);
  return Math.max(0, Math.min(100, Math.round((Number(state.craving.seconds || 0) / total) * 100)));
}

function cravingWaveKey(percent) {
  if (percent > 66) return "craving.wave_peak";
  if (percent > 25) return "craving.wave_falling";
  return "craving.wave_control";
}

function updateCravingTimerDisplay() {
  const health = cravingHealthPercent();
  const timer = modalRoot.querySelector("#timerText");
  const bossFill = modalRoot.querySelector("#bossFill");
  const healthText = modalRoot.querySelector("#cravingHealth");
  const waveText = modalRoot.querySelector("#waveText");

  if (timer) timer.textContent = formatTimer(state.craving.seconds);
  if (bossFill) bossFill.style.width = `${health}%`;
  if (healthText) healthText.textContent = `${health}%`;
  if (waveText) waveText.textContent = t(cravingWaveKey(health));
}

function cravingSupportText() {
  return t("craving.support_message", { name: state.dashboard?.user?.name || t("app.name") });
}

function renderCravingModal(phase) {
  const reasons = list("craving.reasons");
  const tools = list("craving.tools");
  const health = cravingHealthPercent();
  state.craving.phase = phase;
  modalRoot.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true">
      <div class="modal-card">
        <button class="icon-button close-button" id="closeModal">${icon("x")}</button>
        <p class="eyebrow">${esc(t("craving.kicker"))}</p>
        <h2>${esc(t("craving.title"))}</h2>
        <p class="muted">${esc(t("craving.subtitle"))}</p>
        <div class="craving-boss">
          <div class="boss-head"><span>${icon("bolt")}${esc(t("craving.boss"))}</span><strong id="cravingHealth">${health}%</strong></div>
          <div class="boss-health"><div id="bossFill" style="width:${health}%"></div></div>
          <small id="waveText">${esc(t(cravingWaveKey(health)))}</small>
        </div>
        <div class="timer-block"><div class="timer-ring"><div class="timer-ring-inner"><strong id="timerText">${formatTimer(state.craving.seconds)}</strong><span>${esc(t("craving.timer_label"))}</span></div></div></div>
        ${phase === "reason" ? `
          <h3>${esc(t("craving.reason_title"))}</h3>
          <div class="pill-grid">${reasons.map((reason) => `<button class="pill" type="button" data-reason="${esc(reason)}">${esc(reason)}</button>`).join("")}</div>
          <h3>${esc(t("craving.tools_title"))}</h3>
          <div class="craving-tool-grid">
            ${tools.map((tool, index) => `
              <button class="craving-tool ${state.craving.tool === tool.title ? "selected" : ""}" type="button" data-tool-index="${index}">
                <strong>${esc(tool.title)}</strong>
                <span>${esc(tool.body)}</span>
              </button>`).join("")}
          </div>
        ` : `
          <h3>${esc(t("craving.action_title"))}</h3>
          <p class="rescue-action">${esc(state.craving.action)}</p>
          <div class="support-box">
            <strong>${esc(t("craving.support_title"))}</strong>
            <p>${esc(cravingSupportText())}</p>
            <button class="secondary-button full" id="copySupport" type="button">${esc(t("craving.copy_support"))}</button>
          </div>
          <button class="primary-button full" id="completeCraving">${esc(t("craving.complete"))}</button>
        `}
      </div>
    </div>`;

  modalRoot.querySelector("#closeModal").addEventListener("click", closeModal);
  modalRoot.querySelectorAll("[data-tool-index]").forEach((button) => {
    button.addEventListener("click", () => {
      const tool = tools[Number(button.dataset.toolIndex)] || {};
      state.craving.tool = tool.title || "";
      state.craving.toolBody = tool.body || "";
      renderCravingModal("reason");
    });
  });
  modalRoot.querySelectorAll("[data-reason]").forEach((button) => {
    button.addEventListener("click", () => {
      state.craving.reason = button.dataset.reason;
      const actions = list("craving.actions");
      const action = actions[Math.floor(Math.random() * actions.length)] || "";
      state.craving.action = state.craving.tool ? `${state.craving.tool}: ${action}` : action;
      renderCravingModal("action");
    });
  });
  modalRoot.querySelector("#copySupport")?.addEventListener("click", async (event) => {
    try {
      await navigator.clipboard.writeText(cravingSupportText());
      event.currentTarget.textContent = t("craving.copied");
    } catch {
      event.currentTarget.textContent = t("craving.copy_failed");
    }
  });
  modalRoot.querySelector("#completeCraving")?.addEventListener("click", completeCraving);
  updateCravingTimerDisplay();
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

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && state.user?.id) void pollSocialNotifications();
});

init();
