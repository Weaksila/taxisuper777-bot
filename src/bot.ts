import TelegramBot from "node-telegram-bot-api";
import { logger } from "./lib/logger";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
if (!TOKEN) { logger.error("TELEGRAM_BOT_TOKEN is not set!"); process.exit(1); }

export const bot = new TelegramBot(TOKEN, { polling: true });

const ADMIN_IDS = (process.env.ADMIN_IDS || "").split(",").map((id) => id.trim()).filter(Boolean);

const ROUTES = [
  "Yangiyer → Toshkent", "Toshkent → Yangiyer",
  "Toshkent → Guliston", "Guliston → Toshkent",
  "Yangiyer → Guliston", "Guliston → Yangiyer",
];

// ─── Translations ───────────────────────────────────────────────
type Lang = "uz" | "ru";
const userLang: Record<number, Lang> = {};

const TEXTS: Record<string, Record<Lang, string>> = {
  welcome:        { uz: "Assalomu alaykum",         ru: "Добро пожаловать" },
  chooseRole:     { uz: "Quyidagilardan birini tanlang:", ru: "Выберите один из вариантов:" },
  btnDriver:      { uz: "🚗 Haydovchi",              ru: "🚗 Водитель" },
  btnPassenger:   { uz: "🧑 Yo'lovchi",              ru: "🧑 Пассажир" },
  btnAnnounce:    { uz: "📢 E'lonlar",               ru: "📢 Объявления" },
  btnParcel:      { uz: "📦 Posilka",                ru: "📦 Посылка" },
  btnAdmin:       { uz: "👨‍💼 Admin panel",           ru: "👨‍💼 Админ панель" },
  btnHistory:     { uz: "📜 Tarixim",                ru: "📜 История" },
  btnCancel:      { uz: "❌ Bekor qilish",           ru: "❌ Отмена" },
  btnSharePhone:  { uz: "📱 Telefon ulashish",       ru: "📱 Поделиться номером" },
  enterName:      { uz: "Ismingizni kiriting:",      ru: "Введите ваше имя:" },
  enterPhone:     { uz: "📱 Telefon raqamingizni ulashing:", ru: "📱 Поделитесь номером телефона:" },
  enterCarModel:  { uz: "🚗 Mashina modelini kiriting (masalan: Cobalt):", ru: "🚗 Введите модель авто (например: Cobalt):" },
  enterCarNum:    { uz: "🔢 Mashina raqamini kiriting (01A123BC):", ru: "🔢 Введите номер авто (01A123BC):" },
  chooseRoute:    { uz: "📍 Yo'nalishni tanlang:", ru: "📍 Выберите маршрут:" },
  enterSeats:     { uz: "💺 Nechta bo'sh o'rindiq? (1-6):", ru: "💺 Сколько свободных мест? (1-6):" },
  enterSeatsP:    { uz: "💺 Nechta o'rindiq kerak? (1-4):", ru: "💺 Сколько мест нужно? (1-4):" },
  enterTime:      { uz: "🕐 Jo'nash vaqti (masalan: 08:30):", ru: "🕐 Время отправления (например: 08:30):" },
  enterPrice:     { uz: "💰 Narxni kiriting (so'mda):", ru: "💰 Введите цену (в сумах):" },
  mainMenu:       { uz: "Asosiy menyu:", ru: "Главное меню:" },
  invalidSeats:   { uz: "Iltimos, to'g'ri son kiriting:", ru: "Пожалуйста, введите правильное число:" },
  invalidPrice:   { uz: "Iltimos, to'g'ri narx kiriting:", ru: "Пожалуйста, введите корректную цену:" },
  orderSent:      { uz: "✅ Buyurtmangiz qabul qilindi! Haydovchi topilganda xabar beramiz. 🔔", ru: "✅ Ваш заказ принят! Уведомим вас, когда найдём водителя. 🔔" },
  noDrivers:      { uz: "😔 Hozircha bu yo'nalishda haydovchi topilmadi.", ru: "😔 Пока нет водителей на этот маршрут." },
  driverFound:    { uz: "🎉 Haydovchi topildi!", ru: "🎉 Водитель найден!" },
  rateTrip:       { uz: "⭐ Sayohatingiz qanday bo'ldi? Haydovchiga baho bering:", ru: "⭐ Как прошла поездка? Оцените водителя:" },
  thankRating:    { uz: "Rahmat! Bahongiz qabul qilindi.", ru: "Спасибо! Ваша оценка принята." },
  chooseCompRoute:{ uz: "Shikoyat qaysi yo'nalishda bo'ldi? Yo'nalishni tanlang:", ru: "По какому маршруту жалоба? Выберите маршрут:" },
  enterComplaint: { uz: "📝 Shikoyatingizni yozing:", ru: "📝 Напишите вашу жалобу:" },
  complaintSent:  { uz: "✅ Shikoyatingiz adminga yuborildi. Rahmat!", ru: "✅ Жалоба отправлена администратору. Спасибо!" },
  parcelRoute:    { uz: "📦 Posilka yo'nalishini tanlang:", ru: "📦 Выберите маршрут посылки:" },
  parcelDesc:     { uz: "📦 Posilkani tasvirlab bering (og'irligi, nomi):", ru: "📦 Опишите посылку (вес, название):" },
  parcelSent:     { uz: "✅ Posilka so'rovi yuborildi! Haydovchi topilganda xabar beramiz.", ru: "✅ Запрос на посылку отправлен! Уведомим когда найдём водителя." },
  newParcel:      { uz: "📦 Yangi posilka so'rovi!", ru: "📦 Новый запрос на посылку!" },
  msgRelay:       { uz: "💬 Xabaringizni yuboring (haydovchi ko'radi):", ru: "💬 Напишите сообщение (водитель увидит):" },
  msgSent:        { uz: "✅ Xabaringiz yuborildi.", ru: "✅ Сообщение отправлено." },
  msgFrom:        { uz: "💬 Yo'lovchidan xabar:", ru: "💬 Сообщение от пассажира:" },
  msgFromDriver:  { uz: "💬 Haydovchidan xabar:", ru: "💬 Сообщение от водителя:" },
  noHistory:      { uz: "Hozircha sayohat tarixi yo'q.", ru: "История поездок пока пуста." },
  adminPending:   { uz: "⏳ Admin tasdiqlaganidan so'ng buyurtmalar olasiz.", ru: "⏳ После подтверждения администратора получите заказы." },
  approved:       { uz: "🎉 Siz tasdiqlanding! Buyurtmalar olishingiz mumkin!", ru: "🎉 Вы подтверждены! Можете получать заказы!" },
  blocked:        { uz: "❌ Akkauntingiz bloklandi. Admin bilan bog'laning.", ru: "❌ Ваш аккаунт заблокирован. Свяжитесь с администратором." },
  unblocked:      { uz: "✅ Akkauntingiz blokdan chiqarildi!", ru: "✅ Ваш аккаунт разблокирован!" },
  reminder:       { uz: "🔔 Eslatma! 30 daqiqadan so'ng sayohatingiz boshlanadi.", ru: "🔔 Напоминание! Через 30 минут начнётся ваша поездка." },
  chooseLanguage: { uz: "Tilni tanlang / Выберите язык:", ru: "Tilni tanlang / Выберите язык:" },
  announce:       { uz: "📢 Haydovchilar e'lonlari:", ru: "📢 Объявления водителей:" },
  noAnnounce:     { uz: "Hozircha e'lonlar yo'q.", ru: "Пока нет объявлений." },
  btnComplaint:   { uz: "🚫 Shikoyat",             ru: "🚫 Жалоба" },
  btnMsg:         { uz: "💬 Xabar yuborish",        ru: "💬 Отправить сообщение" },
  btnOnline:      { uz: "🟢 Online (faol)",         ru: "🟢 Онлайн (активен)" },
  btnOffline:     { uz: "🔴 Offline (dam olish)",   ru: "🔴 Оффлайн (отдыхаю)" },
  btnMyStatus:    { uz: "📡 Mening holatim",        ru: "📡 Мой статус" },
  onlineSet:      { uz: "🟢 Siz ONLINE! Buyurtmalar kela boshlaydi.", ru: "🟢 Вы ОНЛАЙН! Заказы начнут поступать." },
  offlineSet:     { uz: "🔴 Siz OFFLINE. Buyurtmalar kelmaydi.", ru: "🔴 Вы ОФФЛАЙН. Заказы не поступают." },
  onlineDrivers:  { uz: "🟢 Online haydovchilar:", ru: "🟢 Водители онлайн:" },
  offlineDrivers: { uz: "🔴 Offline haydovchilar:", ru: "🔴 Водители оффлайн:" },
  noOnlineDrivers:{ uz: "😔 Hozircha online haydovchi yo'q. Keyinroq urinib ko'ring.", ru: "😔 Сейчас нет онлайн водителей. Попробуйте позже." },
};

