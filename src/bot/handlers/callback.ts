import TelegramBot from "node-telegram-bot-api";
import { t } from "../utils";
import { Lang, UserState } from "../types";
import { userService, driverService, orderService } from "../../db/services";
import { mainMenuKeyboard } from "../keyboards";

export async function handleCallbackQuery(bot: TelegramBot, query: TelegramBot.CallbackQuery, userStates: Record<number, UserState>, userLang: Record<number, Lang>, isAdmin: (id: number) => boolean) {
  const chatId = query.message?.chat.id;
  if (!chatId) return;

  const data = query.data || "";

  // Tilni tanlash
  if (data.startsWith("lang_")) {
    const lang = data.split("_")[1] as Lang;
    userLang[chatId] = lang;
    await userService.createOrUpdate(chatId, { lang });
    
    await bot.answerCallbackQuery(query.id);
    return bot.sendMessage(chatId, t(chatId, userLang, "welcome"), mainMenuKeyboard(chatId, userLang, {}, {}, isAdmin(chatId), {}));
  }

  // Buyurtmani qabul qilish
  if (data.startsWith("accept_")) {
    const orderId = data.replace("accept_", "");
    const order = await orderService.getById(orderId);
    
    if (!order || order.status !== "pending") {
      return bot.answerCallbackQuery(query.id, { text: "Kechirasiz, bu buyurtma allaqachon qabul qilingan yoki muddati o'tgan.", show_alert: true });
    }

    await orderService.updateStatus(orderId, "accepted");
    // TODO: Update driver ID in order
    
    await bot.answerCallbackQuery(query.id, { text: "Siz buyurtmani qabul qildingiz!" });
    await bot.sendMessage(order.passengerId!, t(order.passengerId!, userLang, "driverFound"));
    // Qo'shimcha xabar yuborish mantiqi...
  }

  // Buyurtmani rad etish
  if (data.startsWith("reject_")) {
    await bot.answerCallbackQuery(query.id, { text: "Buyurtma rad etildi." });
    await bot.deleteMessage(chatId, query.message!.message_id);
  }
}
