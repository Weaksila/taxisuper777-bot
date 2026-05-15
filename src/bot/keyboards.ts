import TelegramBot from "node-telegram-bot-api";
import { TEXTS, ROUTES } from "./texts";
import { Lang, Driver, LastOrder } from "./types";
import { t } from "./utils";

export function mainMenuKeyboard(chatId: number, userLang: Record<number, Lang>, drivers: Record<number, Driver>, lastOrders: Record<number, LastOrder>, isAdmin: boolean, reminderEnabled: Record<number, boolean>) {
  const lang = userLang[chatId] || "uz";
  const driver = drivers[chatId];
  const rows: { text: string }[][] = [
    [{ text: TEXTS.btnDriver[lang] }, { text: TEXTS.btnPassenger[lang] }],
    [{ text: TEXTS.btnAnnounce[lang] }, { text: TEXTS.btnParcel[lang] }],
    [{ text: TEXTS.btnTomorrow[lang] }, { text: TEXTS.btnMyOrders[lang] }],
    [{ text: TEXTS.btnHistory[lang] }, { text: TEXTS.btnComplaint[lang] }],
    [{ text: TEXTS.btnReferral[lang] }, { text: TEXTS.btnHelp[lang] }],
    [{ text: TEXTS.btnSOS[lang] }],
  ];
  
  if (lastOrders[chatId]) {
    rows.splice(2, 0, [{ text: TEXTS.btnQuickOrder[lang] }]);
  }
  
  if (drivers[chatId]?.approved) {
    rows.push([{ text: TEXTS.btnMyStats[lang] }, { text: TEXTS.btnEdit[lang] }]);
    rows.push([{ text: TEXTS.btnSchedule[lang] }, { text: TEXTS.btnEarnings[lang] }]);
    rows.push([{ text: TEXTS.btnAnalytics[lang] }, { text: TEXTS.btnBreak[lang] }]);
    rows.push([{ text: TEXTS.btnLeaderboard[lang] }]);
  }
  
  if (!drivers[chatId]) {
    rows.push([{ text: TEXTS.btnFavorites[lang] }, { text: TEXTS.btnSavedPlaces[lang] }]);
    rows.push([{ text: TEXTS.btnBookForOther[lang] }, { text: TEXTS.btnEmergency[lang] }]);
  }
  
  if (driver && driver.approved && !driver.blocked) {
    const statusBtn = driver.online ? TEXTS.btnOffline[lang] : TEXTS.btnOnline[lang];
    const remEnabled = reminderEnabled[chatId] !== false;
    const reminderBtn = remEnabled ? "🔔 Eslatma: Yoq" : "🔕 Eslatma: O'chiq";
    rows.push([{ text: statusBtn }, { text: TEXTS.btnMyStatus[lang] }]);
    rows.push([{ text: reminderBtn }]);
  }
  
  if (isAdmin) rows.push([{ text: TEXTS.btnAdmin[lang] }]);
  
  return { reply_markup: { keyboard: rows, resize_keyboard: true } };
}

export function cancelKeyboard(chatId: number, userLang: Record<number, Lang>) {
  return { reply_markup: { keyboard: [[{ text: t(chatId, userLang, "btnCancel") }]], resize_keyboard: true } };
}

export function sharePhoneKeyboard(chatId: number, userLang: Record<number, Lang>) {
  return {
    reply_markup: {
      keyboard: [
        [{ text: t(chatId, userLang, "btnSharePhone"), request_contact: true }],
        [{ text: t(chatId, userLang, "btnCancel") }],
      ],
      resize_keyboard: true,
    },
  };
}

export function routeKeyboard() {
  return { reply_markup: { keyboard: ROUTES.map((r) => [{ text: r }]), resize_keyboard: true, one_time_keyboard: true } };
}

export function ratingKeyboard(orderId: string) {
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