function t(chatId: number, key: string): string {
  const lang = userLang[chatId] || "uz";
  return TEXTS[key]?.[lang] ?? key;
}

// ─── Interfaces ─────────────────────────────────────────────────
interface VerificationResult {
  passed: boolean;
  checks: { label: string; ok: boolean; note?: string }[];
  score: number;
}

interface Trip {
  orderId: string;
  route: string;
  date: string;
  passengerName: string;
  rating?: number;
}

interface Driver {
  chatId: number;
  name: string;
  phone: string;
  carNumber: string;
  carModel: string;
  route: string;
  seats: number;
  departureTime: string;
  price: number;
  approved: boolean;
  blocked: boolean;
  online: boolean;
  lastSeen?: Date;
  verification?: VerificationResult;
  totalRating: number;
  ratingCount: number;
  trips: Trip[];
}

interface Passenger {
  chatId: number;
  name: string;
  phone: string;
  route: string;
  seats: number;
  departureTime: string;
}

interface Order {
  id: string;
  passenger: Passenger;
  driverId: number | null;
  status: "pending" | "accepted" | "completed" | "rejected";
  createdAt: Date;
  rated: boolean;
  type: "passenger" | "parcel";
  parcelDesc?: string;
}

interface Complaint {
  id: string;
  from: number;
  fromName: string;
  route: string;
  text: string;
  createdAt: Date;
}

// ─── State ──────────────────────────────────────────────────────
const userStates: Record<number, { step: string; data: Record<string, any> }> = {};
const drivers: Record<number, Driver> = {};
const passengers: Record<number, Passenger> = {};
const orders: Record<string, Order> = {};
const complaints: Complaint[] = [];
const activeChats: Record<number, number> = {};
const reminders: Record<string, ReturnType<typeof setTimeout>> = {};

// ─── Validation ─────────────────────────────────────────────────
function validateCarNumber(n: string) { return /^\d{2}[A-Z]\d{3}[A-Z]{2}$/i.test(n.replace(/\s/g, "")); }
function validateTime(t: string) { return /^([01]\d|2[0-3]):([0-5]\d)$/.test(t.trim()); }
function validatePhone(p: string) { return /^(998)?\d{9}$/.test(p.replace(/[\s\-\(\)\+]/g, "")); }

