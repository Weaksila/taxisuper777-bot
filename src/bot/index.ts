import TelegramBot from "node-telegram-bot-api";
import { logger } from "../lib/logger";
import { TEXTS, CONFIG, ROUTES } from "./texts";
import { Lang, UserState, Driver, Order } from "./types";
import { t, isAdmin } from "./utils";
import { mainMenuKeyboard } from "./keyboards";
import { userService } from "../db/services";
import { handleMessage } from "./handlers/message";
import { handleCallbackQuery } from "./handlers/callback";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
if (!TOKEN) {
  logger.error("TELEGRAM_BOT_TOKEN is not set!");
  process.exit(1);
}

export const bot = new TelegramBot(TOKEN, { polling: true });

// Shared states
const userStates: Record<number, UserState> = {};
const userLang: Record<number, Lang> = {};

// ═══════════════════════════════════════════════════════════════
// ASOSIY HANDLERLAR
// ═══════════════════════════════════════════════════════════════

bot.onText(/\/start(.*)/, async (msg) => {
  const chatId = msg.chat.id;
  const user = await userService.getByChatId(chatId);
  
  if (!user) {
    await userService.createOrUpdate(chatId, { lang: "uz" });
    userLang[chatId] = "uz";
  } else {
    userLang[chatId] = (user.lang as Lang) || "uz";
  }

  await bot.sendMessage(
    chatId,
    t(chatId, userLang, "chooseLanguage"),
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "O'zbekcha 🇺🇿", callback_data: "lang_uz" }, { text: "Русский 🇷🇺", callback_data: "lang_ru" }]
        ]
      }
    }
  );
});

bot.on("message", async (msg) => {
  if (msg.text?.startsWith("/")) return; // Buyruqlarni o'tkazib yuboramiz
  
  // Tilni bazadan olish (agar keshda bo'lmasa)
  if (!userLang[msg.chat.id]) {
    const user = await userService.getByChatId(msg.chat.id);
    userLang[msg.chat.id] = (user?.lang as Lang) || "uz";
  }

  await handleMessage(bot, msg, userStates, userLang);
});

bot.on("callback_query", async (query) => {
  // Tilni bazadan olish (agar keshda bo'lmasa)
  const chatId = query.message?.chat.id;
  if (chatId && !userLang[chatId]) {
    const user = await userService.getByChatId(chatId);
    userLang[chatId] = (user?.lang as Lang) || "uz";
  }

  await handleCallbackQuery(bot, query, userStates, userLang, isAdmin);
});

logger.info("Bot started with refactored structure and DB integration");
