import TelegramBot from "node-telegram-bot-api";
import { Order, Lang } from "./types";
import { t } from "./utils";
import { driverService } from "../db/services";
import { logger } from "../lib/logger";

export async function notifyDrivers(bot: TelegramBot, order: Order, userLang: Record<number, Lang>) {
  const matched = await driverService.getOnlineByRoute(order.passenger.route);
  
  if (matched.length === 0) {
    return bot.sendMessage(order.passenger.chatId, t(order.passenger.chatId, userLang, "noDrivers"));
  }

  // Reyting bo'yicha saralash
  matched.sort((a, b) => {
    const avgA = (a.ratingCount || 0) > 0 ? (a.totalRating || 0) / (a.ratingCount || 0) : 0;
    const avgB = (b.ratingCount || 0) > 0 ? (b.totalRating || 0) / (b.ratingCount || 0) : 0;
    return avgB - avgA;
  });

  for (const driver of matched) {
    const lang = userLang[driver.chatId] || "uz";
    const label = order.type === "parcel" 
      ? (lang === "uz" ? "📦 Yangi posilka so'rovi!" : "📦 Новый запрос на посылку!")
      : (lang === "uz" ? "🚕 Yangi buyurtma!" : "🚕 Новый заказ!");

    await bot.sendMessage(
      driver.chatId,
      `${label}\n\n👤 ${order.passenger.name}\n📍 ${order.passenger.route}\n🕐 ${order.passenger.departureTime}\n💺 ${order.passenger.seats}\n📞 ${order.passenger.phone}`,
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