function autoVerifyDriver(data: Partial<Driver>): VerificationResult {
  const checks = [
    { label: "Ism to'g'riligi", ok: (data.name?.trim().length || 0) >= 2, note: "Ism juda qisqa" },
    { label: "Telefon raqam",   ok: validatePhone(data.phone || ""),       note: "Noto'g'ri format" },
    { label: "Mashina modeli",  ok: (data.carModel?.trim().length || 0) >= 3, note: "Juda qisqa" },
    { label: "Mashina raqami",  ok: validateCarNumber(data.carNumber || ""), note: "To'g'ri format: 01A123BC" },
    { label: "Vaqt (HH:MM)",    ok: validateTime(data.departureTime || ""),  note: "To'g'ri format: 08:30" },
    { label: "Narx diapazoni",  ok: (data.price || 0) >= 5000 && (data.price || 0) <= 2000000, note: "5,000–2,000,000 so'm" },
  ].map((c) => ({ ...c, note: c.ok ? undefined : c.note }));
  const score = checks.filter((c) => c.ok).length;
  return { passed: score === checks.length, checks, score };
}

function formatVerificationCard(v: VerificationResult): string {
  const badge = v.passed ? "🟢 TASDIQLANDI" : v.score >= 4 ? "🟡 QISMAN" : "🔴 XATOLIKLAR";
  const lines = v.checks.map((c) => `${c.ok ? "✅" : "❌"} ${c.label}${c.note ? ` — <i>${c.note}</i>` : ""}`);
  return `🔍 <b>Avto tekshruv:</b> ${badge} (${v.score}/${v.checks.length})\n${lines.join("\n")}`;
}

function formatRating(driver: Driver): string {
  if (driver.ratingCount === 0) return "⭐ Baho yo'q";
  const avg = (driver.totalRating / driver.ratingCount).toFixed(1);
  return `⭐ ${avg} (${driver.ratingCount} baho)`;
}

// ─── Reminders ──────────────────────────────────────────────────
function scheduleReminder(orderId: string, passengerChatId: number, timeStr: string) {
  if (!validateTime(timeStr)) return;
  const [h, m] = timeStr.split(":").map(Number);
  const now = new Date();
  const target = new Date();
  target.setHours(h, m, 0, 0);
  target.setTime(target.getTime() - 30 * 60 * 1000);
  const diff = target.getTime() - now.getTime();
  if (diff <= 0 || diff > 12 * 60 * 60 * 1000) return;
  reminders[orderId] = setTimeout(async () => {
    try {
      const lang = userLang[passengerChatId] || "uz";
      await bot.sendMessage(passengerChatId, TEXTS.reminder[lang]);
    } catch (_) {}
  }, diff);
}

// ─── Keyboards ──────────────────────────────────────────────────
function mainMenuKeyboard(chatId: number) {
  const lang = userLang[chatId] || "uz";
  const driver = drivers[chatId];
  const rows: { text: string }[][] = [
    [{ text: TEXTS.btnDriver[lang] }, { text: TEXTS.btnPassenger[lang] }],
    [{ text: TEXTS.btnAnnounce[lang] }, { text: TEXTS.btnParcel[lang] }],
    [{ text: TEXTS.btnHistory[lang] }, { text: TEXTS.btnComplaint[lang] }],
  ];
  if (driver && driver.approved && !driver.blocked) {
    const statusBtn = driver.online ? TEXTS.btnOffline[lang] : TEXTS.btnOnline[lang];
    rows.push([{ text: statusBtn }, { text: TEXTS.btnMyStatus[lang] }]);
  }
  if (isAdmin(chatId)) rows.push([{ text: TEXTS.btnAdmin[lang] }]);
  return { reply_markup: { keyboard: rows, resize_keyboard: true } };
}

function cancelKeyboard(chatId: number) {
  return { reply_markup: { keyboard: [[{ text: t(chatId, "btnCancel") }]], resize_keyboard: true } };
}

function sharePhoneKeyboard(chatId: number) {
  return {
    reply_markup: {
      keyboard: [
        [{ text: t(chatId, "btnSharePhone"), request_contact: true }],
        [{ text: t(chatId, "btnCancel") }],
      ],
      resize_keyboard: true,
    },
  };
}

function routeKeyboard(chatId: number) {
  return { reply_markup: { keyboard: ROUTES.map((r) => [{ text: r }]), resize_keyboard: true, one_time_keyboard: true } };
}

function ratingKeyboard(orderId: string) {
  return {
    reply_markup: {
      inline_keyboard: [[
        { text: "⭐1", callback_data: `rate_${orderId}_1` },
        { text: "⭐2", callback_data: `rate_${orderId}_2` },
        { text: "⭐3", callback_data: `rate_${orderId}_3` },
        { text: "⭐4", callback_data: `rate_${orderId}_4` },
        { text: "⭐5", callback_data: `rate_${orderId}_5` },
      ]],
    },
  };
}

function isAdmin(chatId: number) { return ADMIN_IDS.includes(String(chatId)); }

async function sendToAdmins(message: string, options: TelegramBot.SendMessageOptions = {}) {
  for (const id of ADMIN_IDS) {
    try { await bot.sendMessage(Number(id), message, { parse_mode: "HTML", ...options }); } catch (_) {}
  }
}

