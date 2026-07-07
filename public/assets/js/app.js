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
    recovery_mode: "quit_now",
    main_reason: "",
    motivation_reasons: [],
    custom_reason: "",
    goal_title: "",
    goal_amount: 300,
    currency: "EUR",
    smoking_product: "tobacco",
    cigarettes_per_day: 20,
    cigarettes_per_pack: 20,
    pack_price: 8.5,
    vape_weekly_spend: 35,
    first_cigarette_after_wake: "31_60",
    hard_in_forbidden_places: false,
    most_important_cigarette: "stress",
    smokes_when_ill: false,
    alcohol_weekly_spend: 30,
    alcohol_frequency: "weekly",
    alcohol_amount_typical: "moderate",
    alcohol_binges: false,
    alcohol_failed_to_reduce: false,
    alcohol_withdrawal: {
      tremor: false,
      sweating: false,
      anxiety: false,
      insomnia: false,
      palpitations: false
    },
    alcohol_drinks_alone: false,
    alcohol_contexts: [],
    dangerous_days: []
  },
  craving: {
    id: null,
    timer: null,
    seconds: 90,
    totalSeconds: 90,
    reason: "",
    action: "",
    tool: "",
    toolBody: "",
    habitType: null,
    initialIntensity: 7,
    afterIntensity: 5,
    completedCycles: 0
  }
};

let socialPollTimer = null;
let socialPollBusy = false;
let socialPollingUserId = null;
let impulseTimer = null;
let chainTimer = null;
let noticeTimer = null;
const RETURN_BRIEF_MIN_MS = 4 * 60 * 60 * 1000;

