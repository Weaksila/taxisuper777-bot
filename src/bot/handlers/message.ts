import TelegramBot from "node-telegram-bot-api";
import { t, normalizePhone, validatePhone, validateCarNumber, validateTime, validateDriverTime, validateCarModel, isAdmin } from "../utils";
import { TEXTS, ROUTES } from "../texts";
import { Lang, UserState, Driver } from "../types";
import { mainMenuKeyboard, cancelKeyboard, sharePhoneKeyboard, routeKeyboard } from "../keyboards";
import { userService, driverService, orderService } from "../../db/services";
import { notifyDrivers } from "../notifications";

export async function handleMessage(bot: TelegramBot, msg: TelegramBot.Message, userStates: Record<number, UserState>, userLang: Record<number, Lang>) {
  const chatId = msg.chat.id;
  const text = msg.text || "";
  const lang = userLang[chatId] || "uz";
  const state = userStates[chatId];

  // ═══════════════════════════════════════════════════════════════
  // BEKOR QILISH (CANCEL)
  // ═══════════════════════════════════════════════════════════════
  if (text === TEXTS.btnCancel[lang]) {
    delete userStates[chatId];
    return bot.sendMessage(chatId, t(chatId, userLang, "mainMenu"), mainMenuKeyboard(chatId, userLang, {}, {}, false, {}));
  }

  // ═══════════════════════════════════════════════════════════════
  // ASOSIY MENYU NAVIGATSIYASI
  // ═══════════════════════════════════════════════════════════════
  if (!state) {
    if (text === TEXTS.btnDriver[lang]) {
      const driver = await driverService.getByChatId(chatId);
      if (driver?.approved) {
        return bot.sendMessage(chatId, t(chatId, userLang, "approved"), mainMenuKeyboard(chatId, userLang, { [chatId]: driver as any }, {}, false, {}));
      }
      userStates[chatId] = { step: "driver_name", data: {} };
      return bot.sendMessage(chatId, t(chatId, userLang, "enterName"), cancelKeyboard(chatId, userLang));
    }
    
    if (text === TEXTS.btnPassenger[lang]) {
      userStates[chatId] = { step: "passenger_route", data: {} };
      return bot.sendMessage(chatId, t(chatId, userLang, "chooseRoute"), routeKeyboard());
    }
    
    if (text === TEXTS.btnParcel[lang]) {
      userStates[chatId] = { step: "parcel_route", data: { type: "parcel" } };
      return bot.sendMessage(chatId, t(chatId, userLang, "parcelRoute"), routeKeyboard());
    }

    if (text === TEXTS.btnSOS[lang]) {
      return bot.sendMessage(chatId, t(chatId, userLang, "sosMenu"), {
        reply_markup: {
          keyboard: [[{ text: TEXTS.btnSosSend[lang] }], [{ text: TEXTS.btnSosCancel[lang] }]],
          resize_keyboard: true
        }
      });
    }

    if (text === TEXTS.btnSosSend[lang]) {
      const user = await userService.getByChatId(chatId);
      const sosMsg = `🚨 <b>SOS SIGNAL!</b>\n\n👤 Foydalanuvchi: ${user?.name || "Noma'lum"}\n📞 Tel: ${user?.phone || "Noma'lum"}\n🆔 ID: ${chatId}`;
      
      // Adminlarga yuborish
      const ADMIN_IDS = (process.env.ADMIN_IDS || "").split(",");
      for (const adminId of ADMIN_IDS) {
        try { await bot.sendMessage(adminId, sosMsg, { parse_mode: "HTML" }); } catch (e) {}
      }
      
      return bot.sendMessage(chatId, t(chatId, userLang, "sosConfirm"), mainMenuKeyboard(chatId, userLang, {}, {}, isAdmin(chatId), {}));
    }

    if (text === TEXTS.btnAdmin[lang] && isAdmin(chatId)) {
      return bot.sendMessage(chatId, "👨‍💼 Admin paneliga xush kelibsiz!", {
        reply_markup: {
          keyboard: [
            [{ text: TEXTS.btnStats[lang] }, { text: TEXTS.btnBroadcast[lang] }],
            [{ text: TEXTS.btnCancel[lang] }]
          ],
          resize_keyboard: true
        }
      });
    }
    
    // Boshqa menyu tugmalari...
    return;
  }

  // ═══════════════════════════════════════════════════════════════
  // HAYDOVCHI RO'YXATDAN O'TISHI (STEPS)
  // ═══════════════════════════════════════════════════════════════
  switch (state.step) {
    case "driver_name":
      state.data.name = text;
      state.step = "driver_phone";
      return bot.sendMessage(chatId, t(chatId, userLang, "enterPhone"), sharePhoneKeyboard(chatId, userLang));

    case "driver_phone":
      const phone = msg.contact ? msg.contact.phone_number : text;
      if (!validatePhone(phone)) {
        return bot.sendMessage(chatId, t(chatId, userLang, "enterPhone"));
      }
      state.data.phone = normalizePhone(phone);
      state.step = "driver_car_model";
      return bot.sendMessage(chatId, t(chatId, userLang, "enterCarModel"), cancelKeyboard(chatId, userLang));

    case "driver_car_model":
      if (!validateCarModel(text)) {
        return bot.sendMessage(chatId, t(chatId, userLang, "enterCarModel"));
      }
      state.data.carModel = text;
      state.step = "driver_car_num";
      return bot.sendMessage(chatId, t(chatId, userLang, "enterCarNum"));

    case "driver_car_num":
      if (!validateCarNumber(text)) {
        return bot.sendMessage(chatId, t(chatId, userLang, "enterCarNum"));
      }
      state.data.carNumber = text.toUpperCase();
      state.step = "driver_route";
      return bot.sendMessage(chatId, t(chatId, userLang, "chooseRoute"), routeKeyboard());

    case "driver_route":
      if (!ROUTES.includes(text)) {
        return bot.sendMessage(chatId, t(chatId, userLang, "chooseRoute"), routeKeyboard());
      }
      state.data.route = text;
      state.step = "driver_seats";
      return bot.sendMessage(chatId, t(chatId, userLang, "enterSeats"), cancelKeyboard(chatId, userLang));

    case "driver_seats":
      const seats = parseInt(text);
      if (isNaN(seats) || seats < 1 || seats > 6) {
        return bot.sendMessage(chatId, t(chatId, userLang, "invalidSeats"));
      }
      state.data.seats = seats;
      state.step = "driver_time";
      return bot.sendMessage(chatId, t(chatId, userLang, "enterTime"));

    case "driver_time":
      const timeCheck = validateDriverTime(text);
      if (!timeCheck.ok) {
        return bot.sendMessage(chatId, timeCheck.note || t(chatId, userLang, "enterTime"));
      }
      state.data.departureTime = text;
      state.step = "driver_price";
      return bot.sendMessage(chatId, t(chatId, userLang, "enterPrice"));

    case "driver_price":
      const price = parseInt(text.replace(/\D/g, ""));
      if (isNaN(price) || price < 5000) {
        return bot.sendMessage(chatId, t(chatId, userLang, "invalidPrice"));
      }
      state.data.price = price;
      
      // Save to database
      await driverService.create({
        chatId,
        name: state.data.name,
        phone: state.data.phone,
        carModel: state.data.carModel,
        carNumber: state.data.carNumber,
        route: state.data.route,
        seats: state.data.seats,
        departureTime: state.data.departureTime,
        price: state.data.price,
        approved: false,
        online: false
      } as any);

      delete userStates[chatId];
      return bot.sendMessage(chatId, t(chatId, userLang, "adminPending"), mainMenuKeyboard(chatId, userLang, {}, {}, false, {}));

    // ═══════════════════════════════════════════════════════════════
    // YO'LOVCHI / POSILKA (STEPS)
    // ═══════════════════════════════════════════════════════════════
    case "passenger_route":
    case "parcel_route":
      if (!ROUTES.includes(text)) {
        return bot.sendMessage(chatId, t(chatId, userLang, "chooseRoute"), routeKeyboard());
      }
      state.data.route = text;
      state.step = "passenger_name";
      return bot.sendMessage(chatId, t(chatId, userLang, "enterName"), cancelKeyboard(chatId, userLang));

    case "passenger_name":
      state.data.name = text;
      state.step = "passenger_phone";
      return bot.sendMessage(chatId, t(chatId, userLang, "enterPhone"), sharePhoneKeyboard(chatId, userLang));

    case "passenger_phone":
      const pPhone = msg.contact ? msg.contact.phone_number : text;
      if (!validatePhone(pPhone)) {
        return bot.sendMessage(chatId, t(chatId, userLang, "enterPhone"));
      }
      state.data.phone = normalizePhone(pPhone);
      if (state.data.type === "parcel") {
        state.step = "parcel_desc";
        return bot.sendMessage(chatId, t(chatId, userLang, "parcelDesc"), cancelKeyboard(chatId, userLang));
      }
      state.step = "passenger_seats";
      return bot.sendMessage(chatId, t(chatId, userLang, "enterSeatsP"), cancelKeyboard(chatId, userLang));

    case "parcel_desc":
      state.data.parcelDesc = text;
      state.step = "passenger_time";
      return bot.sendMessage(chatId, t(chatId, userLang, "enterTime"));

    case "passenger_seats":
      const pSeats = parseInt(text);
      if (isNaN(pSeats) || pSeats < 1 || pSeats > 4) {
        return bot.sendMessage(chatId, t(chatId, userLang, "invalidSeats"));
      }
      state.data.seats = pSeats;
      state.step = "passenger_time";
      return bot.sendMessage(chatId, t(chatId, userLang, "enterTime"));

    case "passenger_time":
      if (!validateTime(text)) {
        return bot.sendMessage(chatId, t(chatId, userLang, "enterTime"));
      }
      state.data.departureTime = text;

      // Buyurtmani yaratish
      const [newOrder] = await orderService.create({
        passengerId: chatId,
        route: state.data.route,
        seats: state.data.seats || 0,
        departureTime: state.data.departureTime,
        type: state.data.type || "passenger",
        parcelDesc: state.data.parcelDesc,
        status: "pending"
      } as any);

      await notifyDrivers(bot, {
        id: newOrder.id,
        passenger: {
          chatId,
          name: state.data.name,
          phone: state.data.phone,
          route: state.data.route,
          departureTime: state.data.departureTime,
          seats: state.data.seats || 0
        },
        type: state.data.type || "passenger",
        parcelDesc: state.data.parcelDesc,
        status: "pending",
        createdAt: new Date(),
        retryCount: 0,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000)
      } as any, userLang);

      delete userStates[chatId];
      return bot.sendMessage(chatId, t(chatId, userLang, "orderSent"), mainMenuKeyboard(chatId, userLang, {}, {}, false, {}));
  }
}