// ─── Notify drivers about order ─────────────────────────────────
async function notifyDrivers(order: Order) {
  const matched = Object.values(drivers).filter(
    (d) => d.approved && !d.blocked && d.online && d.route === order.passenger.route
  );
  if (matched.length === 0) {
    await bot.sendMessage(order.passenger.chatId, t(order.passenger.chatId, "noDrivers"));
    return;
  }
  const isParcel = order.type === "parcel";
  for (const driver of matched) {
    const lang = userLang[driver.chatId] || "uz";
    const label = isParcel
      ? (lang === "uz" ? "📦 Yangi posilka so'rovi!" : "📦 Новый запрос на посылку!")
      : (lang === "uz" ? "📦 Yangi buyurtma!" : "📦 Новый заказ!");
    const desc = isParcel ? `\n📦 Tavsif: ${order.parcelDesc}` : "";
    await bot.sendMessage(
      driver.chatId,
      `${label}\n\n👤 ${order.passenger.name}\n📍 ${order.passenger.route}\n🕐 ${order.passenger.departureTime}\n💺 ${order.passenger.seats}${desc}\n📞 ${order.passenger.phone}`,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [[
            { text: "✅ Qabul", callback_data: `accept_${order.id}` },
            { text: "❌ Rad", callback_data: `reject_${order.id}` },
          ]],
        },
      }
    );
  }
}

// ─── /start ─────────────────────────────────────────────────────
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  userStates[chatId] = { step: "choose_lang", data: {} };
  await bot.sendMessage(chatId, TEXTS.chooseLanguage.uz, {
    reply_markup: {
      inline_keyboard: [[
        { text: "🇺🇿 O'zbek", callback_data: "lang_uz" },
        { text: "🇷🇺 Русский", callback_data: "lang_ru" },
      ]],
    },
  });
});