const apiPath = (path) => `${boot.basePath || ""}${path}`;
const icon = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><use href="#i-${name}"></use></svg>`;
const AVATAR_CODES = ["pulse", "nova", "focus", "mint", "ember", "orbit"];
const esc = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

const FALLBACK_COPY = {
  ru: {
    health_visual: {
      open_system: "Открыть протокол",
      support_progress: "контур поддержки",
      system_modal_kicker: "Функция контура",
      system_done: "Сделал один шаг",
      system_notice: "Шаг восстановления зафиксирован.",
      system_actions: {
        brain: ["Запиши один триггер, который сегодня может включить тягу.", "Дай себе правило: сначала 5 минут паузы, потом решение.", "Убери один раздражитель: чат, место или предмет."],
        lungs: ["Сделай 10 медленных вдохов с длинным выдохом.", "Пройди 300 шагов без телефона.", "Открой окно или выйди на воздух на 3 минуты."],
        heart: ["Выпей воды и замедли темп на 2 минуты.", "Сделай короткую прогулку вместо старого ритуала.", "Отметь, что сегодня сердце не получает лишнюю нагрузку."],
        detox: ["Выбери один простой прием пищи без перегруза.", "Замени старую покупку на воду, чай или полезный перекус.", "Не спорь с тягой: дай телу спокойный вечер."],
        immunity: ["Сделай ранний сигнал сна: приглуши экран.", "Подготовь безопасный напиток заранее.", "Похвали себя за возвращение в строй, а не за идеальность."],
        sleep: ["За 30 минут до сна убери алкогольный/никотиновый сценарий.", "Запиши одну фразу: завтра будет легче, если сегодня я не продолжу.", "Сделай короткий ритуал завершения дня."],
        fallback: ["Сделай один маленький шаг без героизма.", "Отметь текущую тягу по шкале 1-10.", "Верни тело в спокойный режим: вода, воздух, пауза."]
      }
    },
    recovery_assistant: {
      reduction_kicker: "Режим движения",
      reduction_mode_quit_now: "сразу",
      reduction_mode_reduce: "снижение",
      reduction_mode_observe: "наблюдение",
      reduction_quit_title: "Чистая линия на сегодня",
      reduction_quit_body: "Главная задача проста: не торговаться с привычкой сегодня. Не на всю жизнь, только на текущий день.",
      reduction_quit_next: "Следующий шаг - заранее включить SOS, если тяга станет громкой.",
      reduction_quit_step_1: "Сегодня 0",
      reduction_quit_step_2: "SOS до действия",
      reduction_quit_step_3: "Вечер без цепочки",
      reduction_smoking_title: "План снижения сигарет",
      reduction_smoking_body: "Если резко пока тяжело, приложение держит коридор снижения. Цель - не идеальность, а управляемое движение к нулю.",
      reduction_vape_title: "План снижения электронок",
      reduction_vape_body: "Для электронных сигарет считаем не пачки, а дневной лимит по тратам/использованию. Каждая неделя сжимает коридор.",
      reduction_alcohol_title: "Мягкий план снижения алкоголя",
      reduction_alcohol_body: "При низком риске можно снижать сумму и количество алкогольных дней. При признаках зависимости резкий отказ лучше согласовать с врачом.",
      reduction_alcohol_medical_title: "Нужен безопасный план с врачом",
      reduction_alcohol_medical_body: "Есть признаки риска. Приложение не будет строить агрессивное снижение алкоголя без медицинской поддержки.",
      reduction_alcohol_medical_next: "Следующий шаг - обсудить план с Hausarzt или Suchtberatung.",
      reduction_alcohol_medical_steps: ["Не бросать резко без врача", "Записать симптомы", "Подготовить безопасный вечер"],
      reduction_observe_title: "Наблюдение без давления",
      reduction_observe_body: "Пока ты готовишься, приложение собирает триггеры и помогает построить момент, когда бросить будет легче.",
      reduction_observe_value: "3",
      reduction_observe_unit: "сигнала",
      reduction_observe_next: "Сегодня достаточно заметить тягу, место и время.",
      reduction_observe_steps: ["Отметить тягу", "Записать триггер", "Выбрать дату старта"],
      reduction_cigarette_unit: "сигарет максимум",
      reduction_vape_unit: "лимит сегодня",
      reduction_alcohol_unit: "лимит сегодня",
      reduction_safe: "безопасно",
      reduction_next_cigarettes: "Через неделю цель снизится до {count}.",
      reduction_next_budget: "Следующая цель - до {amount} в день.",
      reduction_week_cigarettes: "Неделя {week}: максимум {count}",
      reduction_week_budget: "Неделя {week}: до {amount}/день",
      chain_stop_title: "Остановить цепочку",
      chain_active_badge: "3 часа защиты",
      chain_stop_smoking: "Ты закурил. Теперь главная цель - не продолжить.",
      chain_stop_vape: "Ты использовал электронку. Теперь главная цель - не продолжить.",
      chain_stop_alcohol: "Ты выпил. Теперь главная цель - не продолжить.",
      chain_stop_body: "Следующие 3 часа защищаем реактор. Режим активен до {until}.",
      chain_action_pledge: "больше сегодня не продолжаю",
      chain_action_smoking_pledge: "больше сегодня не курю",
      chain_action_vape_pledge: "больше сегодня без электронки",
      chain_action_alcohol_pledge: "больше сегодня не пью",
      chain_action_dispose: "убрать остаток",
      chain_action_smoking_dispose: "выкинуть остаток",
      chain_action_vape_dispose: "убрать устройство",
      chain_action_alcohol_dispose: "убрать алкоголь",
      chain_action_water: "выпить воды",
      chain_action_leave: "выйти из ситуации",
      chain_action_timer: "10-минутный таймер",
      chain_action_saved: "Цепочка остановлена одним защитным шагом.",
      chain_timer_title: "10 минут без продолжения",
      chain_timer_body: "Сейчас говорит тяга. Дай ей пройти одну волну, потом решишь спокойнее.",
      chain_timer_label: "защищаем реактор",
      chain_timer_finish: "Я удержал паузу",
      chain_timer_done: "Пауза удержана. Цепочка стала слабее."
    },
    mentor: {
      kicker: "Наставник Реактора",
      title: "Короткая помощь без морали",
      subtitle: "Выбери ситуацию, и наставник даст план на ближайшие минуты.",
      signal_empty: "Пока нет check-in. Можно начать с короткой оценки состояния.",
      signal_checkin: "Последний сигнал: стресс {stress}/10, тяга {craving}/10.",
      default_reason: "свободы и контроля",
      no_recent_incident: "недавно инцидентов не было",
      open_sos: "Открыть SOS",
      open_checkin: "Check-in",
      topics: {
        craving: "Объяснить тягу",
        incident: "Разобрать срыв",
        evening: "План на вечер",
        refusal: "Фраза отказа",
        anxiety: "Помочь с тревогой",
        goal: "Напомнить цель"
      },
      responses: {
        craving: { title: "Сейчас говорит не ты, а тяга", body: "Тяга пытается сократить мир до одного действия. Дай мне 5 минут: вода, воздух, пауза. Потом решишь.", steps: ["Назови тягу вслух", "Выпей воды", "Запусти SOS или выйди из места"] },
        incident: { title: "Инцидент - это данные, не приговор", body: "Последний эпизод: {time}. Главная задача сейчас - не продолжить цепочку и понять первый триггер.", steps: ["Остановить продолжение", "Записать что было до эпизода", "Выбрать один защитный шаг на вечер"] },
        evening: { title: "Вечер нужен с планом", body: "Сегодня не надо побеждать всю жизнь. Нужно закрыть ближайшие часы так, чтобы завтра было легче.", steps: ["Подготовь напиток без алкоголя/никотина", "Убери покупку из маршрута", "Зайди в приложение перед самым рискованным окном"] },
        refusal: { title: "Коротко и без объяснений", body: "Фраза: «Я сегодня не пью и не курю. Мне так спокойнее». Не доказывай. Повтори тем же тоном.", steps: ["Скажи коротко", "Смени тему", "Держи в руке безопасный напиток"] },
        anxiety: { title: "Тревога не требует старого ритуала", body: "Сначала снижаем шум в теле. Решения принимаются после дыхания, воды и дистанции.", steps: ["Выдох длиннее вдоха 10 раз", "Плечи вниз, стопы на пол", "Напиши одну реальную причину держаться: {reason}"] },
        goal: { title: "Ты делаешь это ради {reason}", body: "Цель не обязана быть громкой. Она должна быть рядом в момент, когда привычка предлагает старый путь.", steps: ["Посмотри на сохраненные деньги", "Выбери одну маленькую награду", "Сделай следующий чистый час"] }
      }
    }
  },
  en: {
    mentor: { kicker: "Reactor Mentor", title: "Short help without lectures", subtitle: "Pick a situation and get a plan for the next few minutes.", signal_empty: "No check-in yet. Start with a quick state check.", signal_checkin: "Last signal: stress {stress}/10, craving {craving}/10.", default_reason: "freedom and control", no_recent_incident: "no recent incident", open_sos: "Open SOS", open_checkin: "Check-in", topics: { craving: "Explain craving", incident: "Review slip", evening: "Evening plan", refusal: "Refusal phrase", anxiety: "Anxiety help", goal: "Remember goal" }, responses: { craving: { title: "This is craving speaking, not you", body: "Give it five minutes: water, air, pause. Decide after the wave drops.", steps: ["Name the craving", "Drink water", "Open SOS or leave the trigger"] }, incident: { title: "An incident is data, not a verdict", body: "Recent episode: {time}. Stop the chain first, then find the trigger.", steps: ["Stop continuation", "Write what happened before", "Pick one evening protection step"] }, evening: { title: "The evening needs a plan", body: "You do not need to win a whole life tonight. Close the next hours well.", steps: ["Prepare a safe drink", "Remove the risky route", "Check in before the risk window"] }, refusal: { title: "Short, calm, no debate", body: "Phrase: I am not drinking or smoking today. I feel better this way.", steps: ["Say it shortly", "Change topic", "Hold a safe drink"] }, anxiety: { title: "Anxiety does not need the old ritual", body: "Lower the body noise first. Decisions come after breath, water and distance.", steps: ["Long exhale 10 times", "Feet on floor", "Write one real reason: {reason}"] }, goal: { title: "You are doing this for {reason}", body: "Keep the goal close when the habit offers the old path.", steps: ["Look at saved money", "Choose a small reward", "Make the next clean hour"] } } },
    recovery_assistant: {},
    health_visual: {}
  },
  de: {
    mentor: { kicker: "Reaktor-Mentor", title: "Kurze Hilfe ohne Moral", subtitle: "Wähle eine Situation und bekomme einen Plan für die nächsten Minuten.", signal_empty: "Noch kein Check-in. Starte mit einer kurzen Einschätzung.", signal_checkin: "Letztes Signal: Stress {stress}/10, Verlangen {craving}/10.", default_reason: "Freiheit und Kontrolle", no_recent_incident: "kein aktueller Vorfall", open_sos: "SOS öffnen", open_checkin: "Check-in", topics: { craving: "Verlangen erklären", incident: "Rückfall ansehen", evening: "Plan für Abend", refusal: "Ablehnungssatz", anxiety: "Angst beruhigen", goal: "Ziel erinnern" }, responses: { craving: { title: "Gerade spricht das Verlangen, nicht du", body: "Gib ihm fünf Minuten: Wasser, Luft, Pause. Entscheide danach.", steps: ["Verlangen benennen", "Wasser trinken", "SOS öffnen oder Ort wechseln"] }, incident: { title: "Ein Vorfall ist Daten, kein Urteil", body: "Letzte Episode: {time}. Stoppe zuerst die Kette.", steps: ["Nicht weitermachen", "Trigger notieren", "Einen Schutzschritt wählen"] }, evening: { title: "Der Abend braucht einen Plan", body: "Heute zählt der nächste ruhige Abschnitt.", steps: ["Sicheres Getränk vorbereiten", "Riskante Route meiden", "Vor dem Risiko einchecken"] }, refusal: { title: "Kurz, ruhig, ohne Debatte", body: "Satz: Heute trinke und rauche ich nicht. So geht es mir besser.", steps: ["Kurz sagen", "Thema wechseln", "Sicheres Getränk halten"] }, anxiety: { title: "Angst braucht kein altes Ritual", body: "Erst den Körper beruhigen: Atmung, Wasser, Abstand.", steps: ["Lang ausatmen", "Füße auf den Boden", "Einen Grund notieren: {reason}"] }, goal: { title: "Du machst das für {reason}", body: "Halte das Ziel nah, wenn die Gewohnheit den alten Weg anbietet.", steps: ["Gespartes ansehen", "Kleine Belohnung wählen", "Die nächste saubere Stunde schaffen"] } } },
    recovery_assistant: {},
    health_visual: {}
  }
};

function messagePath(path) {
  const translated = readPath(state.messages, path);
  if (translated !== undefined) return translated;
  const langFallback = readPath(FALLBACK_COPY[state.lang] || {}, path);
  if (langFallback !== undefined) return langFallback;
  return readPath(FALLBACK_COPY.ru, path);
}

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
  let value = messagePath(path);
  if (value === undefined) value = path;
  if (typeof value !== "string") return value;
  return value.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? "");
}

function list(path) {
  const value = messagePath(path);
  return Array.isArray(value) ? value : [];
}

function money(amount, currency = "EUR") {
  try {
    return new Intl.NumberFormat(state.lang, { style: "currency", currency }).format(Number(amount || 0));
  } catch {
    return `${Number(amount || 0).toFixed(2)} ${currency}`;
  }
}

function dashboardNoticeToast() {
  if (!state.notice) return "";
  return `
    <div class="app-toast success" id="dashboardNoticeToast" role="status" aria-live="polite">
      <span class="app-toast-icon">${icon("bolt")}</span>
      <strong>${esc(state.notice)}</strong>
      <button class="icon-button" id="dismissDashboardNotice" type="button" aria-label="${esc(t("common.close"))}">${icon("x")}</button>
    </div>`;
}

function scheduleNoticeClear() {
  clearTimeout(noticeTimer);
  if (!state.notice || state.screen !== "dashboard") return;
  const currentNotice = state.notice;
  noticeTimer = window.setTimeout(() => {
    if (state.notice !== currentNotice || state.screen !== "dashboard") return;
    state.notice = "";
    render();
  }, 5200);
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

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function clampPercent(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value || 0))));
}

function recoveryStoreKey(userId = state.dashboard?.user?.id) {
  return userId ? `reactor_recovery_store_v1_${userId}` : "";
}

function defaultRecoveryProfile(data = state.dashboard) {
  const now = new Date().toISOString();
  const habitTypes = Array.isArray(data?.habit_types) && data.habit_types.length ? data.habit_types : ["smoking"];
  const smoking = data?.habits?.smoking || {};
  const alcohol = data?.habits?.alcohol || {};

  return {
    addictionTypes: habitTypes,
    mode: "quit_now",
    smoking: {
      cigarettesPerDay: Number(smoking.cigarettes_per_day || 0),
      packPrice: Number(smoking.pack_price || 0),
      cigarettesPerPack: Number(smoking.cigarettes_per_pack || 20),
      firstCigaretteAfterWake: "31_60",
      hardInForbiddenPlaces: false,
      mostImportantCigarette: "stress",
      smokesWhenIll: false
    },
    alcohol: {
      frequency: "weekly",
      amountTypical: "moderate",
      binges: false,
      failedToReduce: false,
      withdrawalSymptoms: {
        tremor: false,
        sweating: false,
        anxiety: false,
        insomnia: false,
        palpitations: false
      },
      drinksAlone: false,
      mainContext: Array.isArray(alcohol.dangerous_days) ? alcohol.dangerous_days : []
    },
    createdAt: now,
    updatedAt: now
  };
}

function defaultRecoveryStore(data = state.dashboard) {
  const now = new Date().toISOString();
  return {
    version: 1,
    recoveryProfile: defaultRecoveryProfile(data),
    dailyCheckins: [],
    cravingEvents: [],
    incidents: [],
    protectionProtocols: [],
    achievements: [],
    dailyMissions: [],
    rescueContacts: [],
    notificationSettings: {
      enabled: false,
      morningEnabled: true,
      afterWorkEnabled: true,
      afterWorkTime: "18:00",
      eveningEnabled: true,
      eveningTime: "21:00",
      fridayWarning: true,
      quietHours: { enabled: true, from: "22:00", to: "08:00" }
    },
    healthReactor: { money: 0, energy: 0, control: 0, health: 0 },
    lastSeenAt: now
  };
}

function mergeRecoveryProfile(profile, fallback) {
  return {
    ...fallback,
    ...(profile || {}),
    addictionTypes: Array.isArray(profile?.addictionTypes) && profile.addictionTypes.length ? profile.addictionTypes : fallback.addictionTypes,
    smoking: { ...fallback.smoking, ...(profile?.smoking || {}) },
    alcohol: {
      ...fallback.alcohol,
      ...(profile?.alcohol || {}),
      withdrawalSymptoms: {
        ...fallback.alcohol.withdrawalSymptoms,
        ...(profile?.alcohol?.withdrawalSymptoms || {})
      },
      mainContext: Array.isArray(profile?.alcohol?.mainContext) ? profile.alcohol.mainContext : fallback.alcohol.mainContext
    }
  };
}

function loadRecoveryStore(data = state.dashboard) {
  const key = recoveryStoreKey(data?.user?.id);
  const fallback = defaultRecoveryStore(data);
  if (!key) return fallback;

  try {
    const stored = JSON.parse(localStorage.getItem(key) || "null");
    if (!stored || typeof stored !== "object") return fallback;
    return {
      ...fallback,
      ...stored,
      recoveryProfile: mergeRecoveryProfile(stored.recoveryProfile, fallback.recoveryProfile),
      dailyCheckins: Array.isArray(stored.dailyCheckins) ? stored.dailyCheckins : [],
      cravingEvents: Array.isArray(stored.cravingEvents) ? stored.cravingEvents : [],
      incidents: Array.isArray(stored.incidents) ? stored.incidents : [],
      protectionProtocols: Array.isArray(stored.protectionProtocols) ? stored.protectionProtocols : [],
      achievements: Array.isArray(stored.achievements) ? stored.achievements : [],
      dailyMissions: Array.isArray(stored.dailyMissions) ? stored.dailyMissions : [],
      rescueContacts: Array.isArray(stored.rescueContacts) ? stored.rescueContacts : [],
      notificationSettings: {
        ...fallback.notificationSettings,
        ...(stored.notificationSettings || {}),
        quietHours: {
          ...fallback.notificationSettings.quietHours,
          ...(stored.notificationSettings?.quietHours || {})
        }
      },
      healthReactor: { ...fallback.healthReactor, ...(stored.healthReactor || {}) }
    };
  } catch {
    return fallback;
  }
}

function saveRecoveryStore(store, userId = state.dashboard?.user?.id) {
  const key = recoveryStoreKey(userId);
  if (!key) return;
  try {
    localStorage.setItem(key, JSON.stringify({ ...store, version: 1 }));
  } catch {}
}

function updateRecoveryStore(updater) {
  if (!state.dashboard?.user?.id) return loadRecoveryStore(state.dashboard);
  const store = loadRecoveryStore(state.dashboard);
  const next = updater(store) || store;
  saveRecoveryStore(next, state.dashboard.user.id);
  return next;
}

function profileFromOnboarding() {
  const now = new Date().toISOString();
  return {
    addictionTypes: [...state.onboarding.habits],
    mode: state.onboarding.recovery_mode || "quit_now",
    smoking: {
      cigarettesPerDay: Number(state.onboarding.cigarettes_per_day || 0),
      packPrice: Number(state.onboarding.pack_price || 0),
      cigarettesPerPack: Number(state.onboarding.cigarettes_per_pack || 20),
      firstCigaretteAfterWake: state.onboarding.first_cigarette_after_wake || "31_60",
      hardInForbiddenPlaces: Boolean(state.onboarding.hard_in_forbidden_places),
      mostImportantCigarette: state.onboarding.most_important_cigarette || "stress",
      smokesWhenIll: Boolean(state.onboarding.smokes_when_ill)
    },
    alcohol: {
      frequency: state.onboarding.alcohol_frequency || "weekly",
      amountTypical: state.onboarding.alcohol_amount_typical || "moderate",
      binges: Boolean(state.onboarding.alcohol_binges),
      failedToReduce: Boolean(state.onboarding.alcohol_failed_to_reduce),
      withdrawalSymptoms: { ...state.onboarding.alcohol_withdrawal },
      drinksAlone: Boolean(state.onboarding.alcohol_drinks_alone),
      mainContext: [...state.onboarding.alcohol_contexts]
    },
    createdAt: now,
    updatedAt: now
  };
}

function startupRiskScore(profile = loadRecoveryStore().recoveryProfile) {
  const smoking = profile.smoking || {};
  const alcohol = profile.alcohol || {};
  const withdrawal = alcohol.withdrawalSymptoms || {};
  const alcoholMedical = Boolean(alcohol.binges || alcohol.failedToReduce || Object.values(withdrawal).some(Boolean));
  let smokingScore = 0;
  let alcoholScore = 0;

  if (["0_5", "6_30"].includes(smoking.firstCigaretteAfterWake)) smokingScore += 25;
  if (Number(smoking.cigarettesPerDay || 0) >= 20) smokingScore += 25;
  if (smoking.hardInForbiddenPlaces) smokingScore += 18;
  if (smoking.smokesWhenIll) smokingScore += 16;
  if (smoking.mostImportantCigarette === "morning") smokingScore += 16;

  if (["daily", "almost_daily"].includes(alcohol.frequency)) alcoholScore += 24;
  if (["high", "very_high"].includes(alcohol.amountTypical)) alcoholScore += 20;
  if (alcohol.drinksAlone) alcoholScore += 14;
  if (Array.isArray(alcohol.mainContext) && alcohol.mainContext.includes("stress")) alcoholScore += 10;
  if (alcoholMedical) alcoholScore = Math.max(alcoholScore, 86);

  const maxScore = Math.max(smokingScore, alcoholScore);
  const stateName = alcoholMedical ? "danger" : maxScore >= 55 ? "caution" : "normal";

  return {
    state: stateName,
    score: clampPercent(maxScore),
    smokingLevel: smokingScore >= 65 ? "high" : smokingScore >= 32 ? "medium" : "low",
    alcoholLevel: alcoholMedical ? "medical" : alcoholScore >= 65 ? "high" : alcoholScore >= 32 ? "medium" : "low",
    alcoholMedical
  };
}

function calculateDailyRisk(profile, checkins = [], incidents = [], currentDate = new Date()) {
  let score = 12;
  const factors = [];
  const day = currentDate.getDay();
  const hour = currentDate.getHours();
  const contexts = profile?.alcohol?.mainContext || [];
  const recentCheckins = Array.isArray(checkins) ? [...checkins].sort((a, b) => String(b.date).localeCompare(String(a.date))) : [];
  const latest = recentCheckins[0] || null;
  const recentIncidents = Array.isArray(incidents) ? incidents.filter((item) => {
    const time = Date.parse(item.createdAt || item.created_at || "");
    return Number.isFinite(time) && Date.now() - time <= 7 * 24 * 60 * 60 * 1000;
  }) : [];

  if (day === 5) {
    score += 14;
    factors.push(t("recovery_assistant.factor_friday"));
  }
  if (day === 0 || day === 6) {
    score += 12;
    factors.push(t("recovery_assistant.factor_weekend"));
  }
  if (hour >= 17 && hour <= 22) {
    score += 10;
    factors.push(t("recovery_assistant.factor_evening"));
  }
  if (contexts.includes("after_work") && hour >= 16 && hour <= 20) {
    score += 12;
    factors.push(t("recovery_assistant.factor_after_work"));
  }
  if (latest) {
    if (Number(latest.sleep || 0) > 0 && Number(latest.sleep || 0) <= 4) {
      score += 16;
      factors.push(t("recovery_assistant.factor_bad_sleep"));
    }
    if (Number(latest.stress || 0) >= 7) {
      score += 18;
      factors.push(t("recovery_assistant.factor_stress"));
    }
    if (Number(latest.craving || 0) >= 7) {
      score += 20;
      factors.push(t("recovery_assistant.factor_craving"));
    }
  }
  if (recentIncidents.length > 0) {
    score += Math.min(22, recentIncidents.length * 7);
    factors.push(t("recovery_assistant.factor_recent_incident"));
  }
  if (recentIncidents.some((item) => {
    const time = new Date(item.createdAt || item.created_at || "");
    return Number.isFinite(time.getTime()) && Math.abs(time.getHours() - hour) <= 1;
  })) {
    score += 14;
    factors.push(t("recovery_assistant.factor_same_time"));
  }

  const level = score >= 65 ? "high" : score >= 36 ? "medium" : "low";
  const fallback = level === "high" ? "recovery_assistant.daily_recommendation_high" : level === "medium" ? "recovery_assistant.daily_recommendation_medium" : "recovery_assistant.daily_recommendation_low";
  return {
    level,
    score: clampPercent(score),
    factors: [...new Set(factors)].slice(0, 5),
    recommendation: t(fallback)
  };
}

function calculateHealthReactor(data = state.dashboard, store = loadRecoveryStore(data)) {
  const cleanDays = Number(data?.reactor?.control_days || 0);
  const wins = Number(data?.stats?.craving_wins || 0);
  const goalPercent = Number(data?.money?.goal?.progress_percent || 0);
  const recentIncidents = Array.isArray(store.incidents) ? store.incidents.slice(-10).length : 0;
  const latestCheckin = Array.isArray(store.dailyCheckins) ? store.dailyCheckins.slice(-1)[0] : null;
  const energyInput = latestCheckin ? ((Number(latestCheckin.energy || 5) + Number(latestCheckin.sleep || 5)) / 20) * 100 : 42 + cleanDays * 2;
  const controlInput = 35 + wins * 5 + cleanDays * 2 - recentIncidents * 6;
  const healthInput = 32 + cleanDays * 3 + wins * 2 - recentIncidents * 4;

  return {
    money: clampPercent(Math.max(goalPercent, Number(data?.money?.saved_total || 0) > 0 ? 24 + goalPercent : 18)),
    energy: clampPercent(energyInput),
    control: clampPercent(controlInput),
    health: clampPercent(healthInput)
  };
}

function daysSince(value) {
  const time = Date.parse(value || "");
  if (!Number.isFinite(time)) return 0;
  return Math.max(0, Math.floor((Date.now() - time) / (24 * 60 * 60 * 1000)));
}

function latestIncident(store, windowHours = 3) {
  const windowMs = windowHours * 60 * 60 * 1000;
  const incidents = Array.isArray(store?.incidents) ? store.incidents : [];
  return [...incidents]
    .filter((incident) => {
      const time = Date.parse(incident.createdAt || incident.created_at || "");
      return Number.isFinite(time) && Date.now() - time <= windowMs;
    })
    .sort((a, b) => Date.parse(b.createdAt || b.created_at || "") - Date.parse(a.createdAt || a.created_at || ""))[0] || null;
}

function habitActionLabel(habitType, code) {
  const smokingUi = dashboardSmokingUi(state.dashboard);
  const key = habitType === "alcohol"
    ? `recovery_assistant.chain_action_alcohol_${code}`
    : smokingUi.isVape
      ? `recovery_assistant.chain_action_vape_${code}`
      : `recovery_assistant.chain_action_smoking_${code}`;
  const fallback = messagePath(key) === undefined
    ? `recovery_assistant.chain_action_${code}`
    : key;
  return t(fallback);
}

function chainProtectionState(risk, store) {
  const incident = latestIncident(store, 3);
  const incidentTime = Date.parse(incident?.createdAt || incident?.created_at || "");
  const until = Number.isFinite(incidentTime) ? new Date(incidentTime + 3 * 60 * 60 * 1000) : null;
  const protocols = Array.isArray(store?.protectionProtocols) ? store.protectionProtocols : [];
  const completed = new Set(protocols
    .filter((item) => incident ? item.incidentId === incident.id : item.date === localDateKey())
    .map((item) => item.code));

  return {
    active: Boolean(incident && until && until.getTime() > Date.now()),
    incident,
    until,
    completed,
    shouldShow: Boolean(incident) || risk.level === "high"
  };
}

function chainActionOptions(habitType) {
  return [
    { code: "pledge", icon: "shield", label: habitActionLabel(habitType, "pledge") },
    { code: "dispose", icon: "x", label: habitActionLabel(habitType, "dispose") },
    { code: "water", icon: "leaf", label: t("recovery_assistant.chain_action_water") },
    { code: "leave", icon: "bolt", label: t("recovery_assistant.chain_action_leave") },
    { code: "timer", icon: "bell", label: t("recovery_assistant.chain_action_timer") }
  ];
}

function compactLimit(value, unit) {
  return { value: String(value), unit };
}

function buildReductionPlan(data, store, startupRisk) {
  const profile = store.recoveryProfile || defaultRecoveryProfile(data);
  const mode = profile.mode || "quit_now";
  const createdDays = daysSince(profile.createdAt || store.lastSeenAt);
  const week = Math.max(0, Math.floor(createdDays / 7));
  const habitTypes = Array.isArray(data?.habit_types) ? data.habit_types : [];
  const hasSmoking = habitTypes.includes("smoking");
  const hasAlcohol = habitTypes.includes("alcohol");
  const isVape = dashboardSmokingUi(data).isVape;
  const smokingStart = Math.max(1, Number(profile.smoking?.cigarettesPerDay || data?.habits?.smoking?.cigarettes_per_day || 20));
  const vapeWeekly = Math.max(0, Number(data?.habits?.smoking?.vape_weekly_spend || state.onboarding.vape_weekly_spend || 35));
  const alcoholWeekly = Math.max(0, Number(data?.money?.alcohol_weekly_spend || data?.habits?.alcohol?.weekly_spend || state.onboarding.alcohol_weekly_spend || 30));

  if (mode === "observe") {
    return {
      mode,
      token: "token-violet",
      title: t("recovery_assistant.reduction_observe_title"),
      body: t("recovery_assistant.reduction_observe_body"),
      today: compactLimit(t("recovery_assistant.reduction_observe_value"), t("recovery_assistant.reduction_observe_unit")),
      next: t("recovery_assistant.reduction_observe_next"),
      steps: list("recovery_assistant.reduction_observe_steps").map((title, index) => ({ title, active: index === Math.min(week, 2) }))
    };
  }

  if (mode === "quit_now") {
    return {
      mode,
      token: "token-green",
      title: t("recovery_assistant.reduction_quit_title"),
      body: t("recovery_assistant.reduction_quit_body"),
      today: compactLimit("0", hasSmoking ? t(isVape ? "recovery_assistant.reduction_vape_unit" : "recovery_assistant.reduction_cigarette_unit") : t("recovery_assistant.reduction_alcohol_unit")),
      next: t("recovery_assistant.reduction_quit_next"),
      steps: [
        { title: t("recovery_assistant.reduction_quit_step_1"), active: true },
        { title: t("recovery_assistant.reduction_quit_step_2"), active: false },
        { title: t("recovery_assistant.reduction_quit_step_3"), active: false }
      ]
    };
  }

  if (hasAlcohol && !hasSmoking) {
    if (startupRisk.alcoholMedical) {
      return {
        mode,
        token: "token-red",
        title: t("recovery_assistant.reduction_alcohol_medical_title"),
        body: t("recovery_assistant.reduction_alcohol_medical_body"),
        today: compactLimit(t("recovery_assistant.reduction_safe"), t("recovery_assistant.reduction_alcohol_unit")),
        next: t("recovery_assistant.reduction_alcohol_medical_next"),
        steps: list("recovery_assistant.reduction_alcohol_medical_steps").map((title, index) => ({ title, active: index === 0 }))
      };
    }
    const factors = [1, .8, .65, .45, .25, 0];
    const target = Math.max(0, alcoholWeekly * factors[Math.min(week, factors.length - 1)]);
    const nextTarget = Math.max(0, alcoholWeekly * factors[Math.min(week + 1, factors.length - 1)]);
    return {
      mode,
      token: "token-blue",
      title: t("recovery_assistant.reduction_alcohol_title"),
      body: t("recovery_assistant.reduction_alcohol_body"),
      today: compactLimit(money(target / 7, data.money?.goal?.currency || "EUR"), t("recovery_assistant.reduction_alcohol_unit")),
      next: t("recovery_assistant.reduction_next_budget", { amount: money(nextTarget / 7, data.money?.goal?.currency || "EUR") }),
      steps: factors.slice(1).map((factor, index) => ({
        title: t("recovery_assistant.reduction_week_budget", { week: index + 1, amount: money(Math.max(0, alcoholWeekly * factor / 7), data.money?.goal?.currency || "EUR") }),
        active: index === Math.min(week, factors.length - 2)
      }))
    };
  }

  if (isVape) {
    const factors = [1, .8, .65, .5, .25, 0];
    const target = Math.max(0, vapeWeekly * factors[Math.min(week, factors.length - 1)]);
    const nextTarget = Math.max(0, vapeWeekly * factors[Math.min(week + 1, factors.length - 1)]);
    return {
      mode,
      token: "token-blue",
      title: t("recovery_assistant.reduction_vape_title"),
      body: t("recovery_assistant.reduction_vape_body"),
      today: compactLimit(money(target / 7, data.money?.goal?.currency || "EUR"), t("recovery_assistant.reduction_vape_unit")),
      next: t("recovery_assistant.reduction_next_budget", { amount: money(nextTarget / 7, data.money?.goal?.currency || "EUR") }),
      steps: factors.slice(1).map((factor, index) => ({
        title: t("recovery_assistant.reduction_week_budget", { week: index + 1, amount: money(Math.max(0, vapeWeekly * factor / 7), data.money?.goal?.currency || "EUR") }),
        active: index === Math.min(week, factors.length - 2)
      }))
    };
  }

  const targets = [smokingStart, 15, 12, 10, 5, 0].map((target) => Math.min(smokingStart, target));
  const currentTarget = targets[Math.min(week, targets.length - 1)];
  const nextTarget = targets[Math.min(week + 1, targets.length - 1)];
  return {
    mode,
    token: "token-blue",
    title: t("recovery_assistant.reduction_smoking_title"),
    body: t("recovery_assistant.reduction_smoking_body"),
    today: compactLimit(currentTarget, t("recovery_assistant.reduction_cigarette_unit")),
    next: t("recovery_assistant.reduction_next_cigarettes", { count: nextTarget }),
    steps: targets.slice(1).map((target, index) => ({
      title: t("recovery_assistant.reduction_week_cigarettes", { week: index + 1, count: target }),
      active: index === Math.min(week, targets.length - 2)
    }))
  };
}

function mentorTopics() {
  return [
    { code: "craving", icon: "bolt" },
    { code: "incident", icon: "shield" },
    { code: "evening", icon: "moon" },
    { code: "refusal", icon: "message" },
    { code: "anxiety", icon: "heart" },
    { code: "goal", icon: "star" }
  ];
}

function mentorResponse(topic, data, store) {
  const response = messagePath(`mentor.responses.${topic}`) || messagePath("mentor.responses.goal") || {};
  const reasons = profileMotivationReasons(data?.profile || {});
  const reasonOptions = list("onboarding.reason_options");
  const reasonText = reasons.length
    ? reasons.map((code) => reasonOptions.find((item) => item.code === code)?.title).filter(Boolean).slice(0, 2).join(", ")
    : t("mentor.default_reason");
  const latest = latestIncident(store, 24);
  const vars = {
    reason: reasonText,
    time: latest ? dateTime(latest.createdAt || latest.created_at) : t("mentor.no_recent_incident")
  };
  const apply = (value) => String(value || "").replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? "");

  return {
    title: apply(response.title),
    body: apply(response.body),
    steps: Array.isArray(response.steps) ? response.steps.map(apply) : []
  };
}

function dashboardMotion(data) {
  const key = `reactor_dashboard_snapshot_${data.user.id}`;
  const levelSeenKey = `reactor_level_seen_${data.user.id}`;
  const stage = data.reactor.next_reward?.code || "complete";
  const targetPercent = Number(data.reactor.percent || 0);
  const progression = data.progression || {};
  let previous = null;
  let seenLevel = 0;

  try {
    previous = JSON.parse(localStorage.getItem(key) || "null");
  } catch {
    previous = null;
  }
  try {
    seenLevel = Math.max(0, Number(localStorage.getItem(levelSeenKey) || 0));
  } catch {
    seenLevel = 0;
  }

  const sameStage = previous?.stage === stage;
  const currentLevel = Number(progression.level || 1);
  const previousLevel = Number(previous?.level || 1);
  const sameLevel = Number(previous?.level) === currentLevel;
  const seenAt = Date.parse(previous?.seen_at || "");
  const awayMs = Number.isFinite(seenAt) ? Math.max(0, Date.now() - seenAt) : 0;
  const previousControlHours = Number(previous?.control_hours);
  const controlHoursDelta = Number.isFinite(previousControlHours)
    ? Math.max(0, Number(data.reactor.control_hours || 0) - previousControlHours)
    : 0;
  const savedDelta = Math.max(0, Number(data.money.saved_total || 0) - Number(previous?.saved_total || 0));
  const xpDelta = Math.max(0, Number(progression.xp || 0) - Number(previous?.xp || 0));
  const reactorDelta = sameStage ? Math.max(0, targetPercent - Number(previous?.percent || 0)) : 0;
  const levelChanged = Boolean(previous) && currentLevel > previousLevel;
  const shouldCelebrateLevel = currentLevel > 1 && currentLevel > seenLevel;
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
    levelCelebration: shouldCelebrateLevel ? {
      key: levelSeenKey,
      previousLevel: Math.max(1, Math.min(currentLevel - 1, Math.max(seenLevel, previousLevel))),
      level: currentLevel,
      xpDelta
    } : null,
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
      window.setTimeout(() => {
        if (motion.levelCelebration) {
          openLevelCelebration(data, motion);
        } else {
          openReturnBrief(data, motion, currency);
        }
      }, reduceMotion ? 120 : 360);
    }
  }

  requestAnimationFrame(frame);
}

function openLevelCelebration(data, motion) {
  if (!motion.levelCelebration || state.screen !== "dashboard" || modalRoot.childElementCount > 0) return;
  const progression = data.progression || {};
  const activeSystems = Math.min(3, Math.max(1, Math.ceil(Number(progression.level || 1) / 2)));
  const systemKeys = ["progression.brain", "progression.breath", "progression.heart"].slice(0, activeSystems);
  try {
    localStorage.setItem(motion.levelCelebration.key, String(progression.level || motion.levelCelebration.level));
  } catch {}

  modalRoot.innerHTML = `
    <div class="modal level-up-overlay" role="dialog" aria-modal="true" aria-labelledby="levelUpTitle">
      <div class="modal-card level-up-modal">
        <div class="level-up-shockwave" aria-hidden="true"></div>
        <div class="level-up-confetti" aria-hidden="true">${Array.from({ length: 18 }, (_, index) => `<i style="--spark:${index}"></i>`).join("")}</div>
        <div class="level-up-rays" aria-hidden="true">${Array.from({ length: 12 }, (_, index) => `<i style="--ray:${index}"></i>`).join("")}</div>
        <div class="level-up-core" aria-hidden="true">
          <span>${icon("trophy")}</span>
          <strong>${esc(t("progression.level_short", { level: progression.level }))}</strong>
        </div>
        <div class="level-up-levels" aria-hidden="true">
          <span>${esc(t("progression.level_short", { level: motion.levelCelebration.previousLevel }))}</span>
          <b>${icon("bolt")}</b>
          <strong>${esc(t("progression.level_short", { level: progression.level }))}</strong>
        </div>
        <p class="eyebrow">${esc(t("level_up.kicker"))}</p>
        <h2 id="levelUpTitle">${esc(t("level_up.title", { title: t(progression.title_key) }))}</h2>
        <p class="level-up-body">${esc(t(progression.body_key))}</p>
        <div class="level-up-xp">
          <span>${esc(t("level_up.xp_total"))}</span>
          <strong>${esc(t("progression.xp_value", { xp: progression.xp }))}</strong>
        </div>
        <div class="level-up-systems">
          <small>${esc(t("level_up.systems"))}</small>
          <div>${systemKeys.map((key, index) => `<span>${icon(["brain", "lungs", "heart"][index])}${esc(t(key))}</span>`).join("")}</div>
        </div>
        <button class="primary-button full" id="continueLevelUp" type="button">${esc(t("level_up.continue"))}</button>
      </div>
    </div>`;

  const close = () => closeModal();
  modalRoot.querySelector("#continueLevelUp").addEventListener("click", close);
  modalRoot.querySelector(".level-up-overlay").addEventListener("click", (event) => {
    if (event.target === event.currentTarget) close();
  });
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

function profileMotivationReasons(profile = state.dashboard?.profile) {
  const stored = Array.isArray(profile?.motivation_reasons) ? profile.motivation_reasons : [];
  if (stored.length) return stored;
  return profile?.main_reason ? [profile.main_reason] : [];
}

function renderMotivationReasonChoices(selectedReasons, inputName = "motivation_reasons", onboarding = false) {
  const selected = Array.isArray(selectedReasons) ? selectedReasons : [];
  return list("onboarding.reason_options").map((option) => `
    <label class="reason-choice ${selected.includes(option.code) ? "selected" : ""}">
      <input type="checkbox" name="${esc(inputName)}" value="${esc(option.code)}" ${selected.includes(option.code) ? "checked" : ""} ${onboarding ? "data-onboarding-reason" : ""}>
      <span class="icon-token ${esc(option.token)}">${icon(option.icon)}</span>
      <span class="reason-choice-copy"><strong>${esc(option.title)}</strong><small>${esc(option.body)}</small></span>
      <span class="reason-checkmark">${icon("shield")}</span>
    </label>`).join("");
}

function personalizedMentorPhrase() {
  const reasons = profileMotivationReasons();
  const customReason = String(state.dashboard?.profile?.custom_reason || "").trim();
  const pool = reasons.flatMap((reason) => list(`phrases.reasons.${reason}`));
  if (reasons.includes("custom") && customReason) pool.unshift(customReason);
  const source = pool.length ? pool : list("phrases.general");
  if (!source.length) return mentorPhrase("general");
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
      navigator.serviceWorker.register(apiPath(`/service-worker.js?v=${encodeURIComponent(boot.assetVersion || "42")}`)).catch(() => {});
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
  const flow = ["habit", "mode", "reason", "goal"];
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

  if (key === "mode") {
    return `
      <p class="eyebrow">${esc(t("recovery_assistant.profile_kicker"))}</p>
      <h2>${esc(t("recovery_assistant.mode_title"))}</h2>
      <p class="muted">${esc(t("recovery_assistant.mode_subtitle"))}</p>
      <div class="choice-grid">
        ${list("recovery_assistant.mode_options").map((option) => `
          <button class="choice-card ${state.onboarding.recovery_mode === option.code ? "selected" : ""}" type="button" data-recovery-mode="${esc(option.code)}">
            <div class="icon-token ${esc(option.token || "token-blue")}">${icon(option.icon || "shield")}</div>
            <strong>${esc(option.title)}</strong>
            <span>${esc(option.body)}</span>
          </button>`).join("")}
      </div>`;
  }

  if (key === "reason") {
    return `
      <p class="eyebrow">${esc(t("onboarding.kicker"))}</p>
      <h2>${esc(t("onboarding.reason_title"))}</h2>
      <p class="muted">${esc(t("onboarding.reason_subtitle"))}</p>
      <div class="reason-choice-grid">
        ${renderMotivationReasonChoices(state.onboarding.motivation_reasons, "motivation_reasons", true)}
      </div>
      <div class="${state.onboarding.motivation_reasons.includes("custom") ? "" : "hidden"}">
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
    const isVape = state.onboarding.smoking_product === "vape";
    return `
      <p class="eyebrow">${esc(t("habits.smoking"))}</p>
      <h2>${esc(t("onboarding.smoking_title"))}</h2>
      <p class="muted">${esc(t("onboarding.smoking_subtitle"))}</p>
      ${renderSmokingProductPicker("onboarding_smoking_product", state.onboarding.smoking_product, "onboarding")}
      <div class="smoking-detail-block">
        <h3>${esc(t(isVape ? "onboarding.vape_details_title" : "onboarding.tobacco_details_title"))}</h3>
        ${isVape ? `
          <p class="muted">${esc(t("onboarding.vape_spend_help"))}</p>
          <div class="wizard-fields one-field">
            <label>${esc(t("onboarding.vape_weekly_spend"))}<input id="vapeWeeklySpend" type="number" min="0" step="0.1" value="${esc(state.onboarding.vape_weekly_spend)}"></label>
          </div>` : `
          <div class="wizard-fields">
            <label>${esc(t("onboarding.cigarettes_per_day"))}<input id="cigarettesPerDay" type="number" min="0" step="1" value="${esc(state.onboarding.cigarettes_per_day)}"></label>
            <label>${esc(t("onboarding.cigarettes_per_pack"))}<input id="cigarettesPerPack" type="number" min="1" step="1" value="${esc(state.onboarding.cigarettes_per_pack)}"></label>
            <label>${esc(t("onboarding.pack_price"))}<input id="packPrice" type="number" min="0" step="0.1" value="${esc(state.onboarding.pack_price)}"></label>
          </div>
          <div class="risk-question-grid">
            <label>${esc(t("recovery_assistant.first_cigarette"))}
              <select id="firstCigaretteAfterWake">
                ${list("recovery_assistant.first_cigarette_options").map((option) => `<option value="${esc(option.code)}" ${state.onboarding.first_cigarette_after_wake === option.code ? "selected" : ""}>${esc(option.title)}</option>`).join("")}
              </select>
            </label>
            <label>${esc(t("recovery_assistant.important_cigarette"))}
              <select id="mostImportantCigarette">
                ${list("recovery_assistant.important_cigarette_options").map((option) => `<option value="${esc(option.code)}" ${state.onboarding.most_important_cigarette === option.code ? "selected" : ""}>${esc(option.title)}</option>`).join("")}
              </select>
            </label>
            <label class="checkbox-line"><input id="hardForbiddenPlaces" type="checkbox" ${state.onboarding.hard_in_forbidden_places ? "checked" : ""}><span>${esc(t("recovery_assistant.hard_forbidden_places"))}</span></label>
            <label class="checkbox-line"><input id="smokesWhenIll" type="checkbox" ${state.onboarding.smokes_when_ill ? "checked" : ""}><span>${esc(t("recovery_assistant.smokes_when_ill"))}</span></label>
          </div>`}
      </div>`;
  }

  if (key === "alcohol") {
    return `
      <p class="eyebrow">${esc(t("habits.alcohol"))}</p>
      <h2>${esc(t("onboarding.alcohol_title"))}</h2>
      <div class="wizard-fields">
        <label>${esc(t("onboarding.alcohol_weekly_spend"))}<input id="alcoholWeeklySpend" type="number" min="0" step="0.1" value="${esc(state.onboarding.alcohol_weekly_spend)}"></label>
        <label>${esc(t("recovery_assistant.alcohol_frequency"))}
          <select id="alcoholFrequency">
            ${list("recovery_assistant.alcohol_frequency_options").map((option) => `<option value="${esc(option.code)}" ${state.onboarding.alcohol_frequency === option.code ? "selected" : ""}>${esc(option.title)}</option>`).join("")}
          </select>
        </label>
        <label>${esc(t("recovery_assistant.alcohol_amount"))}
          <select id="alcoholAmountTypical">
            ${list("recovery_assistant.alcohol_amount_options").map((option) => `<option value="${esc(option.code)}" ${state.onboarding.alcohol_amount_typical === option.code ? "selected" : ""}>${esc(option.title)}</option>`).join("")}
          </select>
        </label>
      </div>
      <h3>${esc(t("recovery_assistant.alcohol_risk_title"))}</h3>
      <div class="risk-question-grid">
        <label class="checkbox-line"><input id="alcoholBinges" type="checkbox" ${state.onboarding.alcohol_binges ? "checked" : ""}><span>${esc(t("recovery_assistant.alcohol_binges"))}</span></label>
        <label class="checkbox-line"><input id="alcoholFailedReduce" type="checkbox" ${state.onboarding.alcohol_failed_to_reduce ? "checked" : ""}><span>${esc(t("recovery_assistant.alcohol_failed_reduce"))}</span></label>
        <label class="checkbox-line"><input id="alcoholDrinksAlone" type="checkbox" ${state.onboarding.alcohol_drinks_alone ? "checked" : ""}><span>${esc(t("recovery_assistant.alcohol_drinks_alone"))}</span></label>
      </div>
      <h3>${esc(t("recovery_assistant.withdrawal_title"))}</h3>
      <div class="pill-grid">
        ${list("recovery_assistant.withdrawal_options").map((option) => `<button class="pill ${state.onboarding.alcohol_withdrawal[option.code] ? "selected" : ""}" type="button" data-withdrawal="${esc(option.code)}">${esc(option.title)}</button>`).join("")}
      </div>
      <h3>${esc(t("recovery_assistant.alcohol_context_title"))}</h3>
      <div class="pill-grid">
        ${list("recovery_assistant.alcohol_context_options").map((option) => `<button class="pill ${state.onboarding.alcohol_contexts.includes(option.code) ? "selected" : ""}" type="button" data-alcohol-context="${esc(option.code)}">${esc(option.title)}</button>`).join("")}
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

function renderSmokingProductPicker(name, selected, context = "settings") {
  return `
    <fieldset class="smoking-product-fieldset ${context === "onboarding" ? "onboarding-product-fieldset" : ""}">
      <legend>${esc(t("onboarding.smoking_product_legend"))}</legend>
      <div class="smoking-product-picker">
        ${["tobacco", "vape"].map((product) => `
          <label class="smoking-product-option">
            <input type="radio" name="${esc(name)}" value="${product}" ${selected === product ? "checked" : ""} data-${context}-smoking-product>
            <span class="icon-token ${product === "vape" ? "token-blue" : "token-red"}">${icon(product === "vape" ? "vape" : "smoke")}</span>
            <span><strong>${esc(t(`onboarding.smoking_product_${product}`))}</strong><small>${esc(t(`onboarding.smoking_product_${product}_body`))}</small></span>
          </label>`).join("")}
      </div>
    </fieldset>`;
}

function renderRecoveryProfileSettings(profile, data = state.dashboard) {
  const hasSmoking = data?.habit_types?.includes("smoking");
  const hasAlcohol = data?.habit_types?.includes("alcohol");
  const smoking = profile.smoking || {};
  const alcohol = profile.alcohol || {};
  const withdrawal = alcohol.withdrawalSymptoms || {};

  return `
    <div class="settings-section recovery-profile-settings">
      <h3>${esc(t("recovery_assistant.profile_title"))}</h3>
      <p class="muted">${esc(t("recovery_assistant.profile_body"))}</p>
      <div class="choice-grid compact-choice-grid">
        ${list("recovery_assistant.mode_options").map((option) => `
          <label class="choice-card ${profile.mode === option.code ? "selected" : ""}">
            <input type="radio" name="recovery_mode" value="${esc(option.code)}" ${profile.mode === option.code ? "checked" : ""}>
            <div class="icon-token ${esc(option.token || "token-blue")}">${icon(option.icon || "shield")}</div>
            <strong>${esc(option.title)}</strong>
            <span>${esc(option.body)}</span>
          </label>`).join("")}
      </div>
      ${hasSmoking ? `
        <div class="risk-question-grid">
          <label>${esc(t("recovery_assistant.first_cigarette"))}
            <select name="first_cigarette_after_wake">
              ${list("recovery_assistant.first_cigarette_options").map((option) => `<option value="${esc(option.code)}" ${smoking.firstCigaretteAfterWake === option.code ? "selected" : ""}>${esc(option.title)}</option>`).join("")}
            </select>
          </label>
          <label>${esc(t("recovery_assistant.important_cigarette"))}
            <select name="most_important_cigarette">
              ${list("recovery_assistant.important_cigarette_options").map((option) => `<option value="${esc(option.code)}" ${smoking.mostImportantCigarette === option.code ? "selected" : ""}>${esc(option.title)}</option>`).join("")}
            </select>
          </label>
          <label class="checkbox-line"><input name="hard_in_forbidden_places" type="checkbox" value="1" ${smoking.hardInForbiddenPlaces ? "checked" : ""}><span>${esc(t("recovery_assistant.hard_forbidden_places"))}</span></label>
          <label class="checkbox-line"><input name="smokes_when_ill" type="checkbox" value="1" ${smoking.smokesWhenIll ? "checked" : ""}><span>${esc(t("recovery_assistant.smokes_when_ill"))}</span></label>
        </div>` : ""}
      ${hasAlcohol ? `
        <div class="settings-grid">
          <label>${esc(t("recovery_assistant.alcohol_frequency"))}
            <select name="alcohol_frequency">
              ${list("recovery_assistant.alcohol_frequency_options").map((option) => `<option value="${esc(option.code)}" ${alcohol.frequency === option.code ? "selected" : ""}>${esc(option.title)}</option>`).join("")}
            </select>
          </label>
          <label>${esc(t("recovery_assistant.alcohol_amount"))}
            <select name="alcohol_amount_typical">
              ${list("recovery_assistant.alcohol_amount_options").map((option) => `<option value="${esc(option.code)}" ${alcohol.amountTypical === option.code ? "selected" : ""}>${esc(option.title)}</option>`).join("")}
            </select>
          </label>
        </div>
        <div class="risk-question-grid">
          <label class="checkbox-line"><input name="alcohol_binges" type="checkbox" value="1" ${alcohol.binges ? "checked" : ""}><span>${esc(t("recovery_assistant.alcohol_binges"))}</span></label>
          <label class="checkbox-line"><input name="alcohol_failed_reduce" type="checkbox" value="1" ${alcohol.failedToReduce ? "checked" : ""}><span>${esc(t("recovery_assistant.alcohol_failed_reduce"))}</span></label>
          <label class="checkbox-line"><input name="alcohol_drinks_alone" type="checkbox" value="1" ${alcohol.drinksAlone ? "checked" : ""}><span>${esc(t("recovery_assistant.alcohol_drinks_alone"))}</span></label>
        </div>
        <div class="pill-grid checkbox-pill-grid">
          ${list("recovery_assistant.withdrawal_options").map((option) => `
            <label class="pill ${withdrawal[option.code] ? "selected" : ""}">
              <input type="checkbox" name="withdrawal_${esc(option.code)}" value="1" ${withdrawal[option.code] ? "checked" : ""}>
              ${esc(option.title)}
            </label>`).join("")}
        </div>
        <div class="pill-grid checkbox-pill-grid">
          ${list("recovery_assistant.alcohol_context_options").map((option) => `
            <label class="pill ${Array.isArray(alcohol.mainContext) && alcohol.mainContext.includes(option.code) ? "selected" : ""}">
              <input type="checkbox" name="alcohol_contexts" value="${esc(option.code)}" ${Array.isArray(alcohol.mainContext) && alcohol.mainContext.includes(option.code) ? "checked" : ""}>
              ${esc(option.title)}
            </label>`).join("")}
        </div>` : ""}
    </div>`;
}

function recoveryProfileFromSettings(form, data = state.dashboard) {
  const previous = loadRecoveryStore(data).recoveryProfile;
  const smoking = {
    ...previous.smoking,
    firstCigaretteAfterWake: String(form.get("first_cigarette_after_wake") || previous.smoking.firstCigaretteAfterWake || "31_60"),
    hardInForbiddenPlaces: form.get("hard_in_forbidden_places") === "1",
    mostImportantCigarette: String(form.get("most_important_cigarette") || previous.smoking.mostImportantCigarette || "stress"),
    smokesWhenIll: form.get("smokes_when_ill") === "1"
  };
  const alcohol = {
    ...previous.alcohol,
    frequency: String(form.get("alcohol_frequency") || previous.alcohol.frequency || "weekly"),
    amountTypical: String(form.get("alcohol_amount_typical") || previous.alcohol.amountTypical || "moderate"),
    binges: form.get("alcohol_binges") === "1",
    failedToReduce: form.get("alcohol_failed_reduce") === "1",
    drinksAlone: form.get("alcohol_drinks_alone") === "1",
    mainContext: form.getAll("alcohol_contexts").map(String),
    withdrawalSymptoms: {
      tremor: form.get("withdrawal_tremor") === "1",
      sweating: form.get("withdrawal_sweating") === "1",
      anxiety: form.get("withdrawal_anxiety") === "1",
      insomnia: form.get("withdrawal_insomnia") === "1",
      palpitations: form.get("withdrawal_palpitations") === "1"
    }
  };

  return {
    ...previous,
    addictionTypes: Array.isArray(data?.habit_types) ? data.habit_types : previous.addictionTypes,
    mode: String(form.get("recovery_mode") || previous.mode || "quit_now"),
    smoking,
    alcohol,
    updatedAt: new Date().toISOString()
  };
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

  if (key === "mode") {
    app.querySelectorAll("[data-recovery-mode]").forEach((button) => {
      button.addEventListener("click", () => {
        state.onboarding.recovery_mode = button.dataset.recoveryMode || "quit_now";
        state.error = "";
        renderOnboarding();
      });
    });
  }

  if (key === "reason") {
    app.querySelectorAll("[data-onboarding-reason]").forEach((input) => {
      input.addEventListener("change", () => {
        const reason = input.value;
        state.onboarding.motivation_reasons = input.checked
          ? [...new Set([...state.onboarding.motivation_reasons, reason])]
          : state.onboarding.motivation_reasons.filter((item) => item !== reason);
        state.onboarding.main_reason = state.onboarding.motivation_reasons[0] || "";
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
    app.querySelectorAll("[data-onboarding-smoking-product]").forEach((input) => input.addEventListener("change", () => {
      state.onboarding.smoking_product = input.value === "vape" ? "vape" : "tobacco";
      renderOnboarding();
    }));
    app.querySelector("#cigarettesPerDay")?.addEventListener("input", (event) => state.onboarding.cigarettes_per_day = Number(event.target.value || 0));
    app.querySelector("#cigarettesPerPack")?.addEventListener("input", (event) => state.onboarding.cigarettes_per_pack = Number(event.target.value || 20));
    app.querySelector("#packPrice")?.addEventListener("input", (event) => state.onboarding.pack_price = Number(event.target.value || 0));
    app.querySelector("#vapeWeeklySpend")?.addEventListener("input", (event) => state.onboarding.vape_weekly_spend = Number(event.target.value || 0));
    app.querySelector("#firstCigaretteAfterWake")?.addEventListener("change", (event) => state.onboarding.first_cigarette_after_wake = event.target.value);
    app.querySelector("#mostImportantCigarette")?.addEventListener("change", (event) => state.onboarding.most_important_cigarette = event.target.value);
    app.querySelector("#hardForbiddenPlaces")?.addEventListener("change", (event) => state.onboarding.hard_in_forbidden_places = event.target.checked);
    app.querySelector("#smokesWhenIll")?.addEventListener("change", (event) => state.onboarding.smokes_when_ill = event.target.checked);
  }

  if (key === "alcohol") {
    app.querySelector("#alcoholWeeklySpend")?.addEventListener("input", (event) => state.onboarding.alcohol_weekly_spend = Number(event.target.value || 0));
    app.querySelector("#alcoholFrequency")?.addEventListener("change", (event) => state.onboarding.alcohol_frequency = event.target.value);
    app.querySelector("#alcoholAmountTypical")?.addEventListener("change", (event) => state.onboarding.alcohol_amount_typical = event.target.value);
    app.querySelector("#alcoholBinges")?.addEventListener("change", (event) => state.onboarding.alcohol_binges = event.target.checked);
    app.querySelector("#alcoholFailedReduce")?.addEventListener("change", (event) => state.onboarding.alcohol_failed_to_reduce = event.target.checked);
    app.querySelector("#alcoholDrinksAlone")?.addEventListener("change", (event) => state.onboarding.alcohol_drinks_alone = event.target.checked);
    app.querySelectorAll("[data-withdrawal]").forEach((button) => {
      button.addEventListener("click", () => {
        const code = button.dataset.withdrawal;
        state.onboarding.alcohol_withdrawal[code] = !state.onboarding.alcohol_withdrawal[code];
        renderOnboarding();
      });
    });
    app.querySelectorAll("[data-alcohol-context]").forEach((button) => {
      button.addEventListener("click", () => {
        const code = button.dataset.alcoholContext;
        state.onboarding.alcohol_contexts = state.onboarding.alcohol_contexts.includes(code)
          ? state.onboarding.alcohol_contexts.filter((item) => item !== code)
          : [...state.onboarding.alcohol_contexts, code];
        renderOnboarding();
      });
    });
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
  if (key === "reason" && state.onboarding.motivation_reasons.length === 0) {
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
    const store = defaultRecoveryStore(data.dashboard);
    store.recoveryProfile = profileFromOnboarding();
    saveRecoveryStore(store, data.dashboard.user.id);
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
  const smoking = hasSmoking
    ? (state.onboarding.smoking_product === "vape"
      ? Number(state.onboarding.vape_weekly_spend || 0) / 7
      : (Number(state.onboarding.cigarettes_per_day || 0) / Math.max(1, Number(state.onboarding.cigarettes_per_pack || 20))) * Number(state.onboarding.pack_price || 0))
    : 0;
  const alcohol = hasAlcohol ? Number(state.onboarding.alcohol_weekly_spend || 0) / 7 : 0;
  const day = smoking + alcohol;
  return { day, week: day * 7, month: day * 30 };
}

function summaryHabits() {
  const habits = state.onboarding.habits;
  const isVape = state.onboarding.smoking_product === "vape";
  if (habits.includes("smoking") && habits.includes("alcohol")) return t(isVape ? "habits.vape_and_alcohol" : "habits.tobacco_and_alcohol");
  if (habits.includes("smoking")) return t(isVape ? "habits.vape" : "habits.tobacco");
  return t("habits.alcohol");
}

function summaryReason() {
  const options = list("onboarding.reason_options");
  return state.onboarding.motivation_reasons.map((reason) => {
    if (reason === "custom") return state.onboarding.custom_reason || t("onboarding.custom_reason");
    return options.find((item) => item.code === reason)?.title || reason;
  }).join(" · ");
}

function dashboardSmokingUi(data) {
  const isVape = data?.habits?.smoking?.smoking_product === "vape";
  return {
    isVape,
    icon: isVape ? "vape" : "smoke",
    token: isVape ? "token-blue" : "token-red",
    habitKey: isVape ? "habits.vape" : "habits.tobacco",
    withoutKey: isVape ? "dashboard.without_vape" : "dashboard.without_smoking",
    cleanKey: isVape ? "dashboard.mark_vape_clean" : "dashboard.mark_smoke_clean",
    incidentKey: isVape ? "incident.vaped" : "incident.smoked"
  };
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
  const smokingUi = dashboardSmokingUi(data);
  const currency = data.money.goal.currency || "EUR";
  const missions = data.missions || [];
  const missionSummary = data.missions_summary || { completed: 0, total: missions.length, percent: 0 };
  const recoveryStore = loadRecoveryStore(data);
  const startupRisk = startupRiskScore(recoveryStore.recoveryProfile);
  const dailyRisk = calculateDailyRisk(recoveryStore.recoveryProfile, recoveryStore.dailyCheckins, recoveryStore.incidents, new Date());
  const healthReactor = calculateHealthReactor(data, recoveryStore);

  app.innerHTML = `
    <div class="topbar">
      ${renderBrand(true)}
      <div class="top-actions">
        <button class="secondary-button journal-button notification-anchor" id="socialBtn" type="button">${icon("users")}<span>${esc(t("social.button"))}</span><b class="unread-badge" data-social-unread hidden>0</b></button>
        <button class="secondary-button journal-button" id="journalBtn" type="button">${icon("star")}<span>${esc(t("dashboard.journal_button"))}</span></button>
        <button class="icon-button notification-anchor" id="notificationBtn" type="button" aria-label="${esc(t("social.notifications"))}">${icon("bell")}<b class="unread-badge" data-social-unread hidden>0</b></button>
        <button class="profile-button" id="settingsBtn" aria-label="${esc(t("settings.title"))}" title="${esc(t("settings.title"))}">
          ${avatarMarkup(data.user.name, data.user.avatar_code, "", data.user.id, data.user.has_avatar)}
          <span class="profile-level">${esc(t("progression.level_short", { level: progression.level }))}</span>
        </button>
        <button class="icon-button" id="logoutBtn" aria-label="${esc(t("settings.logout"))}">${icon("log-out")}</button>
      </div>
    </div>
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
          <p class="hero-quote personalized-quote"><span>${esc(t("dashboard.personal_signal"))}</span>${esc(personalizedMentorPhrase())}</p>
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

      ${renderRecoveryVisual(data)}

      ${renderMedicalRiskBanner(startupRisk)}

      ${renderDailyRiskPanel(dailyRisk)}

      ${renderReductionPlanPanel(data, recoveryStore, startupRisk)}

      ${renderChainProtectionPanel(dailyRisk, recoveryStore)}

      ${renderMentorPanel(data, recoveryStore, dailyRisk)}

      ${renderImpulsePanel(data)}

      ${renderGrowthPanels(data, currency, motion)}

      ${renderHealthReactorPanel(healthReactor)}

      ${renderMissionPanel(data)}

      <section class="stat-grid">
        ${hasSmoking ? statCard(smokingUi.icon, smokingUi.token, t(smokingUi.withoutKey), duration(data.habits.smoking.hours), t("dashboard.series_days", { days: data.habits.smoking.days })) : ""}
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
        <section class="panel daily-check-panel">
          <div class="section-head">
            <div><p class="eyebrow">${esc(t("dashboard.daily_kicker"))}</p><h3>${esc(t("dashboard.today"))}</h3></div>
            <span class="badge">${esc(t("dashboard.checkin"))}</span>
          </div>
          <div class="check-grid">
            ${hasSmoking ? `<button class="secondary-button" data-checkin="smoke">${icon(smokingUi.icon)}${esc(t(smokingUi.cleanKey))}</button>` : ""}
            ${hasAlcohol ? `<button class="secondary-button" data-checkin="alcohol">${icon("alcohol")}${esc(t("dashboard.mark_alcohol_clean"))}</button>` : ""}
          </div>
          <div style="height:10px"></div>
          <div class="incident-grid">
            ${hasSmoking ? `<button class="danger-button" data-incident="smoking">${icon(smokingUi.icon)}${esc(t(smokingUi.incidentKey))}</button>` : ""}
            ${hasAlcohol ? `<button class="danger-button" data-incident="alcohol">${icon("alcohol")}${esc(t("incident.drank"))}</button>` : ""}
          </div>
        </section>
      </section>

      ${renderInsightsPanel(data)}

      <section class="panel">
        <div class="section-head"><div><p class="eyebrow">${esc(t("dashboard.treats_kicker"))}</p><h3>${esc(t("dashboard.treats_title"))}</h3></div></div>
        <div class="money-reframe treat-reframe">
          <span class="icon-token token-green">${icon("money")}</span>
          <p>${esc(t("dashboard.money_reframe", { days: Number(data.reactor.control_days || 0), amount: money(data.money.saved_total, currency), target: oldHabitSpendTarget(data) }))}</p>
        </div>
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
    ${dashboardNoticeToast()}
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
  app.querySelectorAll("[data-mission-action]").forEach((button) => button.addEventListener("click", () => handleMissionAction(button.dataset.missionAction)));
  app.querySelectorAll("[data-impulse-action]").forEach((button) => button.addEventListener("click", () => handleImpulseAction(button.dataset.impulseAction)));
  app.querySelectorAll("[data-risk-action]").forEach((button) => button.addEventListener("click", () => handleRiskAction(button.dataset.riskAction)));
  app.querySelectorAll("[data-chain-action]").forEach((button) => button.addEventListener("click", () => handleChainAction(button.dataset.chainAction)));
  app.querySelectorAll("[data-mentor-topic]").forEach((button) => button.addEventListener("click", () => openMentorModal(button.dataset.mentorTopic)));
  app.querySelectorAll("[data-recovery-system]").forEach((button) => button.addEventListener("click", () => openRecoverySystemModal(button.dataset.recoverySystem)));
  app.querySelector("#dailyCheckinDetailed")?.addEventListener("click", openDailyCheckinModal);
  app.querySelector("#chainProtectionSos")?.addEventListener("click", openCraving);
  app.querySelector("#mobileHome").addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
  app.querySelector("#mobileProgress").addEventListener("click", () => app.querySelector(".progression-panel")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  app.querySelector("#mobileSocial").addEventListener("click", () => openSocialModal("feed"));
  app.querySelector("#mobileProfile").addEventListener("click", () => { state.screen = "settings"; state.notice = ""; render(); });
  app.querySelector("#dismissDashboardNotice")?.addEventListener("click", () => {
    state.notice = "";
    render();
  });
  animateDashboardProgress(data, motion, currency);
  scheduleNoticeClear();
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

function renderMedicalRiskBanner(risk) {
  const stateName = risk.state || "normal";
  return `
    <section class="medical-risk-banner risk-${esc(stateName)}">
      <span class="risk-orb">${icon("shield")}</span>
      <div>
        <p class="eyebrow">${esc(t("recovery_assistant.medical_kicker"))}</p>
        <strong>${esc(t(`recovery_assistant.medical_${stateName}_title`))}</strong>
        <span>${esc(t(`recovery_assistant.medical_${stateName}_body`))}</span>
      </div>
      <b>${esc(t("recovery_assistant.risk_score", { score: risk.score }))}</b>
    </section>`;
}

function renderDailyRiskPanel(risk) {
  const factors = risk.factors.length ? risk.factors : [t("recovery_assistant.factor_no_data")];
  return `
    <section class="panel daily-risk-panel risk-${esc(risk.level)}">
      <div class="section-head">
        <div>
          <p class="eyebrow">${esc(t("recovery_assistant.daily_risk_kicker"))}</p>
          <h3>${esc(t("recovery_assistant.daily_risk_title"))}</h3>
        </div>
        <span class="risk-level-badge">${esc(t(`recovery_assistant.risk_${risk.level}`))}</span>
      </div>
      <div class="daily-risk-layout">
        <div class="risk-meter" style="--risk-score:${risk.score}%">
          <strong>${esc(risk.score)}</strong>
          <span>${esc(t("recovery_assistant.risk_points"))}</span>
        </div>
        <div class="risk-copy">
          <p>${esc(risk.recommendation)}</p>
          <div class="risk-factor-list">
            ${factors.map((factor) => `<span>${esc(factor)}</span>`).join("")}
          </div>
          <div class="risk-actions">
            <button class="primary-button" type="button" data-risk-action="sos">${icon("shield")}${esc(t("recovery_assistant.enable_protection"))}</button>
            <button class="secondary-button" type="button" id="dailyCheckinDetailed">${icon("star")}${esc(t("recovery_assistant.checkin_button"))}</button>
          </div>
        </div>
      </div>
    </section>`;
}

function renderReductionPlanPanel(data, store, startupRisk) {
  const plan = buildReductionPlan(data, store, startupRisk);
  return `
    <section class="panel reduction-plan-panel mode-${esc(plan.mode)}">
      <div class="section-head">
        <div>
          <p class="eyebrow">${esc(t("recovery_assistant.reduction_kicker"))}</p>
          <h3>${esc(plan.title)}</h3>
        </div>
        <span class="badge">${esc(t(`recovery_assistant.reduction_mode_${plan.mode}`))}</span>
      </div>
      <div class="reduction-plan-layout">
        <div class="reduction-limit ${esc(plan.token)}">
          <span>${icon("reactor")}</span>
          <strong>${esc(plan.today.value)}</strong>
          <small>${esc(plan.today.unit)}</small>
        </div>
        <div class="reduction-plan-copy">
          <p>${esc(plan.body)}</p>
          <div class="reduction-next">${icon("bolt")}<span>${esc(plan.next)}</span></div>
        </div>
      </div>
      <div class="reduction-steps">
        ${plan.steps.map((step, index) => `
          <span class="${step.active ? "active" : ""}"><b>${index + 1}</b>${esc(step.title)}</span>`).join("")}
      </div>
    </section>`;
}

function renderChainProtectionPanel(risk, store) {
  const chain = chainProtectionState(risk, store);
  if (!chain.shouldShow) return "";
  const habitType = chain.incident?.habitType || state.dashboard?.habit_types?.[0] || "smoking";
  const activeActions = chainActionOptions(habitType);

  if (chain.active) {
    const until = chain.until ? dateTime(chain.until.toISOString()) : "";
    return `
      <section class="panel chain-protection-panel chain-active">
        <div class="section-head">
          <div>
            <p class="eyebrow">${esc(t("recovery_assistant.chain_kicker"))}</p>
            <h3>${esc(t("recovery_assistant.chain_stop_title"))}</h3>
          </div>
          <span class="badge">${esc(t("recovery_assistant.chain_active_badge"))}</span>
        </div>
        <div class="chain-alert">
          <span class="icon-token token-red">${icon("shield")}</span>
          <div>
            <strong>${esc(t(`recovery_assistant.chain_stop_${habitType === "alcohol" ? "alcohol" : dashboardSmokingUi(state.dashboard).isVape ? "vape" : "smoking"}`))}</strong>
            <p>${esc(t("recovery_assistant.chain_stop_body", { until }))}</p>
          </div>
        </div>
        <div class="chain-action-grid">
          ${activeActions.map((action) => `
            <button class="chain-action ${chain.completed.has(action.code) ? "done" : ""}" type="button" data-chain-action="${esc(action.code)}">
              ${icon(chain.completed.has(action.code) ? "shield" : action.icon)}
              <span>${esc(action.label)}</span>
            </button>`).join("")}
        </div>
      </section>`;
  }

  return `
    <section class="panel chain-protection-panel">
      <div class="section-head">
        <div>
          <p class="eyebrow">${esc(t("recovery_assistant.chain_kicker"))}</p>
          <h3>${esc(t("recovery_assistant.chain_title"))}</h3>
        </div>
        <span class="badge">${esc(t("recovery_assistant.chain_badge"))}</span>
      </div>
      <p class="muted">${esc(t("recovery_assistant.chain_high_risk"))}</p>
      <div class="chain-steps">
        ${list("recovery_assistant.chain_steps").map((step) => `
          <div><span class="icon-token ${esc(step.token || "token-blue")}">${icon(step.icon || "shield")}</span><strong>${esc(step.title)}</strong><small>${esc(step.body)}</small></div>`).join("")}
      </div>
      <button class="secondary-button full" type="button" id="chainProtectionSos">${icon("shield")}${esc(t("recovery_assistant.chain_button"))}</button>
    </section>`;
}

function renderMentorPanel(data, store, risk) {
  const topics = mentorTopics();
  const checkins = Array.isArray(store.dailyCheckins) ? store.dailyCheckins : [];
  const latest = checkins.slice(-1)[0];
  const signal = latest
    ? t("mentor.signal_checkin", { stress: latest.stress || 0, craving: latest.craving || 0 })
    : t("mentor.signal_empty");

  return `
    <section class="panel mentor-panel risk-${esc(risk.level)}">
      <div class="section-head">
        <div>
          <p class="eyebrow">${esc(t("mentor.kicker"))}</p>
          <h3>${esc(t("mentor.title"))}</h3>
        </div>
        <span class="badge">${esc(t(`recovery_assistant.risk_${risk.level}`))}</span>
      </div>
      <p class="mentor-lead">${esc(t("mentor.subtitle"))}</p>
      <div class="mentor-signal">${icon("reactor")}<span>${esc(signal)}</span></div>
      <div class="mentor-topic-grid">
        ${topics.map((topic) => `
          <button class="mentor-topic" type="button" data-mentor-topic="${esc(topic.code)}">
            ${icon(topic.icon)}
            <span>${esc(t(`mentor.topics.${topic.code}`))}</span>
          </button>`).join("")}
      </div>
    </section>`;
}

function renderHealthReactorPanel(reactor) {
  const items = [
    ["money", "money", "token-green"],
    ["energy", "bolt", "token-blue"],
    ["control", "shield", "token-violet"],
    ["health", "heart", "token-red"]
  ];

  return `
    <section class="panel health-reactor-panel">
      <div class="section-head">
        <div>
          <p class="eyebrow">${esc(t("recovery_assistant.health_reactor_kicker"))}</p>
          <h3>${esc(t("recovery_assistant.health_reactor_title"))}</h3>
        </div>
        <span class="badge">${esc(t("recovery_assistant.health_reactor_badge"))}</span>
      </div>
      <div class="health-reactor-grid">
        ${items.map(([code, iconName, token]) => `
          <div class="health-reactor-card" style="--reactor-value:${reactor[code] || 0}%">
            <span class="icon-token ${token}">${icon(iconName)}</span>
            <div>
              <strong>${esc(t(`recovery_assistant.health_${code}`))}</strong>
              <small>${esc(t(`recovery_assistant.health_${code}_body`))}</small>
              <div class="health-reactor-track"><i></i></div>
            </div>
            <b>${esc(reactor[code] || 0)}%</b>
          </div>`).join("")}
      </div>
      <p class="health-reactor-note">${esc(t("recovery_assistant.health_reactor_note"))}</p>
    </section>`;
}

function handleRiskAction(action) {
  if (action === "sos") {
    openCraving();
  }
}

function handleChainAction(action) {
  const store = loadRecoveryStore(state.dashboard);
  const dailyRisk = calculateDailyRisk(store.recoveryProfile, store.dailyCheckins, store.incidents, new Date());
  const chain = chainProtectionState(dailyRisk, store);
  const incident = chain.incident;
  const date = localDateKey();

  updateRecoveryStore((current) => {
    const already = current.protectionProtocols.some((item) => (
      item.code === action
      && (incident ? item.incidentId === incident.id : item.date === date)
    ));
    if (already) return current;
    return {
      ...current,
      protectionProtocols: [
        ...current.protectionProtocols,
        {
          id: `protocol_${Date.now()}_${action}`,
          code: action,
          incidentId: incident?.id || null,
          habitType: incident?.habitType || state.dashboard?.habit_types?.[0] || "smoking",
          date,
          createdAt: new Date().toISOString()
        }
      ].slice(-120)
    };
  });

  if (action === "timer") {
    openChainTimerModal();
    return;
  }

  state.notice = t("recovery_assistant.chain_action_saved");
  render();
}

function openChainTimerModal() {
  clearInterval(chainTimer);
  let remaining = 10 * 60;
  const renderTime = () => formatTimer(remaining);

  modalRoot.innerHTML = `
    <div class="modal chain-timer-overlay" role="dialog" aria-modal="true" aria-labelledby="chainTimerTitle">
      <div class="modal-card chain-timer-modal">
        <button class="icon-button close-button" id="closeChainTimer" type="button" aria-label="${esc(t("common.close"))}">${icon("x")}</button>
        <p class="eyebrow">${esc(t("recovery_assistant.chain_kicker"))}</p>
        <h2 id="chainTimerTitle">${esc(t("recovery_assistant.chain_timer_title"))}</h2>
        <p class="muted">${esc(t("recovery_assistant.chain_timer_body"))}</p>
        <div class="chain-timer-orb">
          <i aria-hidden="true"></i>
          <strong id="chainTimerValue">${esc(renderTime())}</strong>
          <span>${esc(t("recovery_assistant.chain_timer_label"))}</span>
        </div>
        <button class="primary-button full" id="finishChainTimer" type="button">${esc(t("recovery_assistant.chain_timer_finish"))}</button>
      </div>
    </div>`;

  const value = modalRoot.querySelector("#chainTimerValue");
  chainTimer = window.setInterval(() => {
    remaining = Math.max(0, remaining - 1);
    if (value) value.textContent = renderTime();
    if (remaining <= 0) {
      clearInterval(chainTimer);
      state.notice = t("recovery_assistant.chain_timer_done");
      closeModal();
      render();
    }
  }, 1000);

  modalRoot.querySelector("#closeChainTimer").addEventListener("click", closeModal);
  modalRoot.querySelector("#finishChainTimer").addEventListener("click", () => {
    state.notice = t("recovery_assistant.chain_timer_done");
    closeModal();
    render();
  });
}

function openMentorModal(topic) {
  const store = loadRecoveryStore(state.dashboard);
  const response = mentorResponse(topic, state.dashboard, store);
  modalRoot.innerHTML = `
    <div class="modal mentor-overlay" role="dialog" aria-modal="true" aria-labelledby="mentorTitle">
      <div class="modal-card mentor-modal">
        <button class="icon-button close-button" id="closeMentor" type="button" aria-label="${esc(t("common.close"))}">${icon("x")}</button>
        <div class="mentor-core" aria-hidden="true">${icon("reactor")}</div>
        <p class="eyebrow">${esc(t("mentor.kicker"))}</p>
        <h2 id="mentorTitle">${esc(response.title)}</h2>
        <p class="mentor-response">${esc(response.body)}</p>
        <div class="mentor-step-list">
          ${response.steps.map((step, index) => `<span><b>${index + 1}</b>${esc(step)}</span>`).join("")}
        </div>
        <div class="mentor-actions">
          <button class="primary-button" id="mentorOpenSos" type="button">${icon("shield")}${esc(t("mentor.open_sos"))}</button>
          <button class="secondary-button" id="mentorCheckin" type="button">${icon("star")}${esc(t("mentor.open_checkin"))}</button>
        </div>
      </div>
    </div>`;

  modalRoot.querySelector("#closeMentor").addEventListener("click", closeModal);
  modalRoot.querySelector("#mentorOpenSos").addEventListener("click", () => {
    closeModal();
    openCraving();
  });
  modalRoot.querySelector("#mentorCheckin").addEventListener("click", () => {
    closeModal();
    openDailyCheckinModal();
  });
}

function openDailyCheckinModal() {
  const store = loadRecoveryStore(state.dashboard);
  const today = localDateKey();
  const existing = store.dailyCheckins.find((item) => item.date === today) || {};
  const fields = ["sleep", "energy", "mood", "stress", "craving"];
  const value = (field) => Number(existing[field] || (field === "stress" || field === "craving" ? 4 : 6));

  modalRoot.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true">
      <div class="modal-card daily-checkin-modal">
        <button class="icon-button close-button" id="closeModal">${icon("x")}</button>
        <p class="eyebrow">${esc(t("recovery_assistant.checkin_kicker"))}</p>
        <h2>${esc(t("recovery_assistant.checkin_title"))}</h2>
        <p class="muted">${esc(t("recovery_assistant.checkin_body"))}</p>
        <form id="detailedCheckinForm" class="checkin-slider-list">
          ${fields.map((field) => `
            <label>
              <span><strong>${esc(t(`recovery_assistant.checkin_${field}`))}</strong><b data-checkin-value="${field}">${value(field)}</b></span>
              <input type="range" min="1" max="10" value="${value(field)}" name="${field}" data-checkin-range="${field}">
            </label>`).join("")}
          <label>${esc(t("recovery_assistant.checkin_notes"))}<textarea name="notes" rows="3">${esc(existing.notes || "")}</textarea></label>
          <button class="primary-button full" type="submit">${esc(t("recovery_assistant.checkin_save"))}</button>
        </form>
      </div>
    </div>`;

  modalRoot.querySelector("#closeModal").addEventListener("click", closeModal);
  modalRoot.querySelectorAll("[data-checkin-range]").forEach((input) => {
    input.addEventListener("input", () => {
      const out = modalRoot.querySelector(`[data-checkin-value="${input.dataset.checkinRange}"]`);
      if (out) out.textContent = input.value;
    });
  });
  modalRoot.querySelector("#detailedCheckinForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const entry = {
      id: existing.id || `checkin_${Date.now()}`,
      date: today,
      sleep: Number(form.get("sleep") || 5),
      energy: Number(form.get("energy") || 5),
      mood: Number(form.get("mood") || 5),
      stress: Number(form.get("stress") || 5),
      craving: Number(form.get("craving") || 5),
      notes: String(form.get("notes") || ""),
      createdAt: existing.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    updateRecoveryStore((current) => ({
      ...current,
      dailyCheckins: [...current.dailyCheckins.filter((item) => item.date !== today), entry].slice(-45),
      healthReactor: calculateHealthReactor(state.dashboard, { ...current, dailyCheckins: [...current.dailyCheckins.filter((item) => item.date !== today), entry] })
    }));
    state.notice = t("recovery_assistant.checkin_saved");
    closeModal();
    render();
  });
}

function recoverySystemProgress(hours, targetHours) {
  const ratio = Math.min(1, Math.max(0, Number(hours || 0)) / Math.max(1, Number(targetHours || 1)));
  return Math.round(Math.sqrt(ratio) * 100);
}

function recoveryVisualModel(data) {
  const hours = Number(data.reactor?.control_hours || 0);
  const hasSmoking = data.habit_types.includes("smoking");
  const hasAlcohol = data.habit_types.includes("alcohol");
  const isVape = dashboardSmokingUi(data).isVape;
  const mode = hasSmoking && hasAlcohol ? "both" : hasSmoking ? (isVape ? "vape" : "smoking") : "alcohol";
  const targets = {
    smoking: { brain: 168, lungs: 720, heart: 8760, detox: 72, immunity: 336, sleep: 336 },
    vape: { brain: 168, lungs: 720, heart: 8760, detox: 168, immunity: 336, sleep: 336 },
    alcohol: { brain: 168, lungs: 336, heart: 720, detox: 168, immunity: 336, sleep: 168 },
    both: { brain: 168, lungs: 720, heart: 8760, detox: 168, immunity: 336, sleep: 168 }
  };
  const catalog = [
    ["brain", "brain"],
    ["lungs", "lungs"],
    ["heart", "heart"],
    ["detox", "leaf"],
    ["immunity", "shield"],
    ["sleep", "moon"]
  ];
  const systems = catalog.map(([code, iconName], index) => ({
    code,
    icon: iconName,
    progress: recoverySystemProgress(hours, targets[mode][code] || 336),
    side: index < 3 ? "left" : "right"
  }));
  const progress = Math.round(systems.reduce((sum, system) => sum + system.progress, 0) / systems.length);
  const stage = hours < 24 ? "start" : hours < 72 ? "cleaning" : hours < 168 ? "adaptation" : hours < 720 ? "stability" : "momentum";
  const lead = systems.reduce((best, system) => system.progress > best.progress ? system : best, systems[0]);

  return { hours, mode, systems, progress, stage, lead, hasSmoking, hasAlcohol };
}

function recoveryNextSystem(model) {
  const pending = [...model.systems].filter((system) => system.progress < 100).sort((a, b) => a.progress - b.progress);
  return pending[0] || model.lead;
}

function recoveryMotivationCards(model) {
  const lead = model.lead || model.systems[0];
  const next = recoveryNextSystem(model);
  return [
    {
      code: lead.code,
      icon: lead.icon,
      title: t("health_visual.active_change"),
      body: t(`health_visual.systems.${lead.code}.body`),
      value: t("health_visual.stage_percent", { percent: lead.progress })
    },
    {
      code: next.code,
      icon: next.icon,
      title: t("health_visual.next_focus"),
      body: t("health_visual.next_focus_body", { system: t(`health_visual.systems.${next.code}.title`) }),
      value: t("health_visual.stage_percent", { percent: next.progress })
    }
  ];
}

function renderRecoveryVisual(data) {
  const model = recoveryVisualModel(data);
  const nodePositions = [
    ["14%", "20%"],
    ["74%", "18%"],
    ["82%", "50%"],
    ["67%", "78%"],
    ["23%", "78%"],
    ["8%", "50%"]
  ];
  const recoveryMetrics = model.systems.map((system, index) => ({
    id: system.code,
    icon: system.icon,
    label: t(`health_visual.systems.${system.code}.title`),
    value: system.progress,
    x: nodePositions[index]?.[0] || "50%",
    y: nodePositions[index]?.[1] || "50%"
  }));
  const motivationCards = recoveryMotivationCards(model);
  const next = recoveryNextSystem(model);

  return `
    <section class="panel recovery-visual-panel recovery-reference-panel" style="--recovery-percent:${model.progress}%">
      <div class="recovery-contour-card">
        <div class="recovery-reference-head">
          <p class="eyebrow">${esc(t("health_visual.kicker"))}</p>
          <h3>${esc(t("health_visual.title"))}</h3>
          <span class="mode-pill">${icon("reactor")}${esc(t(`health_visual.mode_${model.mode}`))}</span>
        </div>

        <div class="recovery-contour-layout">
          <div class="recovery-support-column">
            <div class="recovery-support-visual" aria-label="${esc(t("health_visual.figure_label"))}">
              <div class="support-grid-layer" aria-hidden="true"></div>
              <div class="support-orbit-rings" aria-hidden="true"><span></span><span></span><span></span></div>
              <div class="support-pulse-line" aria-hidden="true"></div>
              <div class="support-core" aria-hidden="true">
                <span class="meter-reactor-glow" aria-hidden="true"><i></i><i></i><i></i></span>
                <span class="support-core-icon">${icon("reactor")}</span>
                <strong>${model.progress}<small>%</small></strong>
                <em>${esc(t("health_visual.support_progress"))}</em>
              </div>
              <div class="support-node-cloud">
                ${recoveryMetrics.map((metric, index) => `
                  <button
                    class="support-system-node health-system-${esc(metric.id)}"
                    type="button"
                    data-recovery-system="${esc(metric.id)}"
                    style="--node-x:${esc(metric.x)};--node-y:${esc(metric.y)};--system-progress:${metric.value / 100};--node-delay:${index * -.45}s"
                  >
                    <span>${icon(metric.icon)}</span>
                    <b>${esc(metric.value)}%</b>
                    <small>${esc(metric.label)}</small>
                  </button>`).join("")}
              </div>
            </div>
            <div class="support-focus-card">
              <span class="icon-token">${icon(next.icon)}</span>
              <div>
                <small>${esc(t("health_visual.next_focus"))}</small>
                <strong>${esc(t(`health_visual.systems.${next.code}.title`))}</strong>
                <p>${esc(t("health_visual.next_focus_body", { system: t(`health_visual.systems.${next.code}.title`) }))}</p>
              </div>
            </div>
          </div>

          <aside class="recovery-contour-ui">
            <div class="recovery-progress-card">
              <span>${icon("bolt")}${esc(t("health_visual.progress_card"))}</span>
              <strong>${esc(duration(model.hours))}</strong>
              <small>${esc(t("health_visual.now"))}</small>
            </div>

            <div class="recovery-motivation-stack">
              ${motivationCards.map((card) => `
                <button class="recovery-motivation-card" type="button" data-recovery-system="${esc(card.code)}">
                  <span class="icon-token">${icon(card.icon)}</span>
                  <div>
                    <strong>${esc(card.title)}</strong>
                    <p>${esc(card.body)}</p>
                  </div>
                  <b>${esc(card.value)}</b>
                </button>`).join("")}
            </div>

            <div class="recovery-system-list">
              ${recoveryMetrics.map((metric) => `
                <button class="recovery-system-row health-system-${esc(metric.id)}" type="button" data-recovery-system="${esc(metric.id)}" style="--system-progress:${metric.value / 100}">
                  <span class="icon-token">${icon(metric.icon)}</span>
                  <div class="recovery-system-copy">
                    <div><strong>${esc(metric.label)}</strong><span>${esc(t("health_visual.stage_percent", { percent: metric.value }))}</span></div>
                    <div class="recovery-system-track"><i></i></div>
                    <small>${esc(t("health_visual.open_system"))}</small>
                  </div>
                </button>`).join("")}
            </div>
          </aside>
        </div>

        <div class="recovery-reference-summary">
          <span class="stage-upgrade">${icon("bolt")}</span>
          <div class="stage-copy">
            <strong>${esc(t(`health_visual.stages.${model.stage}`))}</strong>
            <p>${esc(t(`health_visual.mode_body_${model.mode}`))}</p>
          </div>
        </div>
      </div>
    </section>`;
}

function openRecoverySystemModal(systemCode) {
  const model = recoveryVisualModel(state.dashboard);
  const system = model.systems.find((item) => item.code === systemCode) || model.lead || model.systems[0];
  const tips = list(`health_visual.system_actions.${system.code}`);
  modalRoot.innerHTML = `
    <div class="modal recovery-system-overlay" role="dialog" aria-modal="true" aria-labelledby="recoverySystemTitle">
      <div class="modal-card recovery-system-modal health-system-${esc(system.code)}">
        <button class="icon-button close-button" id="closeRecoverySystem" type="button" aria-label="${esc(t("common.close"))}">${icon("x")}</button>
        <div class="recovery-system-orb" style="--system-progress:${system.progress / 100}">
          ${icon(system.icon)}
          <strong>${esc(t("health_visual.stage_percent", { percent: system.progress }))}</strong>
        </div>
        <p class="eyebrow">${esc(t("health_visual.system_modal_kicker"))}</p>
        <h2 id="recoverySystemTitle">${esc(t(`health_visual.systems.${system.code}.title`))}</h2>
        <p class="mentor-response">${esc(t(`health_visual.systems.${system.code}.body`))}</p>
        <div class="mentor-step-list">
          ${(tips.length ? tips : list("health_visual.system_actions.fallback")).map((tip, index) => `<span><b>${index + 1}</b>${esc(tip)}</span>`).join("")}
        </div>
        <button class="primary-button full" id="recoverySystemDone" type="button">${esc(t("health_visual.system_done"))}</button>
      </div>
    </div>`;

  modalRoot.querySelector("#closeRecoverySystem").addEventListener("click", closeModal);
  modalRoot.querySelector("#recoverySystemDone").addEventListener("click", () => {
    state.notice = t("health_visual.system_notice");
    closeModal();
    render();
  });
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
  const cleanDays = Math.max(0, Number(data.reactor?.control_days || 0));
  const oldSpendTarget = oldHabitSpendTarget(data);

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
        <div class="money-reframe">
          <span class="icon-token token-green">${icon("money")}</span>
          <p>${esc(t("dashboard.money_reframe", { days: cleanDays, amount: money(moneyData.saved_total, currency), target: oldSpendTarget }))}</p>
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

function oldHabitSpendTarget(data) {
  const habitTypes = Array.isArray(data.habit_types) ? data.habit_types : [];
  const hasSmoking = habitTypes.includes("smoking");
  const hasAlcohol = habitTypes.includes("alcohol");
  if (hasSmoking && hasAlcohol) return t("dashboard.old_spend_both");
  if (hasAlcohol) return t("dashboard.old_spend_alcohol");
  return dashboardSmokingUi(data).isVape ? t("dashboard.old_spend_vape") : t("dashboard.old_spend_smoking");
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
    ? t(mission.reward_key, { xp: mission.reward_xp, energy: mission.energy || 0 })
    : t(mission.reward_key);

  return `
    <article class="daily-mission ${completed ? "completed" : ""}">
      <span class="mission-energy-pulse" aria-hidden="true"></span>
      <div class="mission-check">${completed ? icon("shield") : icon(mission.icon || "star")}</div>
      <div>
        <strong>${esc(t(mission.title_key))}</strong>
        <span>${esc(t(mission.body_key))}</span>
      </div>
      <div class="mission-meta">
        <span class="mission-reward">${esc(reward)}</span>
        <small>${esc(t(completed ? "dashboard.mission_done" : "dashboard.mission_open"))}</small>
        ${!completed && mission.action ? `<button class="mission-action" type="button" data-mission-action="${esc(mission.action)}">${esc(missionActionLabel(mission.action))}</button>` : ""}
      </div>
    </article>`;
}

function missionActionLabel(action) {
  if (action?.startsWith("complete:")) return t("dashboard.mission_action_complete");
  return t(`dashboard.mission_action_${action}`);
}

function impulseDeck(data) {
  const habitTypes = Array.isArray(data.habit_types) ? data.habit_types : [];
  const hasSmoking = habitTypes.includes("smoking");
  const hasAlcohol = habitTypes.includes("alcohol");
  const isVape = dashboardSmokingUi(data).isVape;
  const seed = Math.floor(Number(data.reactor?.control_hours || 0)) + Number(data.stats?.craving_wins || 0) + new Date().getDate();
  const facts = [
    ...(hasSmoking ? list(isVape ? "impulse.facts_vape" : "impulse.facts_smoking") : []),
    ...(hasAlcohol ? list("impulse.facts_alcohol") : []),
    ...list("impulse.facts_control")
  ].filter(Boolean);
  const quests = list("impulse.quests").filter((item) => item && typeof item === "object");
  const quest = quests.length ? quests[seed % quests.length] : {};
  const fact = facts.length ? facts[(seed + 1) % facts.length] : t("impulse.fact_fallback");

  return [
    {
      type: "game",
      icon: "reactor",
      token: "token-blue",
      kicker: t("impulse.game_kicker"),
      title: t("impulse.game_title"),
      body: t("impulse.game_body"),
      action: "focus",
      actionLabel: t("impulse.game_action")
    },
    {
      type: "quest",
      icon: quest.icon || "bolt",
      token: quest.token || "token-green",
      kicker: t("impulse.quest_kicker"),
      title: quest.title || t("impulse.quest_fallback_title"),
      body: quest.body || t("impulse.quest_fallback_body"),
      action: quest.action || "commitment",
      actionLabel: quest.action_label || t("impulse.quest_action")
    },
    {
      type: "fact",
      icon: "star",
      token: "token-violet",
      kicker: t("impulse.fact_kicker"),
      title: t("impulse.fact_title"),
      body: fact,
      action: "craving",
      actionLabel: t("impulse.fact_action")
    }
  ];
}

function renderImpulsePanel(data) {
  const cards = impulseDeck(data);
  return `
    <section class="panel impulse-panel">
      <div class="section-head">
        <div>
          <p class="eyebrow">${esc(t("impulse.kicker"))}</p>
          <h3>${esc(t("impulse.title"))}</h3>
        </div>
        <span class="badge">${esc(t("impulse.badge"))}</span>
      </div>
      <p class="impulse-lead">${esc(t("impulse.subtitle"))}</p>
      <div class="impulse-grid">
        ${cards.map((card) => `
          <article class="impulse-card impulse-${esc(card.type)}">
            <span class="icon-token ${esc(card.token)}">${icon(card.icon)}</span>
            <div>
              <small>${esc(card.kicker)}</small>
              <strong>${esc(card.title)}</strong>
              <p>${esc(card.body)}</p>
            </div>
            <button class="mission-action" type="button" data-impulse-action="${esc(card.action)}">${esc(card.actionLabel)}</button>
          </article>`).join("")}
      </div>
    </section>`;
}

function handleImpulseAction(action) {
  if (action === "focus") {
    openImpulseFocusGame();
    return;
  }
  if (action === "craving") {
    openCraving();
    return;
  }
  if (action === "checkin") {
    app.querySelector(".daily-check-panel")?.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }
  openCommitmentMission();
}

function openImpulseFocusGame() {
  clearInterval(impulseTimer);
  const phases = list("impulse.game_phases");
  const phaseText = (index) => phases[index % Math.max(1, phases.length)] || t("impulse.game_phase_default");
  let remaining = 60;
  let started = false;

  modalRoot.innerHTML = `
    <div class="modal impulse-game-overlay" role="dialog" aria-modal="true" aria-labelledby="impulseGameTitle">
      <div class="modal-card impulse-game-modal">
        <button class="icon-button close-button" id="closeImpulseGame" type="button" aria-label="${esc(t("common.close"))}">${icon("x")}</button>
        <p class="eyebrow">${esc(t("impulse.game_kicker"))}</p>
        <h2 id="impulseGameTitle">${esc(t("impulse.game_modal_title"))}</h2>
        <p class="muted">${esc(t("impulse.game_modal_body"))}</p>
        <div class="impulse-breath-orb" id="impulseBreathOrb" style="--focus-progress:0">
          <i aria-hidden="true"></i>
          <strong id="impulseCountdown">60</strong>
          <span id="impulsePhase">${esc(phaseText(0))}</span>
        </div>
        <div class="impulse-game-steps">
          ${[0, 1, 2].map((index) => `<span>${esc(phaseText(index))}</span>`).join("")}
        </div>
        <button class="primary-button full" id="startImpulseGame" type="button">${esc(t("impulse.game_start"))}</button>
      </div>
    </div>`;

  const countdown = modalRoot.querySelector("#impulseCountdown");
  const phase = modalRoot.querySelector("#impulsePhase");
  const orb = modalRoot.querySelector("#impulseBreathOrb");
  const start = modalRoot.querySelector("#startImpulseGame");
  const update = () => {
    countdown.textContent = String(remaining);
    phase.textContent = remaining <= 0 ? t("impulse.game_done") : phaseText(Math.floor((60 - remaining) / 10));
    orb.style.setProperty("--focus-progress", String((60 - remaining) / 60));
  };

  modalRoot.querySelector("#closeImpulseGame").addEventListener("click", closeModal);
  start.addEventListener("click", () => {
    if (started) return;
    if (remaining <= 0) remaining = 60;
    started = true;
    orb.classList.add("is-running");
    start.disabled = true;
    start.textContent = t("impulse.game_running");
    update();
    impulseTimer = window.setInterval(() => {
      remaining -= 1;
      update();
      if (remaining <= 0) {
        clearInterval(impulseTimer);
        started = false;
        orb.classList.remove("is-running");
        start.disabled = false;
        start.textContent = t("impulse.game_finish");
      }
    }, 1000);
  });
}

function handleMissionAction(action) {
  if (action === "checkin") {
    app.querySelector(".daily-check-panel")?.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }
  if (action === "craving") {
    openCraving();
    return;
  }
  if (action?.startsWith("complete:")) {
    completeQuickMission(action.replace("complete:", ""));
    return;
  }
  if (action === "commitment") {
    openCommitmentMission();
    return;
  }
  if (action === "social") openSocialModal("feed");
}

async function completeQuickMission(code) {
  const mission = (state.dashboard?.missions || []).find((item) => item.code === code) || {};
  try {
    const data = await api("/api/missions/complete", { method: "POST", body: { code } });
    state.dashboard = data.dashboard;
    state.notice = t("dashboard.mission_completed_notice");
    openMissionRewardModal(mission);
  } catch (error) {
    state.error = error.message;
    render();
  }
}

function openMissionRewardModal(mission = {}) {
  const xp = Number(mission.reward_xp || 0);
  const energy = Number(mission.energy || 0);
  modalRoot.innerHTML = `
    <div class="modal mission-reward-overlay" role="dialog" aria-modal="true" aria-labelledby="missionRewardTitle">
      <div class="modal-card mission-reward-modal">
        <button class="icon-button close-button" id="closeMissionReward" type="button" aria-label="${esc(t("common.close"))}">${icon("x")}</button>
        <div class="mission-reward-core" aria-hidden="true">
          <span>${icon("reactor")}</span>
          <i></i>
        </div>
        <p class="eyebrow">${esc(t("dashboard.mission_reward_kicker"))}</p>
        <h2 id="missionRewardTitle">${esc(t("dashboard.mission_reward_title"))}</h2>
        <p class="muted">${esc(t("dashboard.mission_reward_body"))}</p>
        <div class="mission-reward-stats">
          <span>${icon("star")}<strong>${esc(t("dashboard.mission_reward_xp_value", { xp }))}</strong></span>
          <span>${icon("bolt")}<strong>${esc(t("dashboard.mission_reward_energy_value", { energy }))}</strong></span>
        </div>
        <button class="primary-button full" id="acceptMissionReward" type="button">${esc(t("dashboard.mission_reward_continue"))}</button>
      </div>
    </div>`;

  const finish = () => {
    closeModal();
    render();
  };
  modalRoot.querySelector("#closeMissionReward").addEventListener("click", finish);
  modalRoot.querySelector("#acceptMissionReward").addEventListener("click", finish);
}

function openCommitmentMission() {
  const selectedReasons = profileMotivationReasons(state.dashboard?.profile || {});
  const options = list("onboarding.reason_options");
  const reasons = (selectedReasons.length ? selectedReasons : ["control"]).map((code) => {
    const option = options.find((item) => item.code === code) || {};
    return {
      code,
      title: code === "custom" ? (state.dashboard?.profile?.custom_reason || t("onboarding.custom_reason")) : (option.title || code),
      icon: option.icon || "star"
    };
  });
  let selected = reasons[0]?.code || "control";

  modalRoot.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="commitmentTitle">
      <div class="modal-card commitment-modal">
        <button class="icon-button close-button" id="closeCommitment" type="button" aria-label="${esc(t("common.close"))}">${icon("x")}</button>
        <p class="eyebrow">${esc(t("commitment.kicker"))}</p>
        <h2 id="commitmentTitle">${esc(t("commitment.title"))}</h2>
        <p class="muted">${esc(t("commitment.subtitle"))}</p>
        <div class="commitment-reasons">
          ${reasons.map((reason, index) => `<button class="commitment-reason ${index === 0 ? "selected" : ""}" type="button" data-commitment-reason="${esc(reason.code)}">${icon(reason.icon)}<span>${esc(reason.title)}</span></button>`).join("")}
        </div>
        <label>${esc(t("commitment.note"))}<textarea id="commitmentNote" maxlength="190" rows="3" placeholder="${esc(t("commitment.placeholder"))}"></textarea></label>
        <button class="primary-button full" id="saveCommitment" type="button">${esc(t("commitment.save"))}</button>
      </div>
    </div>`;

  modalRoot.querySelector("#closeCommitment").addEventListener("click", closeModal);
  modalRoot.querySelectorAll("[data-commitment-reason]").forEach((button) => button.addEventListener("click", () => {
    selected = button.dataset.commitmentReason || "control";
    modalRoot.querySelectorAll("[data-commitment-reason]").forEach((item) => item.classList.toggle("selected", item === button));
  }));
  modalRoot.querySelector("#saveCommitment").addEventListener("click", async () => {
    try {
      const data = await api("/api/missions/commitment", {
        method: "POST",
        body: { reason_code: selected, note: modalRoot.querySelector("#commitmentNote").value }
      });
      state.dashboard = data.dashboard;
      state.notice = t("commitment.saved");
      closeModal();
      render();
    } catch (error) {
      state.error = error.message;
      closeModal();
      render();
    }
  });
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
  if (data.dashboard) state.dashboard = data.dashboard;
  state.notice = t("social.support_sent");
  closeModal();
  render();
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
  const smokingProduct = smoking.smoking_product === "vape" ? "vape" : "tobacco";
  const alcohol = data.habits.alcohol || {};
  const motivationReasons = profileMotivationReasons(profile);
  const recoveryStore = loadRecoveryStore(data);
  const recoveryProfile = recoveryStore.recoveryProfile;
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
          <h3>${esc(t("settings.motivation_title"))}</h3>
          <p class="muted">${esc(t("settings.motivation_body"))}</p>
          <div class="reason-choice-grid settings-reason-grid">
            ${renderMotivationReasonChoices(motivationReasons)}
          </div>
          <div id="settingsCustomReasonWrap" class="${motivationReasons.includes("custom") ? "" : "hidden"}">
            <label>${esc(t("onboarding.custom_reason"))}<input name="custom_reason" value="${esc(profile.custom_reason || "")}"></label>
          </div>
          <div class="alert hidden" id="settingsReasonError">${esc(t("errors.choose_reason"))}</div>
        </div>
        <div class="settings-section">
          <h3>${esc(t("settings.goal"))}</h3>
          <div class="settings-grid">
            <label>${esc(t("onboarding.goal_name"))}<input name="goal_title" value="${esc(goal.title || "")}"></label>
            <label>${esc(t("onboarding.goal_amount"))}<input name="goal_amount" type="number" min="1" step="1" value="${esc(goal.target_amount || 1)}"></label>
          </div>
        </div>
        ${renderRecoveryProfileSettings(recoveryProfile, data)}
        ${data.habit_types.includes("smoking") ? `
        <div class="settings-section">
          <h3>${esc(t("settings.smoking"))}</h3>
          ${renderSmokingProductPicker("smoking_product", smokingProduct)}
          <div class="settings-grid ${smokingProduct === "vape" ? "hidden" : ""}" data-smoking-settings="tobacco">
            <label>${esc(t("onboarding.cigarettes_per_day"))}<input name="cigarettes_per_day" type="number" min="0" step="1" value="${esc(smoking.cigarettes_per_day || 0)}"></label>
            <label>${esc(t("onboarding.cigarettes_per_pack"))}<input name="cigarettes_per_pack" type="number" min="1" step="1" value="${esc(smoking.cigarettes_per_pack || 20)}"></label>
            <label>${esc(t("onboarding.pack_price"))}<input name="pack_price" type="number" min="0" step="0.1" value="${esc(smoking.pack_price || 0)}"></label>
          </div>
          <div class="settings-grid one-field ${smokingProduct === "vape" ? "" : "hidden"}" data-smoking-settings="vape">
            <label>${esc(t("onboarding.vape_weekly_spend"))}<input name="vape_weekly_spend" type="number" min="0" step="0.1" value="${esc(smoking.vape_weekly_spend || 0)}"><small>${esc(t("onboarding.vape_spend_help"))}</small></label>
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
  app.querySelectorAll("[data-settings-smoking-product]").forEach((input) => input.addEventListener("change", () => {
    app.querySelectorAll("[data-smoking-settings]").forEach((section) => section.classList.toggle("hidden", section.dataset.smokingSettings !== input.value));
  }));
  app.querySelectorAll('[name="motivation_reasons"]').forEach((input) => input.addEventListener("change", () => {
    input.closest(".reason-choice")?.classList.toggle("selected", input.checked);
    const customSelected = Array.from(app.querySelectorAll('[name="motivation_reasons"]:checked')).some((item) => item.value === "custom");
    app.querySelector("#settingsCustomReasonWrap")?.classList.toggle("hidden", !customSelected);
    app.querySelector("#settingsReasonError")?.classList.add("hidden");
  }));
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
  const motivationReasons = form.getAll("motivation_reasons").map(String);
  if (!motivationReasons.length) {
    const error = app.querySelector("#settingsReasonError");
    error?.classList.remove("hidden");
    error?.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }
  const body = {
    name: String(form.get("name") || ""),
    avatar_code: String(form.get("avatar_code") || "pulse"),
    language: String(form.get("language") || state.lang),
    currency: String(form.get("currency") || "EUR").toUpperCase().slice(0, 3),
    main_reason: motivationReasons[0],
    motivation_reasons: motivationReasons,
    custom_reason: String(form.get("custom_reason") || ""),
    goal_title: String(form.get("goal_title") || ""),
    goal_amount: Number(form.get("goal_amount") || 1),
    reset_progress: String(form.get("confirm_reset") || "") === "RESET",
    confirm_reset: String(form.get("confirm_reset") || "")
  };

  if (state.dashboard.habit_types.includes("smoking")) {
    body.smoking = {
      is_active: true,
      smoking_product: String(form.get("smoking_product") || "tobacco") === "vape" ? "vape" : "tobacco",
      cigarettes_per_day: Number(form.get("cigarettes_per_day") || 0),
      cigarettes_per_pack: Number(form.get("cigarettes_per_pack") || 20),
      pack_price: Number(form.get("pack_price") || 0),
      vape_weekly_spend: Number(form.get("vape_weekly_spend") || 0)
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
    updateRecoveryStore((store) => ({
      ...store,
      recoveryProfile: recoveryProfileFromSettings(form, data.dashboard)
    }));
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
  state.craving = {
    id: null,
    timer: null,
    seconds: 90,
    totalSeconds: 90,
    reason: "",
    action: "",
    tool: "",
    toolBody: "",
    habitType,
    initialIntensity: 7,
    afterIntensity: 5,
    completedCycles: 0,
    startedAt: new Date().toISOString()
  };
  try {
    const data = await api("/api/craving/start", { method: "POST", body: { habit_type: habitType } });
    state.craving.id = data.craving_id;
  } catch {}
  renderCravingModal("sos");
  startCravingTimer();
}

function startCravingTimer() {
  clearInterval(state.craving.timer);
  state.craving.timer = setInterval(() => {
    state.craving.seconds = Math.max(0, state.craving.seconds - 1);
    updateCravingTimerDisplay();
    if (state.craving.seconds <= 0) {
      clearInterval(state.craving.timer);
      renderCravingModal("result");
    }
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

function cravingProtocolText(health) {
  const protocolPhrases = list("craving.protocol_phrases");
  if (!protocolPhrases.length) return t(cravingWaveKey(health));
  const passed = Math.max(0, Number(state.craving.totalSeconds || 90) - Number(state.craving.seconds || 0));
  return protocolPhrases[Math.min(protocolPhrases.length - 1, Math.floor(passed / 22))];
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
  if (waveText) waveText.textContent = cravingProtocolText(health);
}

function cravingSupportText() {
  return t("craving.support_message", { name: state.dashboard?.user?.name || t("app.name") });
}

function renderCravingModal(phase) {
  const habitType = state.craving.habitType || state.dashboard?.habit_types?.[0] || "smoking";
  const reasons = habitType === "alcohol"
    ? list("craving.reasons_alcohol")
    : list(dashboardSmokingUi(state.dashboard).isVape ? "craving.reasons_vape" : "craving.reasons");
  const tools = list("craving.tools");
  const health = cravingHealthPercent();
  const isResult = phase === "result" || state.craving.seconds <= 0;
  const bodyActions = list("craving.body_actions");
  const intensityButtons = (field) => Array.from({ length: 10 }, (_, index) => {
    const value = index + 1;
    const selected = Number(state.craving[field] || 0) === value;
    return `<button class="intensity-dot ${selected ? "selected" : ""}" type="button" data-intensity-field="${field}" data-intensity-value="${value}">${value}</button>`;
  }).join("");
  state.craving.phase = phase;
  modalRoot.innerHTML = `
    <div class="modal sos-modal-overlay" role="dialog" aria-modal="true">
      <div class="modal-card sos-modal-card">
        <button class="icon-button close-button" id="closeModal">${icon("x")}</button>
        <p class="eyebrow">${esc(t("craving.kicker"))}</p>
        <h2>${esc(t("craving.title"))}</h2>
        <p class="muted">${esc(t("craving.subtitle"))}</p>
        <div class="sos-intensity-card">
          <span>${esc(t("craving.intensity_before"))}</span>
          <div class="intensity-scale">${intensityButtons("initialIntensity")}</div>
        </div>
        <div class="sos-reactor-stage">
          <div class="craving-boss">
            <div class="boss-head"><span>${icon("bolt")}${esc(t("craving.boss"))}</span><strong id="cravingHealth">${health}%</strong></div>
            <div class="boss-health"><div id="bossFill" style="width:${health}%"></div></div>
            <small id="waveText">${esc(cravingProtocolText(health))}</small>
          </div>
          <div class="timer-block"><div class="timer-ring"><div class="timer-ring-inner"><strong id="timerText">${formatTimer(state.craving.seconds)}</strong><span>${esc(t("craving.timer_label"))}</span></div></div></div>
        </div>
        ${!isResult ? `
          <h3>${esc(t("craving.reason_title"))}</h3>
          <div class="pill-grid">${reasons.map((reason) => `<button class="pill ${state.craving.reason === reason ? "selected" : ""}" type="button" data-reason="${esc(reason)}">${esc(reason)}</button>`).join("")}</div>
          <h3>${esc(t("craving.tools_title"))}</h3>
          <div class="craving-tool-grid">
            ${tools.map((tool, index) => `
              <button class="craving-tool ${state.craving.tool === tool.title ? "selected" : ""}" type="button" data-tool-index="${index}">
                <strong>${esc(tool.title)}</strong>
                <span>${esc(tool.body)}</span>
              </button>`).join("")}
          </div>
          <h3>${esc(t("craving.body_action_title"))}</h3>
          <div class="pill-grid">${bodyActions.map((action) => `<button class="pill ${state.craving.action === action ? "selected" : ""}" type="button" data-body-action="${esc(action)}">${esc(action)}</button>`).join("")}</div>
          <button class="primary-button full sos-complete-now" id="completeCravingNow" type="button">${icon("shield")}${esc(t("craving.complete_now"))}</button>
        ` : `
          <div class="sos-intensity-card after">
            <span>${esc(t("craving.intensity_after"))}</span>
            <div class="intensity-scale">${intensityButtons("afterIntensity")}</div>
          </div>
          <div class="sos-result-card">
            <strong>${esc(t("craving.result_title", { before: state.craving.initialIntensity, after: state.craving.afterIntensity }))}</strong>
            <span>${esc(t("craving.result_body"))}</span>
          </div>
          <h3>${esc(t("craving.action_title"))}</h3>
          <p class="rescue-action">${esc(state.craving.action || t("craving.default_action"))}</p>
          <div class="support-box">
            <strong>${esc(t("craving.support_title"))}</strong>
            <p>${esc(cravingSupportText())}</p>
            <button class="secondary-button full" id="copySupport" type="button">${esc(t("craving.copy_support"))}</button>
          </div>
          <div class="sos-result-actions">
            <button class="primary-button full" id="completeCraving">${esc(t("craving.complete"))}</button>
            <button class="secondary-button full" id="extraCravingCycle" type="button">${esc(t("craving.extra_cycle"))}</button>
            <button class="danger-button full" id="incidentFromCraving" type="button">${esc(t("craving.incident_button"))}</button>
          </div>
        `}
      </div>
    </div>`;

  modalRoot.querySelector("#closeModal").addEventListener("click", closeModal);
  modalRoot.querySelectorAll("[data-intensity-field]").forEach((button) => {
    button.addEventListener("click", () => {
      state.craving[button.dataset.intensityField] = Number(button.dataset.intensityValue || 5);
      renderCravingModal(isResult ? "result" : "sos");
    });
  });
  modalRoot.querySelectorAll("[data-tool-index]").forEach((button) => {
    button.addEventListener("click", () => {
      const tool = tools[Number(button.dataset.toolIndex)] || {};
      state.craving.tool = tool.title || "";
      state.craving.toolBody = tool.body || "";
      if (!state.craving.action && tool.body) state.craving.action = tool.body;
      renderCravingModal("sos");
    });
  });
  modalRoot.querySelectorAll("[data-reason]").forEach((button) => {
    button.addEventListener("click", () => {
      state.craving.reason = button.dataset.reason;
      const actions = list("craving.actions");
      const action = actions[Math.floor(Math.random() * actions.length)] || "";
      state.craving.action = state.craving.tool ? `${state.craving.tool}: ${action}` : action;
      renderCravingModal("sos");
    });
  });
  modalRoot.querySelectorAll("[data-body-action]").forEach((button) => {
    button.addEventListener("click", () => {
      state.craving.action = button.dataset.bodyAction || "";
      renderCravingModal("sos");
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
  modalRoot.querySelector("#completeCravingNow")?.addEventListener("click", () => {
    state.craving.afterIntensity = Math.max(1, Math.min(Number(state.craving.initialIntensity || 5), Number(state.craving.initialIntensity || 5) - 2));
    completeCraving();
  });
  modalRoot.querySelector("#extraCravingCycle")?.addEventListener("click", () => {
    state.craving.completedCycles += 1;
    state.craving.seconds = 90;
    state.craving.totalSeconds = 90;
    renderCravingModal("sos");
    startCravingTimer();
  });
  modalRoot.querySelector("#incidentFromCraving")?.addEventListener("click", () => {
    const habit = state.craving.habitType || state.dashboard?.habit_types?.[0] || "smoking";
    closeModal();
    openIncident(habit);
  });
  updateCravingTimerDisplay();
}

async function completeCraving() {
  try {
    const rescueAction = state.craving.action || state.craving.toolBody || t("craving.default_action");
    const data = await api("/api/craving/complete", {
      method: "POST",
      body: {
        craving_id: state.craving.id,
        habit_type: state.craving.habitType,
        reason: state.craving.reason || t("craving.reason_unspecified"),
        rescue_action: rescueAction
      }
    });
    state.dashboard = data.dashboard;
    updateRecoveryStore((store) => ({
      ...store,
      cravingEvents: [
        ...store.cravingEvents,
        {
          id: `craving_${Date.now()}`,
          habitType: state.craving.habitType,
          reason: state.craving.reason || t("craving.reason_unspecified"),
          rescueAction,
          initialIntensity: Number(state.craving.initialIntensity || 0),
          afterIntensity: Number(state.craving.afterIntensity || 0),
          completedCycles: Number(state.craving.completedCycles || 0),
          startedAt: state.craving.startedAt || new Date().toISOString(),
          completedAt: new Date().toISOString()
        }
      ].slice(-120)
    }));
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
      updateRecoveryStore((store) => ({
        ...store,
        incidents: [
          ...store.incidents,
          {
            id: `incident_${Date.now()}`,
            habitType,
            note: modalRoot.querySelector("#incidentNote").value,
            createdAt: new Date().toISOString()
          }
        ].slice(-80)
      }));
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
  const isVape = dashboardSmokingUi(data).isVape;
  const controlDays = Number(data.reactor.control_days || 0);
  const habits = hasSmoking && hasAlcohol
    ? t(isVape ? "habits.vape_and_alcohol" : "habits.tobacco_and_alcohol")
    : hasSmoking
      ? t(isVape ? "habits.vape" : "habits.tobacco")
      : t("habits.alcohol");
  const motivationKey = hasSmoking && hasAlcohol
    ? (isVape ? "share.motivation_vape_both" : "share.motivation_both")
    : hasSmoking
      ? (isVape ? "share.motivation_vape" : "share.motivation_smoking")
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
  clearInterval(impulseTimer);
  clearInterval(chainTimer);
  modalRoot.innerHTML = "";
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && state.user?.id) void pollSocialNotifications();
});

init();