// ─── Main message handler ────────────────────────────────────────
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text || "";
  const contact = msg.contact;

  if (!userStates[chatId]) userStates[chatId] = { step: "main", data: {} };
  const state = userStates[chatId];

  // Cancel
  if (text === t(chatId, "btnCancel")) {
    userStates[chatId] = { step: "main", data: {} };
    await bot.sendMessage(chatId, t(chatId, "mainMenu"), mainMenuKeyboard(chatId));
    return;
  }

  // ── Active chat relay ──────────────────────────────────────────
  if (state.step === "chatting" && !msg.contact) {
    const peerId = activeChats[chatId];
    if (peerId && text) {
      const isDriverSide = !!drivers[chatId];
      const prefix = isDriverSide ? t(peerId, "msgFromDriver") : t(peerId, "msgFrom");
      try { await bot.sendMessage(peerId, `${prefix}\n${text}`); } catch (_) {}
      await bot.sendMessage(chatId, t(chatId, "msgSent"));
    }
    return;
  }

  // ── Main menu buttons ──────────────────────────────────────────
  if (text === t(chatId, "btnDriver")) {
    userStates[chatId] = { step: "driver_name", data: {} };
    await bot.sendMessage(chatId, t(chatId, "enterName"), cancelKeyboard(chatId));
    return;
  }

  if (text === t(chatId, "btnPassenger")) {
    userStates[chatId] = { step: "passenger_name", data: {} };
    await bot.sendMessage(chatId, t(chatId, "enterName"), cancelKeyboard(chatId));
    return;
  }

  if (text === t(chatId, "btnAnnounce")) {
    const allDrivers = Object.values(drivers).filter((d) => d.approved && !d.blocked);
    if (allDrivers.length === 0) {
      await bot.sendMessage(chatId, t(chatId, "noAnnounce"), mainMenuKeyboard(chatId));
      return;
    }
    const onlineList = allDrivers.filter((d) => d.online);
    const offlineList = allDrivers.filter((d) => !d.online);
    let msg2 = `📢 <b>Haydovchilar holati</b>\n`;
    msg2 += `🟢 Online: <b>${onlineList.length}</b>  🔴 Offline: <b>${offlineList.length}</b>\n`;
    msg2 += `─────────────────────\n\n`;
    if (onlineList.length > 0) {
      msg2 += `${t(chatId, "onlineDrivers")}\n\n`;
      onlineList.forEach((d, i) => {
        msg2 += `${i + 1}. 🟢 🚗 <b>${d.carModel}</b> (${d.carNumber})\n`;
        msg2 += `   👤 ${d.name} | 📍 ${d.route}\n`;
        msg2 += `   🕐 ${d.departureTime} | 💰 ${d.price.toLocaleString()} so'm\n`;
        msg2 += `   ${formatRating(d)} | 💺 ${d.seats} o'rindiq\n\n`;
      });
    } else {
      msg2 += `${t(chatId, "noOnlineDrivers")}\n\n`;
    }
    if (offlineList.length > 0) {
      msg2 += `${t(chatId, "offlineDrivers")}\n\n`;
      offlineList.forEach((d, i) => {
        const lastSeen = d.lastSeen ? `🕐 ${d.lastSeen.toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" })}` : "";
        msg2 += `${i + 1}. 🔴 🚗 <b>${d.carModel}</b> | 👤 ${d.name} | 📍 ${d.route} ${lastSeen}\n`;
      });
    }
    await bot.sendMessage(chatId, msg2, { parse_mode: "HTML", ...mainMenuKeyboard(chatId) });
    return;
  }

  if (text === t(chatId, "btnParcel")) {
    userStates[chatId] = { step: "parcel_name", data: {} };
    await bot.sendMessage(chatId, t(chatId, "enterName"), cancelKeyboard(chatId));
    return;
  }

  if (text === t(chatId, "btnHistory")) {
    const driver = drivers[chatId];
    if (!driver || driver.trips.length === 0) {
      await bot.sendMessage(chatId, t(chatId, "noHistory"), mainMenuKeyboard(chatId));
      return;
    }
    let hist = `📜 <b>Sayohat tarixi:</b>\n\n`;
    driver.trips.slice(-10).reverse().forEach((tr, i) => {
      hist += `${i + 1}. 📍 ${tr.route}\n   👤 ${tr.passengerName} | 📅 ${tr.date}${tr.rating ? ` | ⭐${tr.rating}` : ""}\n\n`;
    });
    hist += `${formatRating(driver)}`;
    await bot.sendMessage(chatId, hist, { parse_mode: "HTML", ...mainMenuKeyboard(chatId) });
    return;
  }

  // Online/Offline toggle
  if (text === t(chatId, "btnOnline") || text === t(chatId, "btnOffline")) {
    const driver = drivers[chatId];
    if (!driver) { await bot.sendMessage(chatId, "Avval haydovchi sifatida ro'yxatdan o'ting.", mainMenuKeyboard(chatId)); return; }
    if (!driver.approved) { await bot.sendMessage(chatId, t(chatId, "adminPending"), mainMenuKeyboard(chatId)); return; }
    driver.online = !driver.online;
    if (!driver.online) driver.lastSeen = new Date();
    await bot.sendMessage(chatId, driver.online ? t(chatId, "onlineSet") : t(chatId, "offlineSet"), mainMenuKeyboard(chatId));
    return;
  }

  // My status
  if (text === t(chatId, "btnMyStatus")) {
    const driver = drivers[chatId];
    if (!driver) { await bot.sendMessage(chatId, "Siz haydovchi sifatida ro'yxatdan o'tmagansiz."); return; }
    const lang = userLang[chatId] || "uz";
    const statusIcon = driver.online ? "🟢 ONLINE" : "🔴 OFFLINE";
    const lastSeenText = driver.lastSeen ? `\n🕐 Oxirgi faollik: ${driver.lastSeen.toLocaleString("uz-UZ")}` : "";
    await bot.sendMessage(chatId,
      `📡 <b>Mening holatim</b>\n\n${statusIcon}\n🚗 ${driver.carModel} (${driver.carNumber})\n📍 ${driver.route}\n🕐 ${driver.departureTime}\n💰 ${driver.price.toLocaleString()} so'm\n${formatRating(driver)}\n💺 ${driver.seats} o'rindiq${lastSeenText}`,
      { parse_mode: "HTML", ...mainMenuKeyboard(chatId) }
    );
    return;
  }

  if (text === t(chatId, "btnComplaint")) {
    userStates[chatId] = { step: "complaint_route", data: {} };
    await bot.sendMessage(chatId, t(chatId, "chooseCompRoute"), routeKeyboard(chatId));
    return;
  }

  if (text === t(chatId, "btnAdmin") && isAdmin(chatId)) {
    const driverCount = Object.values(drivers).length;
    const approved = Object.values(drivers).filter((d) => d.approved).length;
    const pending = Object.values(drivers).filter((d) => !d.approved).length;
    const orderCount = Object.values(orders).length;
    const complaintCount = complaints.length;
    await bot.sendMessage(
      chatId,
      `👨‍💼 <b>Admin Panel</b>\n\n📊 Haydovchilar: ${driverCount} (✅${approved} ⏳${pending})\n📋 Buyurtmalar: ${orderCount}\n🚫 Shikoyatlar: ${complaintCount}`,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "👨‍✈️ Haydovchilar", callback_data: "admin_drivers" }],
            [{ text: "📋 Buyurtmalar",   callback_data: "admin_orders" }],
            [{ text: "🚫 Shikoyatlar",   callback_data: "admin_complaints" }],
          ],
        },
      }
    );
    return;
  }

  // ── Driver registration ────────────────────────────────────────
  if (state.step === "driver_name") {
    state.data.name = text; state.step = "driver_phone";
    await bot.sendMessage(chatId, t(chatId, "enterPhone"), sharePhoneKeyboard(chatId));
    return;
  }
  if (state.step === "driver_phone") {
    state.data.phone = contact ? contact.phone_number : text;
    state.step = "driver_car_model";
    await bot.sendMessage(chatId, t(chatId, "enterCarModel"), cancelKeyboard(chatId));
    return;
  }
  if (state.step === "driver_car_model") {
    state.data.carModel = text; state.step = "driver_car_number";
    await bot.sendMessage(chatId, t(chatId, "enterCarNum"), cancelKeyboard(chatId));
    return;
  }
  if (state.step === "driver_car_number") {
    state.data.carNumber = text; state.step = "driver_route";
    await bot.sendMessage(chatId, t(chatId, "chooseRoute"), routeKeyboard(chatId));
    return;
  }
  if (state.step === "driver_route") {
    if (!ROUTES.includes(text)) { await bot.sendMessage(chatId, t(chatId, "chooseRoute"), routeKeyboard(chatId)); return; }
    state.data.route = text; state.step = "driver_seats";
    await bot.sendMessage(chatId, t(chatId, "enterSeats"), cancelKeyboard(chatId));
    return;
  }
  if (state.step === "driver_seats") {
    const n = parseInt(text);
    if (isNaN(n) || n < 1 || n > 6) { await bot.sendMessage(chatId, t(chatId, "invalidSeats")); return; }
    state.data.seats = n; state.step = "driver_time";
    await bot.sendMessage(chatId, t(chatId, "enterTime"), cancelKeyboard(chatId));
    return;
  }
  if (state.step === "driver_time") {
    state.data.departureTime = text; state.step = "driver_price";
    await bot.sendMessage(chatId, t(chatId, "enterPrice"), cancelKeyboard(chatId));
    return;
  }
  if (state.step === "driver_price") {
    const price = parseInt(text);
    if (isNaN(price) || price < 0) { await bot.sendMessage(chatId, t(chatId, "invalidPrice")); return; }
    state.data.price = price;
    const verification = autoVerifyDriver(state.data as Partial<Driver>);
    const driver: Driver = {
      chatId, name: state.data.name, phone: state.data.phone,
      carNumber: state.data.carNumber, carModel: state.data.carModel,
      route: state.data.route, seats: state.data.seats,
      departureTime: state.data.departureTime, price,
      approved: verification.passed && ADMIN_IDS.length === 0,
      blocked: false, online: false, verification,
      totalRating: 0, ratingCount: 0, trips: [],
    };
    drivers[chatId] = driver;
    userStates[chatId] = { step: "main", data: {} };
    const card = formatVerificationCard(verification);
    const suffix = verification.passed
      ? (ADMIN_IDS.length > 0 ? `\n\n${t(chatId, "adminPending")}` : `\n\n🎉 Ro'yxatdan o'tdingiz! Buyurtmalar kutilmoqda 🚗`)
      : `\n\n⚠️ Xatoliklarni tuzatib qayta ro'yxatdan o'ting.`;
    await bot.sendMessage(chatId, `${card}${suffix}`, { parse_mode: "HTML", ...mainMenuKeyboard(chatId) });
    await sendToAdmins(
      `🆕 <b>Yangi haydovchi</b> (${verification.passed ? "✅" : `⚠️${verification.score}/6`})\n👤 ${driver.name} | 📞 ${driver.phone}\n🚗 ${driver.carModel} (${driver.carNumber})\n📍 ${driver.route} | 🕐 ${driver.departureTime}\n💰 ${price.toLocaleString()} so'm | ID: ${chatId}`
    );
    return;
  }

  // ── Passenger registration ─────────────────────────────────────
  if (state.step === "passenger_name") {
    state.data.name = text; state.step = "passenger_phone";
    await bot.sendMessage(chatId, t(chatId, "enterPhone"), sharePhoneKeyboard(chatId));
    return;
  }
  if (state.step === "passenger_phone") {
    state.data.phone = contact ? contact.phone_number : text;
    state.step = "passenger_route";
    await bot.sendMessage(chatId, t(chatId, "chooseRoute"), routeKeyboard(chatId));
    return;
  }
  if (state.step === "passenger_route") {
    if (!ROUTES.includes(text)) { await bot.sendMessage(chatId, t(chatId, "chooseRoute"), routeKeyboard(chatId)); return; }
    state.data.route = text; state.step = "passenger_seats";
    await bot.sendMessage(chatId, t(chatId, "enterSeatsP"), cancelKeyboard(chatId));
    return;
  }
  if (state.step === "passenger_seats") {
    const n = parseInt(text);
    if (isNaN(n) || n < 1 || n > 4) { await bot.sendMessage(chatId, t(chatId, "invalidSeats")); return; }
    state.data.seats = n; state.step = "passenger_time";
    await bot.sendMessage(chatId, t(chatId, "enterTime"), cancelKeyboard(chatId));
    return;
  }
  if (state.step === "passenger_time") {
    state.data.departureTime = text;
    const orderId = `${chatId}_${Date.now()}`;
    const passenger: Passenger = {
      chatId, name: state.data.name, phone: state.data.phone,
      route: state.data.route, seats: state.data.seats, departureTime: text,
    };
    passengers[chatId] = passenger;
    const order: Order = { id: orderId, passenger, driverId: null, status: "pending", createdAt: new Date(), rated: false, type: "passenger" };
    orders[orderId] = order;
    userStates[chatId] = { step: "main", data: {} };
    await bot.sendMessage(chatId, t(chatId, "orderSent"), mainMenuKeyboard(chatId));
    await notifyDrivers(order);
    return;
  }

  // ── Parcel flow ────────────────────────────────────────────────
  if (state.step === "parcel_name") {
    state.data.name = text; state.step = "parcel_phone";
    await bot.sendMessage(chatId, t(chatId, "enterPhone"), sharePhoneKeyboard(chatId));
    return;
  }
  if (state.step === "parcel_phone") {
    state.data.phone = contact ? contact.phone_number : text;
    state.step = "parcel_route";
    await bot.sendMessage(chatId, t(chatId, "parcelRoute"), routeKeyboard(chatId));
    return;
  }
  if (state.step === "parcel_route") {
    if (!ROUTES.includes(text)) { await bot.sendMessage(chatId, t(chatId, "parcelRoute"), routeKeyboard(chatId)); return; }
    state.data.route = text; state.step = "parcel_time";
    await bot.sendMessage(chatId, t(chatId, "enterTime"), cancelKeyboard(chatId));
    return;
  }
  if (state.step === "parcel_time") {
    state.data.departureTime = text; state.step = "parcel_desc";
    await bot.sendMessage(chatId, t(chatId, "parcelDesc"), cancelKeyboard(chatId));
    return;
  }
  if (state.step === "parcel_desc") {
    const orderId = `p_${chatId}_${Date.now()}`;
    const passenger: Passenger = {
      chatId, name: state.data.name, phone: state.data.phone,
      route: state.data.route, seats: 0, departureTime: state.data.departureTime,
    };
    const order: Order = {
      id: orderId, passenger, driverId: null, status: "pending",
      createdAt: new Date(), rated: false, type: "parcel", parcelDesc: text,
    };
    orders[orderId] = order;
    userStates[chatId] = { step: "main", data: {} };
    await bot.sendMessage(chatId, t(chatId, "parcelSent"), mainMenuKeyboard(chatId));
    await notifyDrivers(order);
    return;
  }

  // ── Complaint flow ─────────────────────────────────────────────
  if (state.step === "complaint_route") {
    if (!ROUTES.includes(text)) { await bot.sendMessage(chatId, t(chatId, "chooseCompRoute"), routeKeyboard(chatId)); return; }
    state.data.route = text; state.step = "complaint_text";
    await bot.sendMessage(chatId, t(chatId, "enterComplaint"), cancelKeyboard(chatId));
    return;
  }
  if (state.step === "complaint_text") {
    const complaint: Complaint = {
      id: `c_${Date.now()}`,
      from: chatId,
      fromName: msg.from?.first_name || "Noma'lum",
      route: state.data.route,
      text,
      createdAt: new Date(),
    };
    complaints.push(complaint);
    userStates[chatId] = { step: "main", data: {} };
    await bot.sendMessage(chatId, t(chatId, "complaintSent"), mainMenuKeyboard(chatId));
    await sendToAdmins(`🚫 <b>Yangi shikoyat</b>\n👤 ${complaint.fromName} (ID:${chatId})\n📍 ${complaint.route}\n📝 ${text}`);
    return;
  }
});

// ─── Callback queries ────────────────────────────────────────────
bot.on("callback_query", async (query) => {
  const chatId = query.message?.chat.id!;
  const data = query.data || "";
  const messageId = query.message?.message_id!;
  await bot.answerCallbackQuery(query.id);

  // Language selection
  if (data === "lang_uz" || data === "lang_ru") {
    userLang[chatId] = data === "lang_uz" ? "uz" : "ru";
    userStates[chatId] = { step: "main", data: {} };
    const lang = userLang[chatId];
    await bot.editMessageText(
      `${data === "lang_uz" ? "🇺🇿 O'zbek tili tanlandi" : "🇷🇺 Выбран русский язык"}\n\n🚖 <b>Yangiyer-Toshkent-Guliston Taksi Bot</b>\n\n${TEXTS.chooseRole[lang]}`,
      { chat_id: chatId, message_id: messageId, parse_mode: "HTML" }
    );
    await bot.sendMessage(chatId, TEXTS.chooseRole[lang], mainMenuKeyboard(chatId));
    return;
  }

  // Accept order
  if (data.startsWith("accept_")) {
    const orderId = data.replace("accept_", "");
    const order = orders[orderId];
    if (!order || order.status !== "pending") {
      await bot.sendMessage(chatId, "Bu buyurtma allaqachon qabul qilingan yoki topilmadi.");
      return;
    }
    const driver = drivers[chatId];
    if (!driver) return;
    order.status = "accepted";
    order.driverId = chatId;
    activeChats[chatId] = order.passenger.chatId;
    activeChats[order.passenger.chatId] = chatId;
    await bot.editMessageText(`✅ Qabul qilindi! | ${order.passenger.name}`, { chat_id: chatId, message_id: messageId });
    const lang = userLang[order.passenger.chatId] || "uz";
    await bot.sendMessage(
      order.passenger.chatId,
      `${TEXTS.driverFound[lang]}\n\n👤 ${driver.name}\n🚗 ${driver.carModel} (${driver.carNumber})\n📞 ${driver.phone}\n🕐 ${driver.departureTime}\n💰 ${driver.price.toLocaleString()} so'm\n${formatRating(driver)}`,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: TEXTS.btnMsg[lang], callback_data: `msg_start_${chatId}` }],
            [{ text: "✅ Sayohat yakunlandi", callback_data: `complete_${orderId}` }],
          ],
        },
      }
    );
    scheduleReminder(orderId, order.passenger.chatId, order.passenger.departureTime);
    return;
  }

  // Reject order
  if (data.startsWith("reject_")) {
    const orderId = data.replace("reject_", "");
    if (orders[orderId]) orders[orderId].status = "rejected";
    await bot.editMessageText("❌ Rad etildi.", { chat_id: chatId, message_id: messageId });
    return;
  }

  // Complete order
  if (data.startsWith("complete_")) {
    const orderId = data.replace("complete_", "");
    const order = orders[orderId];
    if (!order) return;
    order.status = "completed";
    delete activeChats[chatId];
    if (order.driverId) delete activeChats[order.driverId];
    await bot.editMessageText("✅ Sayohat yakunlandi!", { chat_id: chatId, message_id: messageId });
    if (!order.rated) {
      await bot.sendMessage(chatId, t(chatId, "rateTrip"), ratingKeyboard(orderId));
    }
    return;
  }

  // Rating
  if (data.startsWith("rate_")) {
    const parts = data.split("_");
    const orderId = parts.slice(1, -1).join("_");
    const stars = parseInt(parts[parts.length - 1]);
    const order = orders[orderId];
    if (!order || order.rated) return;
    order.rated = true;
    const driver = order.driverId ? drivers[order.driverId] : null;
    if (driver) {
      driver.totalRating += stars;
      driver.ratingCount += 1;
      driver.trips.push({
        orderId,
        route: order.passenger.route,
        date: new Date().toLocaleDateString("uz-UZ"),
        passengerName: order.passenger.name,
        rating: stars,
      });
      await bot.sendMessage(driver.chatId, `⭐ Yangi baho: ${"⭐".repeat(stars)} (${stars}/5)\nJami: ${formatRating(driver)}`);
    }
    await bot.editMessageText(t(chatId, "thankRating"), { chat_id: chatId, message_id: messageId });
    return;
  }

  // Start messaging
  if (data.startsWith("msg_start_")) {
    const driverId = parseInt(data.replace("msg_start_", ""));
    activeChats[chatId] = driverId;
    userStates[chatId] = { step: "chatting", data: {} };
    await bot.sendMessage(chatId, t(chatId, "msgRelay"), cancelKeyboard(chatId));
    return;
  }

  // Admin: drivers list
  if (data === "admin_drivers" && isAdmin(chatId)) {
    const list = Object.values(drivers);
    if (list.length === 0) { await bot.sendMessage(chatId, "Haydovchilar yo'q."); return; }
    await bot.sendMessage(chatId, "👨‍✈️ <b>Haydovchilar:</b>", {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: list.map((d) => [{
          text: `${d.approved ? "✅" : "⏳"}${d.blocked ? "🚫" : ""} ${d.name} — ${d.route}`,
          callback_data: `driver_info_${d.chatId}`,
        }]),
      },
    });
    return;
  }

  // Admin: driver info
  if (data.startsWith("driver_info_") && isAdmin(chatId)) {
    const dId = parseInt(data.replace("driver_info_", ""));
    const driver = drivers[dId];
    if (!driver) return;
    const kb = [];
    if (!driver.approved) kb.push([{ text: "✅ Tasdiqlash", callback_data: `approve_${dId}` }]);
    kb.push([{ text: driver.blocked ? "🔓 Blokdan chiqar" : "🚫 Bloklash", callback_data: driver.blocked ? `unblock_${dId}` : `block_${dId}` }]);
    const verLine = driver.verification ? `\n\n${formatVerificationCard(driver.verification)}` : "";
    await bot.sendMessage(chatId,
      `👤 <b>${driver.name}</b>\n📞 ${driver.phone}\n🚗 ${driver.carModel} (${driver.carNumber})\n📍 ${driver.route}\n🕐 ${driver.departureTime}\n💰 ${driver.price.toLocaleString()} so'm\n${formatRating(driver)}\nHolat: ${driver.approved ? "✅" : "⏳"} | ${driver.blocked ? "🚫" : "🟢"}${verLine}`,
      { parse_mode: "HTML", reply_markup: { inline_keyboard: kb } }
    );
    return;
  }

  if (data.startsWith("approve_") && isAdmin(chatId)) {
    const dId = parseInt(data.replace("approve_", ""));
    if (drivers[dId]) {
      drivers[dId].approved = true;
      await bot.editMessageText(`✅ Tasdiqlandi: ${drivers[dId].name}`, { chat_id: chatId, message_id: messageId });
      await bot.sendMessage(dId, t(dId, "approved"));
    }
    return;
  }

  if (data.startsWith("block_") && isAdmin(chatId)) {
    const dId = parseInt(data.replace("block_", ""));
    if (drivers[dId]) {
      drivers[dId].blocked = true;
      await bot.editMessageText(`🚫 Bloklandi: ${drivers[dId].name}`, { chat_id: chatId, message_id: messageId });
      await bot.sendMessage(dId, t(dId, "blocked"));
    }
    return;
  }

  if (data.startsWith("unblock_") && isAdmin(chatId)) {
    const dId = parseInt(data.replace("unblock_", ""));
    if (drivers[dId]) {
      drivers[dId].blocked = false;
      await bot.editMessageText(`🔓 Blokdan chiqarildi: ${drivers[dId].name}`, { chat_id: chatId, message_id: messageId });
      await bot.sendMessage(dId, t(dId, "unblocked"));
    }
    return;
  }

  if (data === "admin_orders" && isAdmin(chatId)) {
    const list = Object.values(orders);
    if (list.length === 0) { await bot.sendMessage(chatId, "Buyurtmalar yo'q."); return; }
    const statusIcon = (s: string) => s === "accepted" ? "✅" : s === "completed" ? "🏁" : s === "rejected" ? "❌" : "⏳";
    let txt = "📋 <b>Buyurtmalar (oxirgi 10):</b>\n\n";
    list.slice(-10).reverse().forEach((o, i) => {
      txt += `${i + 1}. ${statusIcon(o.status)} ${o.passenger.name} — ${o.passenger.route} ${o.type === "parcel" ? "📦" : ""}\n`;
    });
    await bot.sendMessage(chatId, txt, { parse_mode: "HTML" });
    return;
  }

  if (data === "admin_complaints" && isAdmin(chatId)) {
    if (complaints.length === 0) { await bot.sendMessage(chatId, "Shikoyatlar yo'q."); return; }
    let txt = "🚫 <b>Shikoyatlar:</b>\n\n";
    complaints.slice(-10).reverse().forEach((c, i) => {
      txt += `${i + 1}. 👤 ${c.fromName} | 📍 ${c.route}\n📝 ${c.text}\n\n`;
    });
    await bot.sendMessage(chatId, txt, { parse_mode: "HTML" });
    return;
  }
});

logger.info("Telegram bot started successfully!");

