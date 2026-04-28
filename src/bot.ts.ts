import TelegramBot from "node-telegram-bot-api";
import * as fs from "fs";
import * as path from "path";
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

// ═══════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════
const CONFIG = {
  ORDER_EXPIRY_MINUTES: 15,
  AUTO_RETRY_ENABLED: true,
  MAX_AUTO_RETRIES: 3,
  BREAK_DURATIONS: [30, 60, 120, 180],
  LEADERBOARD_TOP: 10,
  EARNINGS_PER_PAGE: 5,
  CLEANUP_INTERVAL_MS: 30 * 60 * 1000,
  SURGE_THRESHOLD: 5,
  WAIT_TIME_BASE_MINUTES: 5,
  MAX_ORDER_AGE_HOURS: 24,
  BROADCAST_CHUNK_SIZE: 30,
  BROADCAST_DELAY_MS: 1000,
};

// ═══════════════════════════════════════════════════════════════
// TRANSLATIONS
// ═══════════════════════════════════════════════════════════════
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
  announceRoute:  { uz: "📍 Qaysi yo'nalish bo'yicha ko'rmoqchisiz?", ru: "📍 По какому маршруту хотите посмотреть?" },
  announceAll:    { uz: "🌐 Barcha yo'nalishlar", ru: "🌐 Все маршруты" },
  noDriversRoute: { uz: "😔 Bu yo'nalishda online haydovchi yo'q.", ru: "😔 На этом маршруте нет онлайн водителей." },
  btnOrderDriver: { uz: "🚕 Buyurtma berish", ru: "🚕 Заказать" },
  btnCallDriver:  { uz: "📞 Telefon ko'rish", ru: "📞 Показать телефон" },
  btnBackRoutes:  { uz: "◀️ Yo'nalishlar", ru: "◀️ Маршруты" },
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
  btnSOS:         { uz: "🆘 SOS - Xavfsizlik",       ru: "🆘 SOS - Безопасность" },
  sosConfirm:     { uz: "🆘 SOS xabar yuborildi! Admin va haydovchi darhol xabardor qilindi!", ru: "🆘 SOS отправлен! Администратор и водитель немедленно уведомлены!" },
  sosAlert:       { uz: "🚨 XAVFLI HOLAT - SOS SIGNAL!", ru: "🚨 ОПАСНАЯ СИТУАЦИЯ - SOS СИГНАЛ!" },
  sosMenu:        { uz: "🆘 SOS menyusi. Xavfli holatda foydalaning:", ru: "🆘 SOS меню. Используйте в опасной ситуации:" },
  btnSosSend:     { uz: "🚨 XAVFDA EKANMAN - SOS YUBORISH", ru: "🚨 Я В ОПАСНОСТИ - ОТПРАВИТЬ SOS" },
  btnSosCancel:   { uz: "✅ Xavfsizman - Orqaga", ru: "✅ Я в безопасности - Назад" },
  blacklisted:    { uz: "🚫 Siz tizimdan chiqarilgansiz. Muammo uchun: @admin", ru: "🚫 Вы заблокированы. По вопросам: @admin" },
  btnBlacklist:   { uz: "🚫 Blacklist",              ru: "🚫 Чёрный список" },
  noBlacklist:    { uz: "Blacklist bo'sh.", ru: "Чёрный список пуст." },
  btnQuickOrder:  { uz: "⚡ Tez buyurtma",           ru: "⚡ Быстрый заказ" },
  noLastOrder:    { uz: "Avvalgi buyurtma yo'q.", ru: "Предыдущего заказа нет." },
  quickOrderInfo: { uz: "⚡ Oxirgi buyurtmangiz:", ru: "⚡ Ваш последний заказ:" },
  quickOrderDone: { uz: "✅ Tez buyurtma yuborildi!", ru: "✅ Быстрый заказ отправлен!" },
  btnShareLoc:    { uz: "📍 Joylashuvni ulashish (ixtiyoriy)", ru: "📍 Поделиться местоположением (необязательно)" },
  btnSkipLoc:     { uz: "⏭ O'tkazib yuborish",      ru: "⏭ Пропустить" },
  locShared:      { uz: "📍 Joylashuvingiz haydovchiga yuborildi!", ru: "📍 Ваше местоположение отправлено водителю!" },
  locFromPass:    { uz: "📍 Yo'lovchi joylashuvi:", ru: "📍 Местоположение пассажира:" },
  btnBroadcast:   { uz: "📢 Hammaga xabar",          ru: "📢 Сообщение всем" },
  broadcastPrompt:{ uz: "📢 Barcha foydalanuvchilarga yuboriladigan xabarni yozing:", ru: "📢 Напишите сообщение для всех пользователей:" },
  broadcastSent:  { uz: "✅ Xabar yuborildi: {count} nafar.", ru: "✅ Сообщение отправлено: {count} чел." },
  btnStats:       { uz: "📊 Statistika",             ru: "📊 Статистика" },
  btnMyOrders:    { uz: "📋 Faol buyurtmalarim",     ru: "📋 Мои активные заказы" },
  noActiveOrders: { uz: "📋 Faol buyurtma yo'q.",    ru: "📋 Нет активных заказов." },
  btnMyStats:     { uz: "📊 Mening statistikam",     ru: "📊 Моя статистика" },
  btnTomorrow:    { uz: "📅 Ertangi bron",           ru: "📅 Бронь на завтра" },
  tomorrowInfo:   { uz: "📅 Ertangi bron — ertaga jo'nash uchun joy band qiling:", ru: "📅 Бронь на завтра — забронируйте место на завтра:" },
  tomorrowDone:   { uz: "✅ Ertangi bron qabul qilindi! Haydovchi topilganda xabar beramiz. 🔔", ru: "✅ Бронь на завтра принята! Уведомим вас, когда найдём водителя. 🔔" },
  btnAdminReply:  { uz: "💬 Foydalanuvchiga javob", ru: "💬 Ответить пользователю" },
  adminReplyWho:  { uz: "👤 Kimga javob yozmoqchisiz? Foydalanuvchini tanlang:", ru: "👤 Кому хотите ответить? Выберите пользователя:" },
  adminReplyType: { uz: "✏️ Xabaringizni yozing (foydalanuvchi ko'radi):", ru: "✏️ Напишите сообщение (пользователь увидит):" },
  adminReplySent: { uz: "✅ Xabar yuborildi!", ru: "✅ Сообщение отправлено!" },
  msgFromAdmin:   { uz: "📩 Admin xabari:", ru: "📩 Сообщение от администратора:" },
  btnEdit:        { uz: "🔄 Ma'lumotlarni tahrirlash", ru: "🔄 Редактировать данные" },
  editWhat:       { uz: "Nimani o'zgartirmoqchisiz?", ru: "Что хотите изменить?" },
  editDone:       { uz: "✅ Ma'lumot yangilandi!", ru: "✅ Данные обновлены!" },
  editPriceBtn:   { uz: "💰 Narx", ru: "💰 Цена" },
  editTimeBtn:    { uz: "🕐 Vaqt", ru: "🕐 Время" },
  editSeatsBtn:   { uz: "💺 O'rindiq", ru: "💺 Места" },
  editRouteBtn:   { uz: "📍 Yo'nalish", ru: "📍 Маршрут" },
  rejectReason:   { uz: "❓ Rad etish sababini yozing (yo'lovchiga yuboriladi):", ru: "❓ Напишите причину отказа (пассажир увидит):" },
  rejectedReason: { uz: "😔 Haydovchi buyurtmangizni rad etdi.\n📝 Sabab:", ru: "😔 Водитель отклонил ваш заказ.\n📝 Причина:" },
  reviewPrompt:   { uz: "💬 Izoh qoldiring (ixtiyoriy). O'tkazib yuborish uchun — /skip:", ru: "💬 Оставьте отзыв (необязательно). Пропустить — /skip:" },
  reviewSaved:    { uz: "✅ Izohingiz qabul qilindi. Rahmat!", ru: "✅ Отзыв сохранён. Спасибо!" },
  btnReminder:    { uz: "🔔 Eslatma sozlamasi", ru: "🔔 Настройка напоминания" },
  reminderOnMsg:  { uz: "🔔 Eslatma YOQILDI — jo'nashdan 30 daqiqa oldin xabar olasiz.", ru: "🔔 Напоминание ВКЛЮЧЕНО — получите уведомление за 30 минут." },
  reminderOffMsg: { uz: "🔕 Eslatma O'CHIRILDI — endi xabar kelmaydi.", ru: "🔕 Напоминание ОТКЛЮЧЕНО — уведомлений не будет." },
  btnHelp:        { uz: "❓ Yordam", ru: "❓ Помощь" },
  helpText:       { uz: `❓ <b>Bot haqida yordam</b>\n\n🚗 <b>Haydovchi</b> — ro'yxatdan o'ting, tasdiqlanganingizdan so'ng buyurtmalar olasiz.\n🟢 Online tugmasini bossangiz — buyurtmalar kela boshlaydi.\n\n🧑 <b>Yo'lovchi</b> — yo'nalishni tanlang, ma'lumotlaringizni kiriting, haydovchi topilganda xabar keladi.\n\n📅 <b>Ertangi bron</b> — ertaga uchun joy oldindan band qilish.\n\n📋 <b>Faol buyurtmalarim</b> — buyurtmalaringizni ko'ring, bekor qiling.\n\n📢 <b>E'lonlar</b> — online haydovchilarni ko'ring va bevosita buyurtma bering.\n\n📦 <b>Posilka</b> — tovar yoki hujjat yuborish.\n\n🆘 <b>SOS</b> — xavfli holatda bosing — admin va haydovchi darhol xabardor bo'ladi.\n\n🤝 <b>Referal</b> — do'stlarni taklif qiling!`, ru: `❓ <b>Помощь по боту</b>\n\n🚗 <b>Водитель</b> — зарегистрируйтесь, после подтверждения получайте заказы.\n🟢 Нажмите Онлайн — заказы начнут поступать.\n\n🧑 <b>Пассажир</b> — выберите маршрут, введите данные, получите уведомление когда найдётся водитель.\n\n📅 <b>Бронь на завтра</b> — забронируйте место заранее.\n\n📋 <b>Мои активные заказы</b> — просматривайте и отменяйте заказы.\n\n📢 <b>Объявления</b> — смотрите онлайн водителей и заказывайте напрямую.\n\n📦 <b>Посылка</b> — отправить товар или документы.\n\n🆘 <b>SOS</b> — в опасной ситуации — нажмите, администратор и водитель сразу узнают.\n\n🤝 <b>Реферал</b> — приглашайте друзей!` },
  btnReferral:    { uz: "🤝 Do'stni taklif qil", ru: "🤝 Пригласить друга" },
  referralText:   { uz: "🤝 <b>Referal tizimi</b>\n\nDo'stlaringizni taklif qiling!\nSizning shaxsiy linkingiz:", ru: "🤝 <b>Реферальная система</b>\n\nПриглашайте друзей!\nВаша персональная ссылка:" },
  referralCount:  { uz: "👥 Siz taklif qilganlar:", ru: "👥 Вы пригласили:" },
  adminExport:    { uz: "📤 Haydovchilar eksporti", ru: "📤 Экспорт водителей" },
  adminTomorrow:  { uz: "📅 Ertangi bronlar", ru: "📅 Брони на завтра" },

  // ═══ PRO DRIVER FEATURES ═══
  btnSchedule:    { uz: "📅 Jadval", ru: "📅 Расписание" },
  btnEarnings:    { uz: "💵 Daromadlar", ru: "💵 Доходы" },
  btnAnalytics:   { uz: "📊 Tahlil", ru: "📊 Аналитика" },
  btnBreak:       { uz: "⏸️ Tanaffus", ru: "⏸️ Перерыв" },
  btnLeaderboard: { uz: "🏆 Yetakchilar", ru: "🏆 Лидеры" },
  scheduleTitle:  { uz: "📅 Haftalik jadval", ru: "📅 Недельное расписание" },
  scheduleSet:    { uz: "✅ Jadval saqlandi!", ru: "✅ Расписание сохранено!" },
  schedulePrompt: { uz: "Faol kunlarni tanlang (1-7):\n1-Dushanba, 2-Seshanba...\nMasalan: 1,2,3,4,5", ru: "Выберите активные дни (1-7):\n1-Пн, 2-Вт...\nНапример: 1,2,3,4,5" },
  scheduleTime:   { uz: "Ish vaqtini kiriting (masalan: 08:00-20:00):", ru: "Введите рабочее время (например: 08:00-20:00):" },
  earningsTitle:  { uz: "💵 Daromadlar", ru: "💵 Доходы" },
  earningsEmpty:  { uz: "Hozircha daromad yo'q.", ru: "Пока нет доходов." },
  earningsDaily:  { uz: "📅 Bugun", ru: "📅 Сегодня" },
  earningsWeekly: { uz: "📅 Bu hafta", ru: "📅 Эта неделя" },
  earningsMonthly:{ uz: "📅 Bu oy", ru: "📅 Этот месяц" },
  analyticsTitle: { uz: "📊 Reyting tahlili", ru: "📊 Анализ рейтинга" },
  breakPrompt:    { uz: "Tanaffuz muddatini tanlang:", ru: "Выберите длительность перерыва:" },
  breakSet:       { uz: "⏸️ Tanaffus rejimi yoqildi. {min} daqiqadan so'ng avtomatik online bo'lasiz.", ru: "⏸️ Режим перерыва включён. Через {min} минут вы автоматически станете онлайн." },
  breakDone:      { uz: "✅ Tanaffus tugadi! Online rejimga qaytdingiz.", ru: "✅ Перерыв окончен! Вы снова онлайн." },
  leaderboardTitle:{ uz: "🏆 Eng yaxshi haydovchilar", ru: "🏆 Лучшие водители" },
  leaderboardPos: { uz: "Sizning o'rningiz", ru: "Ваша позиция" },

  // ═══ PRO PASSENGER FEATURES ═══
  btnFavorites:   { uz: "⭐ Sevimli haydovchilar", ru: "⭐ Любимые водители" },
  btnSavedPlaces: { uz: "🏠 Saqlangan manzillar", ru: "🏠 Сохранённые адреса" },
  btnBookForOther:{ uz: "👤 Boshqa uchun buyurtma", ru: "👤 Заказ для другого" },
  btnOrderNotes:  { uz: "📝 Buyurtma izohi", ru: "📝 Примечание к заказу" },
  btnEmergency:   { uz: "🆘 Favqulodda kontakt", ru: "🆘 Экстренный контакт" },
  btnShareTrip:   { uz: "📤 Sayohatni ulashish", ru: "📤 Поделиться поездкой" },
  btnQuickMsgs:   { uz: "💬 Tez xabarlar", ru: "💬 Быстрые сообщения" },
  favoritesTitle: { uz: "⭐ Sevimli haydovchilar", ru: "⭐ Любимые водители" },
  noFavorites:    { uz: "Hozircha sevimli haydovchi yo'q.", ru: "Пока нет любимых водителей." },
  favoriteAdded:  { uz: "⭐ Haydovchi sevimlilarga qo'shildi!", ru: "⭐ Водитель добавлен в избранное!" },
  savedPlacesTitle:{ uz: "🏠 Saqlangan manzillar", ru: "🏠 Сохранённые адреса" },
  noSavedPlaces:  { uz: "Hozircha saqlangan manzil yo'q.", ru: "Пока нет сохранённых адресов." },
  addressAdded:   { uz: "✅ Manzil saqlandi!", ru: "✅ Адрес сохранён!" },
  bookForOtherTitle:{ uz: "👤 Boshqa uchun buyurtma", ru: "👤 Заказ для другого" },
  bookForOtherName:{ uz: "Yo'lovchi ismini kiriting:", ru: "Введите имя пассажира:" },
  bookForOtherPhone:{ uz: "Yo'lovchi telefonini kiriting:", ru: "Введите телефон пассажира:" },
  emergencyTitle: { uz: "🆘 Favqulodda kontakt", ru: "🆘 Экстренный контакт" },
  emergencySet:   { uz: "✅ Favqulodda kontakt saqlandi!", ru: "✅ Экстренный контакт сохранён!" },
  emergencyPrompt:{ uz: "Kontakt ismini kiriting:", ru: "Введите имя контакта:" },
  orderNotesPrompt:{ uz: "📝 Haydovchiga izoh (yuk, bolalar, hayvonlar):", ru: "📝 Примечание водителю (багаж, дети, животные):" },
  shareTripText:  { uz: "📤 Sayohat ma'lumotlari:", ru: "📤 Данные поездки:" },
  quickMsgTitle:  { uz: "💬 Tez xabar tanlang:", ru: "💬 Выберите быстрое сообщение:" },
  waitTimeEst:    { uz: "⏱️ Taxminiy kutish vaqti: {time} daqiqa", ru: "⏱️ Примерное время ожидания: {time} мин" },
  orderExpired:   { uz: "⏳ Buyurtma muddati tugadi. Qayta urinib ko'ring.", ru: "⏳ Срок заказа истёк. Попробуйте снова." },
  autoRetryOn:    { uz: "🔄 Avto-qayta qidiruv YOQILDI", ru: "🔄 Авто-поиск ВКЛЮЧЁН" },
  autoRetryOff:   { uz: "🔄 Avto-qayta qidiruv O'CHIRILDI", ru: "🔄 Авто-поиск ОТКЛЮЧЁН" },
  surgeNotice:    { uz: "⚡ Bu yo'nalishda talab yuqori! Narx oshishi mumkin.", ru: "⚡ На этом маршруте высокий спрос! Цена может вырасти." },

  // ═══ ADMIN PRO ═══
  btnRouteAnalytics:{ uz: "📊 Yo'nalish analitikasi", ru: "📊 Аналитика маршрутов" },
  btnLeaderboardAdmin:{ uz: "🏆 Yetakchilar ro'yxati", ru: "🏆 Список лидеров" },
  btnScheduledBroadcast:{ uz: "📅 Rejalashtirilgan xabar", ru: "📅 Запланированное сообщение" },
  btnMassApprove: { uz: "✅ Mass tasdiqlash", ru: "✅ Массовое подтверждение" },
  btnCleanup:     { uz: "🧹 Tozalash", ru: "🧹 Очистка" },
  routeAnalyticsTitle:{ uz: "📊 Yo'nalish analitikasi", ru: "📊 Аналитика маршрутов" },
  massApproveDone:{ uz: "✅ {count} ta haydovchi tasdiqlandi!", ru: "✅ Подтверждено {count} водителей!" },
  cleanupDone:    { uz: "🧹 {count} ta eski ma'lumot tozalandi.", ru: "🧹 Очищено {count} старых записей." },
  cancelled:      { uz: "❌ Amal bekor qilindi.", ru: "❌ Действие отменено." },
  btnAdminUsers:  { uz: "👥 Foydalanuvchilar", ru: "👥 Пользователи" },
  scheduledSet:   { uz: "✅ Xabar rejalashtirildi!", ru: "✅ Сообщение запланировано!" },
};

function t(chatId: number, key: string, vars?: Record<string, string>): string {
  const lang = userLang[chatId] || "uz";
  let text = TEXTS[key]?.[lang] ?? key;
  if (vars) {
    Object.entries(vars).forEach(([k, v]) => {
      text = text.replace(new RegExp(`{${k}}`, "g"), v);
    });
  }
  return text;
}

// ═══════════════════════════════════════════════════════════════
// INTERFACES
// ═══════════════════════════════════════════════════════════════
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
  comment?: string;
  price: number;
}

interface WeeklySchedule {
  mon: boolean; tue: boolean; wed: boolean; thu: boolean; fri: boolean; sat: boolean; sun: boolean;
  startTime: string;
  endTime: string;
}

interface EarningsEntry {
  date: string;
  amount: number;
  route: string;
  passengerName: string;
  orderId: string;
}

interface SavedAddress {
  name: string;
  address: string;
  type: "home" | "work" | "other";
}

interface PassengerPrefs {
  luggage?: boolean;
  kids?: boolean;
  pets?: boolean;
  smoking?: boolean;
  notes?: string;
}

interface EmergencyContact {
  name: string;
  phone: string;
}

interface DriverAnalytics {
  routeCounts: Record<string, number>;
  hourlyDistribution: Record<string, number>;
  dailyEarnings: Record<string, number>;
  categoryRatings: {
    punctuality: number[];
    cleanliness: number[];
    driving: number[];
    behavior: number[];
  };
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
  schedule?: WeeklySchedule;
  earnings: EarningsEntry[];
  analytics: DriverAnalytics;
  breakUntil?: Date;
  dailyOrders: number;
  lastOrderDate: string;
}

interface Passenger {
  chatId: number;
  name: string;
  phone: string;
  route: string;
  seats: number;
  departureTime: string;
  location?: { latitude: number; longitude: number };
  favorites: number[];
  savedAddresses: SavedAddress[];
  emergencyContact?: EmergencyContact;
  prefs?: PassengerPrefs;
}

interface LastOrder {
  route: string;
  seats: number;
  name: string;
  phone: string;
}

interface Order {
  id: string;
  passenger: Passenger;
  driverId: number | null;
  status: "pending" | "accepted" | "completed" | "rejected" | "expired";
  createdAt: Date;
  rated: boolean;
  type: "passenger" | "parcel";
  parcelDesc?: string;
  scheduledDate?: string;
  prefs?: PassengerPrefs;
  retryCount: number;
  expiresAt: Date;
  isBookedForOther?: boolean;
  actualPassengerName?: string;
  actualPassengerPhone?: string;
}

interface Complaint {
  id: string;
  from: number;
  fromName: string;
  route: string;
  text: string;
  createdAt: Date;
  resolved: boolean;
}

interface SosAlert {
  id: string;
  from: number;
  fromName: string;
  phone: string;
  orderId?: string;
  driverName?: string;
  driverPhone?: string;
  carNumber?: string;
  route?: string;
  createdAt: Date;
}

interface BlacklistEntry {
  chatId: number;
  name: string;
  phone: string;
  reason: string;
  addedAt: Date;
}

interface ScheduledBroadcast {
  id: string;
  message: string;
  scheduledAt: Date;
  sent: boolean;
}

// ═══════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════
const userStates: Record<number, { step: string; data: Record<string, any> }> = {};
const drivers: Record<number, Driver> = {};
const passengers: Record<number, Passenger> = {};
const orders: Record<string, Order> = {};
const complaints: Complaint[] = [];
const sosAlerts: SosAlert[] = [];
const blacklist: Record<number, BlacklistEntry> = {};
const activeChats: Record<number, number> = {};
const reminders: Record<string, ReturnType<typeof setTimeout>> = {};
const lastOrders: Record<number, LastOrder> = {};
const allUsers: Set<number> = new Set();
const reminderEnabled: Record<number, boolean> = {};
const referrals: Record<number, number[]> = {};
const autoRetryEnabled: Record<number, boolean> = {};
const scheduledBroadcasts: ScheduledBroadcast[] = [];
const routeStats: Record<string, { orders: number; lastOrder: Date }> = {};

const DATA_DIR = path.resolve(process.cwd(), ".bot-data");
const DATA_FILE = path.join(DATA_DIR, "taxi-bot-state.json");
let stateDirty = false;

function reviveDate(value?: string | Date | null): Date | undefined {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function markDirty() {
  stateDirty = true;
}

function persistState(force = false) {
  if (!force && !stateDirty) return;
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const payload = {
      userStates,
      userLang,
      drivers,
      passengers,
      orders,
      complaints,
      sosAlerts,
      blacklist,
      activeChats,
      lastOrders,
      allUsers: [...allUsers],
      reminderEnabled,
      referrals,
      autoRetryEnabled,
      scheduledBroadcasts,
      routeStats,
    };
    const tmpFile = `${DATA_FILE}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(payload, null, 2), "utf-8");
    fs.renameSync(tmpFile, DATA_FILE);
    stateDirty = false;
  } catch (error) {
    logger.error({ error }, "State persistence failed");
  }
}

function loadState() {
  if (!fs.existsSync(DATA_FILE)) return;
  try {
    const raw = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
    Object.assign(userStates, raw.userStates || {});
    Object.assign(userLang, raw.userLang || {});
    Object.entries(raw.drivers || {}).forEach(([id, d]: [string, any]) => {
      drivers[Number(id)] = {
        ...d,
        lastSeen: reviveDate(d.lastSeen),
        breakUntil: reviveDate(d.breakUntil),
        earnings: d.earnings || [],
        trips: d.trips || [],
        analytics: d.analytics || {
          routeCounts: {},
          hourlyDistribution: {},
          dailyEarnings: {},
          categoryRatings: { punctuality: [], cleanliness: [], driving: [], behavior: [] },
        },
      };
    });
    Object.assign(passengers, raw.passengers || {});
    Object.entries(raw.orders || {}).forEach(([id, order]: [string, any]) => {
      orders[id] = {
        ...order,
        createdAt: reviveDate(order.createdAt) || new Date(),
        expiresAt: reviveDate(order.expiresAt) || new Date(Date.now() + CONFIG.ORDER_EXPIRY_MINUTES * 60 * 1000),
      };
    });
    (raw.complaints || []).forEach((item: any) => complaints.push({ ...item, createdAt: reviveDate(item.createdAt) || new Date() }));
    (raw.sosAlerts || []).forEach((item: any) => sosAlerts.push({ ...item, createdAt: reviveDate(item.createdAt) || new Date() }));
    Object.entries(raw.blacklist || {}).forEach(([id, item]: [string, any]) => {
      blacklist[Number(id)] = { ...item, addedAt: reviveDate(item.addedAt) || new Date() };
    });
    Object.assign(activeChats, raw.activeChats || {});
    Object.assign(lastOrders, raw.lastOrders || {});
    (raw.allUsers || []).forEach((id: number | string) => allUsers.add(Number(id)));
    Object.assign(reminderEnabled, raw.reminderEnabled || {});
    Object.assign(referrals, raw.referrals || {});
    Object.assign(autoRetryEnabled, raw.autoRetryEnabled || {});
    (raw.scheduledBroadcasts || []).forEach((item: any) => scheduledBroadcasts.push({ ...item, scheduledAt: reviveDate(item.scheduledAt) || new Date() }));
    Object.entries(raw.routeStats || {}).forEach(([route, item]: [string, any]) => {
      routeStats[route] = {
        orders: item.orders || 0,
        lastOrder: reviveDate(item.lastOrder) || new Date(),
      };
    });
    logger.info(`Loaded persisted bot state from ${DATA_FILE}`);
  } catch (error) {
    logger.error({ error }, "State loading failed");
  }
}

// ═══════════════════════════════════════════════════════════════
// VALIDATION
// ═══════════════════════════════════════════════════════════════
function normalizePhone(p: string) { return p.replace(/[\s\-\(\)\+]/g, ""); }
function validateCarNumber(n: string) { return /^\d{2}[A-Z]\d{3}[A-Z]{2}$/i.test(n.replace(/\s/g, "")); }
function validateTime(t: string) { return /^([01]\d|2[0-3]):([0-5]\d)$/.test(t.trim()); }
function validatePhone(p: string) { return /^(998)?\d{9}$/.test(normalizePhone(p)); }
function normalizeStoredPhone(phone: string): string {
  const normalized = normalizePhone(phone);
  if (/^998\d{9}$/.test(normalized)) return normalized;
  if (/^\d{9}$/.test(normalized)) return `998${normalized}`;
  return normalized;
}
function getSavedPassengerProfile(chatId: number): { name: string; phone: string } | null {
  const passenger = passengers[chatId];
  if (passenger?.name?.trim() && validatePhone(passenger.phone || "")) {
    return { name: passenger.name.trim(), phone: normalizeStoredPhone(passenger.phone) };
  }
  const last = lastOrders[chatId];
  if (last?.name?.trim() && validatePhone(last.phone || "")) {
    return { name: last.name.trim(), phone: normalizeStoredPhone(last.phone) };
  }
  return null;
}
function validateDriverTime(t: string): { ok: boolean; note?: string } {
  if (!validateTime(t)) return { ok: false, note: "To'g'ri format: 08:30" };
  const [h] = t.split(":").map(Number);
  if (h < 4 || h > 22) return { ok: false, note: "Vaqt 04:00–22:00 oralig'ida bo'lishi kerak" };
  return { ok: true };
}
function isDuplicatePhone(phone: string, excludeId?: number): boolean {
  const norm = normalizePhone(phone);
  return Object.values(drivers).some((d) => d.chatId !== excludeId && normalizePhone(d.phone) === norm);
}
function isDuplicateCarNumber(carNum: string, excludeId?: number): boolean {
  const norm = carNum.replace(/\s/g, "").toUpperCase();
  return Object.values(drivers).some((d) => d.chatId !== excludeId && d.carNumber.replace(/\s/g, "").toUpperCase() === norm);
}

const KNOWN_CAR_MODELS = [
  "cobalt","lacetti","nexia","matiz","spark","malibu","tracker","equinox","captiva",
  "gentra","talisman","damas","labo","orlando","aveo","cruze","epica","evanda",
  "camry","corolla","prius","yaris","rav4","land cruiser","hilux","hiace",
  "accent","tucson","sonata","elantra","santa fe","creta","solaris",
  "rio","sportage","sorento","cerato","optima","carnival","stinger",
  "onix","monza","groove","traverse",
  "logan","duster","sandero","dokker","lodgy","kaptur",
  "polo","jetta","golf","passat","tiguan","touareg",
  "a6","a4","q5","q7","q3","e class","c class","s class","glc","gle",
  "model 3","model s","model x","model y",
  "zafira","astra","insignia","mokka","grandland",
  "swift","vitara","jimny","sx4","grand vitara","carry",
  "x5","x3","x1","3 series","5 series","7 series",
  "cx5","cx3","cx30","mazda3","mazda6",
  "transit","focus","fiesta","mondeo","kuga","explorer","ranger","f150",
  "ram","dodge","jeep","wrangler","cherokee","renegade",
  "haval","chery","geely","byd","great wall","changan","tank","bestune",
  "silverado","tahoe","suburban","colorado",
  "kia","hyundai","tesla","volkswagen","bmw","mercedes","audi","lexus",
];
function validateCarModel(model: string): boolean {
  const lower = model.trim().toLowerCase();
  if (lower.length < 2) return false;
  return KNOWN_CAR_MODELS.some((m) => lower.includes(m) || m.includes(lower));
}

function autoVerifyDriver(data: Partial<Driver>, excludeId?: number): VerificationResult {
  const dupPhone = isDuplicatePhone(data.phone || "", excludeId);
  const dupCar   = isDuplicateCarNumber(data.carNumber || "", excludeId);
  const checks = [
    { label: "Ism to'g'riligi",     ok: (data.name?.trim().split(/\s+/).length || 0) >= 1 && (data.name?.trim().length || 0) >= 3, note: "Ism kamida 3 harf bo'lsin" },
    { label: "Telefon raqam",       ok: validatePhone(data.phone || "") && !dupPhone,       note: dupPhone ? "Bu raqam allaqachon ro'yxatda" : "To'g'ri format: 998901234567" },
    { label: "Mashina modeli",      ok: validateCarModel(data.carModel || ""),              note: "Noto'g'ri model (masalan: Cobalt, Nexia, Lacetti)" },
    { label: "Mashina raqami",      ok: validateCarNumber(data.carNumber || "") && !dupCar, note: dupCar ? "Bu raqam allaqachon ro'yxatda" : "Format: 01A123BC" },
    { label: "Narx diapazoni",      ok: (data.price || 0) >= 5000 && (data.price || 0) <= 5000000, note: "5,000–5,000,000 so'm" },
  ].map((c) => ({ ...c, note: c.ok ? undefined : c.note }));
  const score = checks.filter((c) => c.ok).length;
  return { passed: score === checks.length, checks, score };
}

function formatVerificationCard(v: VerificationResult): string {
  const badge = v.passed ? "🟢 TASDIQLANDI" : v.score >= 4 ? "🟡 DEYARLI" : v.score >= 2 ? "🟠 QISMAN" : "🔴 XATOLIKLAR";
  const lines = v.checks.map((c) => `${c.ok ? "✅" : "❌"} ${c.label}${c.note ? ` — <i>${c.note}</i>` : ""}`);
  return `🔍 <b>Avto tekshruv:</b> ${badge} (${v.score}/${v.checks.length})\n${lines.join("\n")}`;
}

function formatRating(driver: Driver): string {
  if (driver.ratingCount === 0) return "⭐ Baho yo'q";
  const avg = (driver.totalRating / driver.ratingCount).toFixed(1);
  return `⭐ ${avg} (${driver.ratingCount} baho)`;
}

// ═══════════════════════════════════════════════════════════════
// PRO HELPERS
// ═══════════════════════════════════════════════════════════════
function getTodayStr(): string {
  return new Date().toLocaleDateString("uz-UZ", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function getWeekStart(): Date {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

function getMonthStart(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function isDateInRange(dateStr: string, start: Date, end: Date): boolean {
  const [d, m, y] = dateStr.split(".").map(Number);
  const date = new Date(y, m - 1, d);
  return date >= start && date <= end;
}

function getDriverLeaderboard(): Driver[] {
  return Object.values(drivers)
    .filter((d) => d.approved && !d.blocked && d.ratingCount > 0)
    .sort((a, b) => (b.totalRating / b.ratingCount) - (a.totalRating / a.ratingCount))
    .slice(0, CONFIG.LEADERBOARD_TOP);
}

function getDriverPosition(chatId: number): number {
  const list = Object.values(drivers)
    .filter((d) => d.approved && !d.blocked && d.ratingCount > 0)
    .sort((a, b) => (b.totalRating / b.ratingCount) - (a.totalRating / a.ratingCount));
  return list.findIndex((d) => d.chatId === chatId) + 1;
}

function getWaitTimeEstimate(route: string): number {
  const onlineCount = Object.values(drivers).filter((d) => d.approved && !d.blocked && d.online && d.route === route).length;
  if (onlineCount === 0) return 0;
  return Math.max(3, Math.round(CONFIG.WAIT_TIME_BASE_MINUTES / Math.sqrt(onlineCount)));
}

function isSurgeActive(route: string): boolean {
  const pendingCount = Object.values(orders).filter((o) => o.passenger.route === route && o.status === "pending").length;
  return pendingCount >= CONFIG.SURGE_THRESHOLD;
}

function formatEarnings(entries: EarningsEntry[], period: string): string {
  if (entries.length === 0) return TEXTS.earningsEmpty.uz;
  const total = entries.reduce((s, e) => s + e.amount, 0);
  let txt = `💵 <b>${period}</b>\n💰 Jami: <b>${total.toLocaleString()} so'm</b>\n🛣️ ${entries.length} ta safar\n\n`;
  entries.slice(0, CONFIG.EARNINGS_PER_PAGE).forEach((e, i) => {
    txt += `${i + 1}. 📅 ${e.date} | 📍 ${e.route}\n   👤 ${e.passengerName} | 💰 ${e.amount.toLocaleString()} so'm\n`;
  });
  return txt;
}

function formatDriverAnalytics(driver: Driver): string {
  const a = driver.analytics;
  const totalTrips = driver.trips.length;
  const topRoute = Object.entries(a.routeCounts).sort((x, y) => y[1] - x[1])[0];
  const avgPunct = a.categoryRatings.punctuality.length > 0 ? (a.categoryRatings.punctuality.reduce((s, v) => s + v, 0) / a.categoryRatings.punctuality.length).toFixed(1) : "—";
  const avgClean = a.categoryRatings.cleanliness.length > 0 ? (a.categoryRatings.cleanliness.reduce((s, v) => s + v, 0) / a.categoryRatings.cleanliness.length).toFixed(1) : "—";
  const avgDrive = a.categoryRatings.driving.length > 0 ? (a.categoryRatings.driving.reduce((s, v) => s + v, 0) / a.categoryRatings.driving.length).toFixed(1) : "—";
  const avgBehav = a.categoryRatings.behavior.length > 0 ? (a.categoryRatings.behavior.reduce((s, v) => s + v, 0) / a.categoryRatings.behavior.length).toFixed(1) : "—";

  let txt = `📊 <b>Reyting tahlili</b>\n\n`;
  txt += `🛣️ Jami safarlar: <b>${totalTrips}</b>\n`;
  if (topRoute) txt += `📍 Eng mashhur yo'nalish: <b>${topRoute[0]}</b> (${topRoute[1]} ta)\n`;
  txt += `\n⭐ <b>Kategoriyalar bo'yicha:</b>\n`;
  txt += `   🕐 Punktuallik: ${avgPunct}\n`;
  txt += `   🧹 Tozalik: ${avgClean}\n`;
  txt += `   🚗 Haydash: ${avgDrive}\n`;
  txt += `   🤝 Muomala: ${avgBehav}\n`;
  txt += `\n🏆 <b>Yetakchilar ro'yxatida o'rningiz:</b> ${getDriverPosition(driver.chatId) || "—"}`;
  return txt;
}

function initDriverDefaults(chatId: number): void {
  if (!drivers[chatId]) return;
  const d = drivers[chatId];
  if (!d.earnings) d.earnings = [];
  if (!d.analytics) {
    d.analytics = {
      routeCounts: {},
      hourlyDistribution: {},
      dailyEarnings: {},
      categoryRatings: { punctuality: [], cleanliness: [], driving: [], behavior: [] },
    };
  }
  if (!d.dailyOrders) d.dailyOrders = 0;
  if (!d.lastOrderDate) d.lastOrderDate = getTodayStr();
}

// ═══════════════════════════════════════════════════════════════
// SAFE CALLBACK ANSWER (fixes duplicate answer issues)
// ═══════════════════════════════════════════════════════════════
async function answerCb(queryId: string, options?: TelegramBot.AnswerCallbackQueryOptions) {
  try { await bot.answerCallbackQuery(queryId, options); } catch (_) {}
}

// ═══════════════════════════════════════════════════════════════
// REMINDERS
// ═══════════════════════════════════════════════════════════════
function scheduleReminder(orderId: string, passengerChatId: number, timeStr: string) {
  if (!validateTime(timeStr)) return;
  if (reminderEnabled[passengerChatId] === false) return;
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

// ═══════════════════════════════════════════════════════════════
// KEYBOARDS
// ═══════════════════════════════════════════════════════════════
function mainMenuKeyboard(chatId: number) {
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
    rows.push([{ text: TEXTS.btnQuickMsgs[lang] }, { text: TEXTS.btnOrderNotes[lang] }]);
    const autoRetryBtn = (autoRetryEnabled[chatId] !== false) ? "🔄 Avto-qidiruv: Yoq" : "🔄 Avto-qidiruv: O'chiq";
    rows.push([{ text: autoRetryBtn }]);
  }
  if (driver && driver.approved && !driver.blocked) {
    const statusBtn = driver.online ? TEXTS.btnOffline[lang] : TEXTS.btnOnline[lang];
    const reminderBtn = (reminderEnabled[chatId] !== false) ? "🔔 Eslatma: Yoq" : "🔕 Eslatma: O'chiq";
    rows.push([{ text: statusBtn }, { text: TEXTS.btnMyStatus[lang] }]);
    rows.push([{ text: reminderBtn }]);
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

async function sendChunkedHtml(chatId: number, title: string, lines: string[]) {
  const limit = 3500;
  let buffer = title;
  for (const line of lines) {
    if ((buffer + "\n" + line).length > limit) {
      await bot.sendMessage(chatId, buffer, { parse_mode: "HTML" });
      buffer = title + "\n" + line;
    } else {
      buffer += `\n${line}`;
    }
  }
  if (buffer.trim()) await bot.sendMessage(chatId, buffer, { parse_mode: "HTML" });
}

// ═══════════════════════════════════════════════════════════════
// NOTIFY DRIVERS (ENHANCED WITH PRO FEATURES)
// ═══════════════════════════════════════════════════════════════
async function notifyDrivers(order: Order) {
  const matched = Object.values(drivers).filter(
    (d) => d.approved && !d.blocked && d.online && d.route === order.passenger.route && !d.breakUntil
  );
  if (matched.length === 0) {
    await bot.sendMessage(order.passenger.chatId, t(order.passenger.chatId, "noDrivers"));
    if (CONFIG.AUTO_RETRY_ENABLED && autoRetryEnabled[order.passenger.chatId] !== false && order.retryCount < CONFIG.MAX_AUTO_RETRIES) {
      order.retryCount++;
      markDirty();
      setTimeout(() => {
        if (orders[order.id]?.status === "pending") {
          notifyDrivers(order);
        }
      }, 2 * 60 * 1000);
    }
    return;
  }
  const isParcel = order.type === "parcel";
  matched.sort((a, b) => {
    const avgA = a.ratingCount > 0 ? a.totalRating / a.ratingCount : 0;
    const avgB = b.ratingCount > 0 ? b.totalRating / b.ratingCount : 0;
    return avgB - avgA;
  });

  for (const driver of matched) {
    const lang = userLang[driver.chatId] || "uz";
    const label = isParcel
      ? (lang === "uz" ? "📦 Yangi posilka so'rovi!" : "📦 Новый запрос на посылку!")
      : (lang === "uz" ? "📦 Yangi buyurtma!" : "📦 Новый заказ!");
    const desc = isParcel ? `\n📦 Tavsif: ${order.parcelDesc}` : "";
    const prefs = order.prefs ? `\n📝 Izoh: ${order.prefs.notes || ""}` : "";
    await bot.sendMessage(
      driver.chatId,
      `${label}\n\n👤 ${order.passenger.name}${order.isBookedForOther ? ` (Boshqa uchun)` : ""}\n📍 ${order.passenger.route}\n🕐 ${order.passenger.departureTime}\n💺 ${order.passenger.seats}${desc}${prefs}\n📞 ${order.passenger.phone}`,
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

// ═══════════════════════════════════════════════════════════════
// CLEANUP & MAINTENANCE
// ═══════════════════════════════════════════════════════════════
function cleanupOldOrders() {
  const now = new Date();
  let cleaned = 0;
  let changed = false;
  Object.entries(orders).forEach(([id, order]) => {
    const ageHours = (now.getTime() - order.createdAt.getTime()) / (1000 * 60 * 60);
    if (ageHours > CONFIG.MAX_ORDER_AGE_HOURS && (order.status === "completed" || order.status === "rejected" || order.status === "expired")) {
      delete orders[id];
      cleaned++;
      changed = true;
    }
    if (order.status === "pending" && now > order.expiresAt) {
      order.status = "expired";
      changed = true;
      try {
        bot.sendMessage(order.passenger.chatId, t(order.passenger.chatId, "orderExpired"));
      } catch (_) {}
      cleaned++;
    }
  });
  const today = getTodayStr();
  Object.values(drivers).forEach((d) => {
    if (d.lastOrderDate !== today) {
      d.dailyOrders = 0;
      d.lastOrderDate = today;
      changed = true;
    }
  });
  if (changed) markDirty();
  return cleaned;
}

function restoreRuntimeState() {
  Object.keys(drivers).forEach((id) => {
    const chatId = Number(id);
    initDriverDefaults(chatId);
    const driver = drivers[chatId];
    if (driver?.breakUntil) {
      const diff = driver.breakUntil.getTime() - Date.now();
      if (diff <= 0) {
        driver.breakUntil = undefined;
        driver.online = true;
        markDirty();
      } else {
        setTimeout(() => {
          const current = drivers[chatId];
          if (current?.breakUntil && current.breakUntil.getTime() <= Date.now()) {
            current.breakUntil = undefined;
            current.online = true;
            markDirty();
            bot.sendMessage(chatId, t(chatId, "breakDone")).catch(() => {});
          }
        }, diff);
      }
    }
  });
  Object.values(orders).forEach((order) => {
    if ((order.status === "pending" || order.status === "accepted") && order.passenger?.chatId) {
      scheduleReminder(order.id, order.passenger.chatId, order.passenger.departureTime);
    }
  });
  cleanupOldOrders();
}

loadState();
restoreRuntimeState();
setInterval(() => persistState(), 5000);
process.once("SIGINT", () => { persistState(true); process.exit(0); });
process.once("SIGTERM", () => { persistState(true); process.exit(0); });
process.once("beforeExit", () => persistState(true));

setInterval(() => {
  const cleaned = cleanupOldOrders();
  if (cleaned > 0) {
    logger.info(`Cleaned up ${cleaned} old/expired orders`);
    persistState();
  }
}, CONFIG.CLEANUP_INTERVAL_MS);

// Scheduled broadcast checker
setInterval(() => {
  const now = new Date();
  scheduledBroadcasts.forEach((sb) => {
    if (!sb.sent && sb.scheduledAt <= now) {
      sb.sent = true;
      markDirty();
      for (const uid of allUsers) {
        bot.sendMessage(uid, `📢 <b>Rejalashtirilgan xabar:</b>\n\n${sb.message}`, { parse_mode: "HTML" }).catch(() => {});
      }
    }
  });
}, 60_000);

// ═══════════════════════════════════════════════════════════════
// /start
// ═══════════════════════════════════════════════════════════════
bot.onText(/\/start(.*)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const param = (match?.[1] || "").trim();
  markDirty();

  if (param.startsWith("ref_")) {
    const inviterId = parseInt(param.replace("ref_", ""));
    if (inviterId && inviterId !== chatId && !isNaN(inviterId)) {
      if (!referrals[inviterId]) referrals[inviterId] = [];
      if (!referrals[inviterId].includes(chatId)) {
        referrals[inviterId].push(chatId);
        try {
          const lang = userLang[inviterId] || "uz";
          await bot.sendMessage(inviterId,
            lang === "uz"
              ? `🤝 Siz taklif qilgan yangi foydalanuvchi qo'shildi! Jami: ${referrals[inviterId].length} kishi`
              : `🤝 Новый пользователь по вашей ссылке! Всего: ${referrals[inviterId].length} чел.`
          );
        } catch (_) {}
      }
    }
  }

  if (userLang[chatId]) {
    userStates[chatId] = { step: "main", data: {} };
    await bot.sendMessage(chatId, `${TEXTS.welcome[userLang[chatId]]}!`, mainMenuKeyboard(chatId));
    return;
  }

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

// ═══════════════════════════════════════════════════════════════
// MAIN MESSAGE HANDLER
// ═══════════════════════════════════════════════════════════════
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text || "";
  const contact = msg.contact;

  allUsers.add(chatId);
  markDirty();

  if (blacklist[chatId]) {
    await bot.sendMessage(chatId, t(chatId, "blacklisted"));
    return;
  }

  if (!userStates[chatId]) userStates[chatId] = { step: "main", data: {} };
  const state = userStates[chatId];

  // ── SOS ──────────────────────────────────────────────────────
  if (text === t(chatId, "btnSOS")) {
    const lang = userLang[chatId] || "uz";
    await bot.sendMessage(chatId, TEXTS.sosMenu[lang], {
      reply_markup: {
        keyboard: [
          [{ text: TEXTS.btnSosSend[lang] }],
          [{ text: TEXTS.btnSosCancel[lang] }],
        ],
        resize_keyboard: true,
      },
    });
    return;
  }

  if (text === t(chatId, "btnSosSend")) {
    const userName = msg.from?.first_name || "Noma'lum";
    const userPhone = passengers[chatId]?.phone || drivers[chatId]?.phone || "Noma'lum";
    const activeOrder = Object.values(orders).find(
      (o) => o.passenger.chatId === chatId && (o.status === "accepted" || o.status === "pending")
    );
    const driver = activeOrder?.driverId ? drivers[activeOrder.driverId] : undefined;

    const sos: SosAlert = {
      id: `sos_${Date.now()}`,
      from: chatId,
      fromName: userName,
      phone: userPhone,
      orderId: activeOrder?.id,
      driverName: driver?.name,
      driverPhone: driver?.phone,
      carNumber: driver?.carNumber,
      route: activeOrder?.passenger.route,
      createdAt: new Date(),
    };
    sosAlerts.push(sos);

    const adminMsg =
      `🚨🚨🚨 <b>SOS SIGNAL!</b> 🚨🚨🚨\n\n` +
      `👤 Yo'lovchi: <b>${userName}</b>\n` +
      `📞 Telefon: ${userPhone}\n` +
      `🆔 Telegram ID: ${chatId}\n` +
      (sos.route ? `📍 Yo'nalish: ${sos.route}\n` : "") +
      (sos.driverName ? `🚗 Haydovchi: ${sos.driverName} (${sos.carNumber})\n` : "") +
      (sos.driverPhone ? `📞 Haydovchi tel: ${sos.driverPhone}\n` : "") +
      `⏰ Vaqt: ${new Date().toLocaleString("uz-UZ")}\n\n` +
      `⚠️ DARHOL CHORA KO'RING!`;

    await sendToAdmins(adminMsg);

    if (driver) {
      await bot.sendMessage(
        driver.chatId,
        `🚨 <b>DIQQAT!</b> Yo'lovchingiz SOS signal yubordi!\n👤 ${userName} | 📞 ${userPhone}\n\nAdmin bilan bog'laning!`,
        { parse_mode: "HTML" }
      );
    }

    await bot.sendMessage(chatId, t(chatId, "sosConfirm"), mainMenuKeyboard(chatId));
    return;
  }

  if (text === t(chatId, "btnSosCancel")) {
    await bot.sendMessage(chatId, "✅ Yaxshi, xavfsiz bo'ling!", mainMenuKeyboard(chatId));
    return;
  }

  // ── Quick Order ──────────────────────────────────────────────
  if (text === t(chatId, "btnQuickOrder")) {
    const last = lastOrders[chatId];
    if (!last) {
      await bot.sendMessage(chatId, t(chatId, "noLastOrder"), mainMenuKeyboard(chatId));
      return;
    }
    const lang = userLang[chatId] || "uz";
    await bot.sendMessage(
      chatId,
      `${TEXTS.quickOrderInfo[lang]}\n\n📍 ${last.route}\n💺 ${last.seats} o'rin\n👤 ${last.name}\n📞 ${last.phone}\n\n⏰ Bugungi vaqtni kiriting (masalan: 09:00):`,
      cancelKeyboard(chatId)
    );
    userStates[chatId] = { step: "quick_order_time", data: { ...last } };
    return;
  }

  // ── Cancel ───────────────────────────────────────────────────
  if (text === t(chatId, "btnCancel")) {
    userStates[chatId] = { step: "main", data: {} };
    await bot.sendMessage(chatId, t(chatId, "mainMenu"), mainMenuKeyboard(chatId));
    return;
  }

  // ── Active chat relay ────────────────────────────────────────
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

  // ═════════════════════════════════════════════════════════════
  // MAIN MENU ROUTING
  // ═════════════════════════════════════════════════════════════

  if (text === t(chatId, "btnDriver")) {
    const existingDriver = drivers[chatId];
    if (existingDriver) {
      const status = existingDriver.blocked ? "🚫 Заблокирован" : existingDriver.approved ? "✅ Автоподтверждён" : "⏳ На проверке";
      const verification = existingDriver.verification ? `\n\n${formatVerificationCard(existingDriver.verification)}` : "";
      await bot.sendMessage(
        chatId,
        `🚗 <b>Ваш профиль водителя уже сохранён</b>\n\n👤 ${existingDriver.name}\n📞 ${existingDriver.phone}\n🚗 ${existingDriver.carModel} (${existingDriver.carNumber})\n📍 ${existingDriver.route}\n🕐 ${existingDriver.departureTime}\n💰 ${existingDriver.price.toLocaleString()} so'm\n📌 Статус: ${status}${verification}\n\nДля изменения используйте кнопку редактирования.`,
        { parse_mode: "HTML", ...mainMenuKeyboard(chatId) }
      );
      return;
    }
    userStates[chatId] = { step: "driver_name", data: {} };
    await bot.sendMessage(chatId, t(chatId, "enterName"), cancelKeyboard(chatId));
    return;
  }

  if (text === t(chatId, "btnPassenger")) {
    const savedProfile = getSavedPassengerProfile(chatId);
    if (savedProfile) {
      userStates[chatId] = { step: "passenger_route", data: { ...savedProfile } };
      await bot.sendMessage(chatId, `✅ Сохранённые данные загружены:\n👤 ${savedProfile.name}\n📞 ${savedProfile.phone}\n\n${t(chatId, "chooseRoute")}`, routeKeyboard(chatId));
      return;
    }
    userStates[chatId] = { step: "passenger_name", data: {} };
    await bot.sendMessage(chatId, t(chatId, "enterName"), cancelKeyboard(chatId));
    return;
  }

  if (text === t(chatId, "btnAnnounce")) {
    const lang = userLang[chatId] || "uz";
    const allApproved = Object.values(drivers).filter((d) => d.approved && !d.blocked);
    const totalOnline = allApproved.filter((d) => d.online).length;
    const routeButtons = ROUTES.map((r) => {
      const count = allApproved.filter((d) => d.online && d.route === r).length;
      return [{ text: `${count > 0 ? "🟢" : "⚪"} ${r} (${count})`, callback_data: `ann_route_${r}` }];
    });
    routeButtons.push([{ text: TEXTS.announceAll[lang], callback_data: "ann_route_ALL" }]);
    await bot.sendMessage(
      chatId,
      `📢 <b>Haydovchilar e'lonlari</b>\n\n🟢 Jami online: <b>${totalOnline}</b> haydovchi\n\n${TEXTS.announceRoute[lang]}`,
      { parse_mode: "HTML", reply_markup: { inline_keyboard: routeButtons } }
    );
    return;
  }

  if (text === t(chatId, "btnParcel")) {
    const savedProfile = getSavedPassengerProfile(chatId);
    if (savedProfile) {
      userStates[chatId] = { step: "parcel_route", data: { ...savedProfile } };
      await bot.sendMessage(chatId, `✅ Сохранённые данные загружены.\n\n${t(chatId, "parcelRoute")}`, routeKeyboard(chatId));
      return;
    }
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
    const breakText = driver.breakUntil && driver.breakUntil > new Date() ? `\n⏸️ Tanaffus: ${driver.breakUntil.toLocaleTimeString("uz-UZ")} gacha` : "";
    let txt = `📡 <b>Mening holatim</b>\n\n${statusIcon}${breakText}\n🚗 ${driver.carModel} (${driver.carNumber})\n📍 ${driver.route}\n🕐 ${driver.departureTime}\n💰 ${driver.price.toLocaleString()} so'm\n${formatRating(driver)}\n💺 ${driver.seats} o'rindiq${lastSeenText}`;
    const kb = (driver.breakUntil && driver.breakUntil > new Date())
      ? { inline_keyboard: [[{ text: "▶️ Tanaffusni tugatish", callback_data: "break_stop" }]] }
      : undefined;
    await bot.sendMessage(chatId, txt, { parse_mode: "HTML", ...(kb ? { reply_markup: kb } : {}), ...mainMenuKeyboard(chatId) });
    return;
  }

  // Faol buyurtmalarim
  if (text === t(chatId, "btnMyOrders")) {
    const myOrders = Object.values(orders).filter(
      (o) => o.passenger.chatId === chatId && (o.status === "pending" || o.status === "accepted")
    );
    if (myOrders.length === 0) {
      await bot.sendMessage(chatId, t(chatId, "noActiveOrders"), mainMenuKeyboard(chatId));
      return;
    }
    const lang = userLang[chatId] || "uz";
    for (const o of myOrders) {
      const statusLabel = o.status === "pending" ? "⏳ Kutilmoqda" : "✅ Qabul qilindi";
      const dateLabel = o.scheduledDate ? `📅 ${o.scheduledDate} | ` : "";
      let txt = `📋 <b>Buyurtma</b>\n${statusLabel}\n\n${dateLabel}📍 ${o.passenger.route}\n🕐 ${o.passenger.departureTime}\n💺 ${o.passenger.seats} o'rin`;
      if (o.status === "accepted" && o.driverId && drivers[o.driverId]) {
        const d = drivers[o.driverId];
        txt += `\n\n🚗 Haydovchi: <b>${d.name}</b>\n📞 ${d.phone}\n🚗 ${d.carModel} (${d.carNumber})`;
      }
      const kb = o.status === "pending"
        ? { inline_keyboard: [[{ text: "❌ Bekor qilish", callback_data: `cancel_order_${o.id}` }]] }
        : { inline_keyboard: [] as any[] };
      await bot.sendMessage(chatId, txt, { parse_mode: "HTML", reply_markup: kb });
    }
    return;
  }

  // Ertangi bron
  if (text === t(chatId, "btnTomorrow")) {
    const lang = userLang[chatId] || "uz";
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toLocaleDateString("uz-UZ", { day: "2-digit", month: "2-digit", year: "numeric" });
    const savedProfile = getSavedPassengerProfile(chatId);
    if (savedProfile) {
      userStates[chatId] = { step: "tmrw_route", data: { scheduledDate: dateStr, ...savedProfile } };
      await bot.sendMessage(
        chatId,
        `${TEXTS.tomorrowInfo[lang]}\n\n📅 Sana: <b>${dateStr}</b>\n\n✅ Сохранённые данные загружены.\n${t(chatId, "chooseRoute")}`,
        { parse_mode: "HTML", ...routeKeyboard(chatId) }
      );
      return;
    }
    await bot.sendMessage(
      chatId,
      `${TEXTS.tomorrowInfo[lang]}\n\n📅 Sana: <b>${dateStr}</b>\n\nIsmingizni kiriting:`,
      { parse_mode: "HTML", ...cancelKeyboard(chatId) }
    );
    userStates[chatId] = { step: "tmrw_name", data: { scheduledDate: dateStr } };
    return;
  }

  // Mening statistikam
  if (text === t(chatId, "btnMyStats")) {
    const driver = drivers[chatId];
    if (!driver) {
      await bot.sendMessage(chatId, "Siz haydovchi sifatida ro'yxatdan o'tmagansiz.", mainMenuKeyboard(chatId));
      return;
    }
    const totalTrips = driver.trips.length;
    const avg = driver.ratingCount > 0 ? (driver.totalRating / driver.ratingCount).toFixed(1) : "—";
    const fiveStars = driver.trips.filter((t) => t.rating === 5).length;
    const fourStars = driver.trips.filter((t) => t.rating === 4).length;
    const threeAndBelow = driver.trips.filter((t) => (t.rating || 0) <= 3).length;
    const estimatedEarnings = totalTrips * driver.price;
    const routeTrips = driver.trips.reduce((acc: Record<string, number>, t) => {
      acc[t.route] = (acc[t.route] || 0) + 1;
      return acc;
    }, {});
    const topRoute = Object.entries(routeTrips).sort((a, b) => b[1] - a[1])[0];
    const recentTrips = driver.trips.slice(-3).reverse();

    let txt = `📊 <b>Mening statistikam</b>\n\n`;
    txt += `👤 <b>${driver.name}</b> | 🚗 ${driver.carModel}\n`;
    txt += `📍 ${driver.route}\n\n`;
    txt += `─────────────────────\n`;
    txt += `🛣️ Jami safarlar: <b>${totalTrips}</b>\n`;
    txt += `💰 Taxminiy daromad: <b>${estimatedEarnings.toLocaleString()} so'm</b>\n`;
    txt += `⭐ O'rtacha reyting: <b>${avg}</b> (${driver.ratingCount} baho)\n`;
    if (driver.ratingCount > 0) {
      txt += `   ⭐⭐⭐⭐⭐ × ${fiveStars}  ⭐⭐⭐⭐ × ${fourStars}  ≤⭐⭐⭐ × ${threeAndBelow}\n`;
    }
    if (topRoute) txt += `📍 Eng ko'p yo'nalish: <b>${topRoute[0]}</b> (${topRoute[1]} safar)\n`;
    if (recentTrips.length > 0) {
      txt += `\n🕐 <b>Oxirgi 3 safar:</b>\n`;
      recentTrips.forEach((tr) => {
        txt += `  • ${tr.date} — ${tr.route} — ${tr.rating ? "⭐".repeat(tr.rating) : "—"}\n`;
      });
    }
    await bot.sendMessage(chatId, txt, { parse_mode: "HTML", ...mainMenuKeyboard(chatId) });
    return;
  }

  // Yordam
  if (text === t(chatId, "btnHelp")) {
    const lang = userLang[chatId] || "uz";
    await bot.sendMessage(chatId, TEXTS.helpText[lang], { parse_mode: "HTML", ...mainMenuKeyboard(chatId) });
    return;
  }

  // Referal
  if (text === t(chatId, "btnReferral")) {
    const lang = userLang[chatId] || "uz";
    const link = `https://t.me/Taxisuper777_bot?start=ref_${chatId}`;
    const count = referrals[chatId]?.length || 0;
    await bot.sendMessage(
      chatId,
      `${TEXTS.referralText[lang]}\n\n<code>${link}</code>\n\n${TEXTS.referralCount[lang]} <b>${count}</b> kishi`,
      { parse_mode: "HTML", ...mainMenuKeyboard(chatId) }
    );
    return;
  }

  // Eslatma toggle
  if (text === "🔔 Eslatma: Yoq" || text === "🔕 Eslatma: O'chiq") {
    reminderEnabled[chatId] = (text === "🔕 Eslatma: O'chiq");
    const msg = reminderEnabled[chatId] ? t(chatId, "reminderOnMsg") : t(chatId, "reminderOffMsg");
    await bot.sendMessage(chatId, msg, mainMenuKeyboard(chatId));
    return;
  }

  // Auto-retry toggle
  if (text === "🔄 Avto-qidiruv: Yoq" || text === "🔄 Avto-qidiruv: O'chiq") {
    autoRetryEnabled[chatId] = (text === "🔄 Avto-qidiruv: O'chiq");
    const msg = autoRetryEnabled[chatId] ? t(chatId, "autoRetryOn") : t(chatId, "autoRetryOff");
    await bot.sendMessage(chatId, msg, mainMenuKeyboard(chatId));
    return;
  }

  // Edit driver
  if (text === t(chatId, "btnEdit")) {
    const driver = drivers[chatId];
    if (!driver) { await bot.sendMessage(chatId, "Siz haydovchi sifatida ro'yxatdan o'tmagansiz.", mainMenuKeyboard(chatId)); return; }
    const lang = userLang[chatId] || "uz";
    await bot.sendMessage(chatId, TEXTS.editWhat[lang], {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [{ text: TEXTS.editPriceBtn[lang], callback_data: "edit_price" }, { text: TEXTS.editTimeBtn[lang], callback_data: "edit_time" }],
          [{ text: TEXTS.editSeatsBtn[lang], callback_data: "edit_seats" }, { text: TEXTS.editRouteBtn[lang], callback_data: "edit_route" }],
        ],
      },
    });
    return;
  }

  // ═════════════════════════════════════════════════════════════
  // PRO DRIVER HANDLERS
  // ═════════════════════════════════════════════════════════════

  // 📅 Jadval
  if (text === t(chatId, "btnSchedule")) {
    const driver = drivers[chatId];
    if (!driver) { await bot.sendMessage(chatId, "Avval ro'yxatdan o'ting.", mainMenuKeyboard(chatId)); return; }
    const lang = userLang[chatId] || "uz";
    const sched = driver.schedule;
    let info = TEXTS.scheduleTitle[lang] + "\n\n";
    if (sched) {
      const days = ["Dush","Sesh","Chor","Pay","Jum","Shan","Yak"];
      const daysRu = ["Pn","Vt","Sr","Cht","Pt","Sb","Vs"];
      const dList = lang === "uz" ? days : daysRu;
      const active = [sched.mon, sched.tue, sched.wed, sched.thu, sched.fri, sched.sat, sched.sun]
        .map((v, i) => v ? dList[i] : null).filter(Boolean).join(", ");
      info += `📅 Faol kunlar: <b>${active || "—"}</b>\n🕐 Vaqt: <b>${sched.startTime} - ${sched.endTime}</b>\n\n`;
    }
    info += "Yangi jadval o'rnatish uchun kunlarni kiriting:";
    await bot.sendMessage(chatId, info, { parse_mode: "HTML", ...cancelKeyboard(chatId) });
    userStates[chatId] = { step: "driver_schedule_days", data: {} };
    return;
  }

  if (state.step === "driver_schedule_days") {
    const days = text.split(",").map((s) => parseInt(s.trim())).filter((n) => !isNaN(n) && n >= 1 && n <= 7);
    if (days.length === 0) {
      await bot.sendMessage(chatId, "❌ 1-7 oralig'ida kunlarni kiriting (masalan: 1,2,3,4,5):", cancelKeyboard(chatId));
      return;
    }
    state.data.scheduleDays = days;
    state.step = "driver_schedule_time";
    await bot.sendMessage(chatId, t(chatId, "scheduleTime"), cancelKeyboard(chatId));
    return;
  }

  if (state.step === "driver_schedule_time") {
    const match = text.match(/^(\d{1,2}:\d{2})-(\d{1,2}:\d{2})$/);
    if (!match) {
      await bot.sendMessage(chatId, "❌ Format: 08:00-20:00\nQayta kiriting:", cancelKeyboard(chatId));
      return;
    }
    const days = state.data.scheduleDays as number[];
    const driver = drivers[chatId];
    if (driver) {
      driver.schedule = {
        mon: days.includes(1), tue: days.includes(2), wed: days.includes(3),
        thu: days.includes(4), fri: days.includes(5), sat: days.includes(6), sun: days.includes(7),
        startTime: match[1], endTime: match[2],
      };
    }
    userStates[chatId] = { step: "main", data: {} };
    await bot.sendMessage(chatId, t(chatId, "scheduleSet"), mainMenuKeyboard(chatId));
    return;
  }

  // 💵 Daromadlar
  if (text === t(chatId, "btnEarnings")) {
    const driver = drivers[chatId];
    if (!driver) { await bot.sendMessage(chatId, "Avval ro'yxatdan o'ting.", mainMenuKeyboard(chatId)); return; }
    initDriverDefaults(chatId);
    const lang = userLang[chatId] || "uz";
    await bot.sendMessage(chatId, `${TEXTS.earningsTitle[lang]}\n\nDavrni tanlang:`, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [{ text: TEXTS.earningsDaily[lang], callback_data: "earn_daily" }],
          [{ text: TEXTS.earningsWeekly[lang], callback_data: "earn_weekly" }],
          [{ text: TEXTS.earningsMonthly[lang], callback_data: "earn_monthly" }],
        ],
      },
    });
    return;
  }

  // 📊 Tahlil
  if (text === t(chatId, "btnAnalytics")) {
    const driver = drivers[chatId];
    if (!driver) { await bot.sendMessage(chatId, "Avval ro'yxatdan o'ting.", mainMenuKeyboard(chatId)); return; }
    initDriverDefaults(chatId);
    await bot.sendMessage(chatId, formatDriverAnalytics(driver), { parse_mode: "HTML", ...mainMenuKeyboard(chatId) });
    return;
  }

  // ⏸️ Tanaffus
  if (text === t(chatId, "btnBreak")) {
    const driver = drivers[chatId];
    if (!driver) { await bot.sendMessage(chatId, "Avval ro'yxatdan o'ting.", mainMenuKeyboard(chatId)); return; }
    const lang = userLang[chatId] || "uz";
    const btns = CONFIG.BREAK_DURATIONS.map((m) => [{ text: `${m} daqiqa`, callback_data: `break_${m}` }]);
    await bot.sendMessage(chatId, TEXTS.breakPrompt[lang], {
      reply_markup: {
        inline_keyboard: btns.concat([[{ text: TEXTS.btnCancel[lang], callback_data: "break_cancel" }]]),
      },
    });
    return;
  }

  // 🏆 Yetakchilar
  if (text === t(chatId, "btnLeaderboard")) {
    const lang = userLang[chatId] || "uz";
    const leaders = getDriverLeaderboard();
    if (leaders.length === 0) {
      await bot.sendMessage(chatId, "Hozircha yetakchilar yo'q.", mainMenuKeyboard(chatId));
      return;
    }
    let txt = TEXTS.leaderboardTitle[lang] + "\n\n";
    leaders.forEach((d, i) => {
      const avg = d.ratingCount > 0 ? (d.totalRating / d.ratingCount).toFixed(1) : "—";
      txt += `${i + 1}. ${i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "🏅"} <b>${d.name}</b>\n`;
      txt += `   🚗 ${d.carModel} | ⭐ ${avg} | 🛣️ ${d.trips.length} safar\n`;
    });
    const myPos = getDriverPosition(chatId);
    if (myPos > 0) txt += `\n${TEXTS.leaderboardPos[lang]}: <b>#${myPos}</b>`;
    await bot.sendMessage(chatId, txt, { parse_mode: "HTML", ...mainMenuKeyboard(chatId) });
    return;
  }

  // ═════════════════════════════════════════════════════════════
  // PRO PASSENGER HANDLERS
  // ═════════════════════════════════════════════════════════════

  // ⭐ Sevimli haydovchilar
  if (text === t(chatId, "btnFavorites")) {
    const passenger = passengers[chatId];
    const favs = passenger?.favorites || [];
    const lang = userLang[chatId] || "uz";
    if (favs.length === 0) {
      await bot.sendMessage(chatId, TEXTS.noFavorites[lang], mainMenuKeyboard(chatId));
      return;
    }
    let txt = TEXTS.favoritesTitle[lang] + "\n\n";
    const kb: { text: string; callback_data: string }[][] = [];
    favs.forEach((fid, i) => {
      const d = drivers[fid];
      if (d) {
        txt += `${i + 1}. 👤 <b>${d.name}</b>\n   🚗 ${d.carModel} | 📞 ${d.phone}\n   📍 ${d.route} | ${formatRating(d)}\n\n`;
        kb.push([{ text: `🚕 ${d.name} ga buyurtma`, callback_data: `fav_order_${fid}` }]);
        kb.push([{ text: `❌ ${d.name} ni o'chirish`, callback_data: `fav_del_${fid}` }]);
      }
    });
    await bot.sendMessage(chatId, txt, { parse_mode: "HTML", reply_markup: { inline_keyboard: kb } });
    return;
  }

  // 🏠 Saqlangan manzillar
  if (text === t(chatId, "btnSavedPlaces")) {
    const passenger = passengers[chatId];
    const places = passenger?.savedAddresses || [];
    const lang = userLang[chatId] || "uz";
    if (places.length === 0) {
      await bot.sendMessage(chatId, TEXTS.noSavedPlaces[lang], {
        reply_markup: { inline_keyboard: [[{ text: "➕ Yangi manzil qo'shish", callback_data: "add_place" }]] },
      });
      return;
    }
    let txt = TEXTS.savedPlacesTitle[lang] + "\n\n";
    const kb: { text: string; callback_data: string }[][] = [
      [{ text: "➕ Yangi qo'shish", callback_data: "add_place" }],
    ];
    places.forEach((p, i) => {
      const icon = p.type === "home" ? "🏠" : p.type === "work" ? "🏢" : "📍";
      txt += `${i + 1}. ${icon} <b>${p.name}</b>\n   ${p.address}\n\n`;
      kb.push([{ text: `🗑 ${icon} ${p.name}`, callback_data: `del_place_${i}` }]);
    });
    await bot.sendMessage(chatId, txt, { parse_mode: "HTML", reply_markup: { inline_keyboard: kb } });
    return;
  }

  // 👤 Boshqa uchun buyurtma
  if (text === t(chatId, "btnBookForOther")) {
    userStates[chatId] = { step: "book_other_name", data: {} };
    await bot.sendMessage(chatId, t(chatId, "bookForOtherName"), cancelKeyboard(chatId));
    return;
  }

  if (state.step === "book_other_name") {
    state.data.otherName = text;
    state.step = "book_other_phone";
    await bot.sendMessage(chatId, t(chatId, "bookForOtherPhone"), cancelKeyboard(chatId));
    return;
  }

  if (state.step === "book_other_phone") {
    if (!validatePhone(text)) {
      await bot.sendMessage(chatId, "❌ To'g'ri telefon kiriting: 998901234567", cancelKeyboard(chatId));
      return;
    }
    state.data.otherPhone = normalizeStoredPhone(text);
    state.data.isBookedForOther = true;
    const savedProfile = getSavedPassengerProfile(chatId);
    if (savedProfile) {
      state.data.name = savedProfile.name;
      state.data.phone = savedProfile.phone;
      state.step = "passenger_route";
      await bot.sendMessage(chatId, `✅ Buyurtmachi ma'lumotlari yuklandi.\n\n${t(chatId, "chooseRoute")}`, routeKeyboard(chatId));
      return;
    }
    state.step = "passenger_name";
    await bot.sendMessage(chatId, "Endi sizning ma'lumotlaringiz (buyurtmachi):\n" + t(chatId, "enterName"), cancelKeyboard(chatId));
    return;
  }

  // 🆘 Favqulodda kontakt
  if (text === t(chatId, "btnEmergency")) {
    userStates[chatId] = { step: "emergency_name", data: {} };
    await bot.sendMessage(chatId, t(chatId, "emergencyPrompt"), cancelKeyboard(chatId));
    return;
  }

  if (state.step === "emergency_name") {
    state.data.emergencyName = text;
    state.step = "emergency_phone";
    await bot.sendMessage(chatId, "Telefon raqamini kiriting:", cancelKeyboard(chatId));
    return;
  }

  if (state.step === "emergency_phone") {
    if (!validatePhone(text)) {
      await bot.sendMessage(chatId, "❌ To'g'ri telefon kiriting: 998901234567", cancelKeyboard(chatId));
      return;
    }
    if (!passengers[chatId]) passengers[chatId] = { chatId, name: msg.from?.first_name || "", phone: "", route: "", seats: 0, departureTime: "", favorites: [], savedAddresses: [] };
    passengers[chatId].emergencyContact = { name: state.data.emergencyName, phone: normalizeStoredPhone(text) };
    userStates[chatId] = { step: "main", data: {} };
    await bot.sendMessage(chatId, t(chatId, "emergencySet"), mainMenuKeyboard(chatId));
    return;
  }

  // 💬 Tez xabarlar
  if (text === t(chatId, "btnQuickMsgs")) {
    const lang = userLang[chatId] || "uz";
    const msgs = lang === "uz"
      ? ["📍 Manzilga yetib keldim", "⏳ 5 daqiqa kutaman", "🚪 Eshik oldidaman", "❌ Bekor qildim"]
      : ["📍 Я на месте", "⏳ Жду 5 минут", "🚪 У подъезда", "❌ Отменил"];
    await bot.sendMessage(chatId, TEXTS.quickMsgTitle[lang], {
      reply_markup: { inline_keyboard: msgs.map((m) => [{ text: m, callback_data: `quickmsg_${m}` }]) },
    });
    return;
  }

  // 📝 Buyurtma izohi
  if (text === t(chatId, "btnOrderNotes")) {
    userStates[chatId] = { step: "set_default_notes", data: {} };
    await bot.sendMessage(chatId, t(chatId, "orderNotesPrompt"), cancelKeyboard(chatId));
    return;
  }

  if (state.step === "set_default_notes") {
    if (!passengers[chatId]) passengers[chatId] = { chatId, name: msg.from?.first_name || "", phone: "", route: "", seats: 0, departureTime: "", favorites: [], savedAddresses: [] };
    passengers[chatId].prefs = { ...(passengers[chatId].prefs || {}), notes: text };
    userStates[chatId] = { step: "main", data: {} };
    await bot.sendMessage(chatId, "✅ Izoh saqlandi! Keyingi buyurtmalaringizda avtomatik qo'shiladi.", mainMenuKeyboard(chatId));
    return;
  }

  // Saqlangan manzil qo'shish flow
  if (state.step === "place_name") {
    state.data.placeName = text;
    state.step = "place_address";
    await bot.sendMessage(chatId, "Manzilni kiriting (masalan: Toshkent, Chilonzor 5):", cancelKeyboard(chatId));
    return;
  }
  if (state.step === "place_address") {
    state.data.placeAddress = text;
    state.step = "place_type";
    await bot.sendMessage(chatId, "Turini tanlang:", {
      reply_markup: {
        keyboard: [[{ text: "🏠 Uy" }, { text: "🏢 Ish" }, { text: "📍 Boshqa" }], [{ text: t(chatId, "btnCancel") }]],
        resize_keyboard: true,
      },
    });
    return;
  }
  if (state.step === "place_type") {
    const typeMap: Record<string, "home" | "work" | "other"> = { "🏠 Uy": "home", "🏢 Ish": "work", "📍 Boshqa": "other" };
    const pType = typeMap[text] || "other";
    if (!passengers[chatId]) passengers[chatId] = { chatId, name: msg.from?.first_name || "", phone: "", route: "", seats: 0, departureTime: "", favorites: [], savedAddresses: [] };
    passengers[chatId].savedAddresses.push({
      name: state.data.placeName,
      address: state.data.placeAddress,
      type: pType,
    });
    userStates[chatId] = { step: "main", data: {} };
    await bot.sendMessage(chatId, TEXTS.addressAdded.uz, mainMenuKeyboard(chatId));
    return;
  }

  // ═════════════════════════════════════════════════════════════
  // EDIT DRIVER STEPS
  // ═════════════════════════════════════════════════════════════
  if (state.step === "edit_price") {
    const val = parseInt(text.replace(/\s/g, ""));
    if (isNaN(val) || val < 5000 || val > 5000000) {
      await bot.sendMessage(chatId, "❌ 5,000 dan 5,000,000 gacha kiriting:", cancelKeyboard(chatId));
      return;
    }
    drivers[chatId].price = val;
    userStates[chatId] = { step: "main", data: {} };
    await bot.sendMessage(chatId, `${t(chatId, "editDone")}\n💰 Yangi narx: <b>${val.toLocaleString()} so'm</b>`, { parse_mode: "HTML", ...mainMenuKeyboard(chatId) });
    return;
  }
  if (state.step === "edit_time") {
    const check = validateDriverTime(text.trim());
    if (!check.ok) { await bot.sendMessage(chatId, `❌ ${check.note}`, cancelKeyboard(chatId)); return; }
    drivers[chatId].departureTime = text.trim();
    userStates[chatId] = { step: "main", data: {} };
    await bot.sendMessage(chatId, `${t(chatId, "editDone")}\n🕐 Yangi vaqt: <b>${text.trim()}</b>`, { parse_mode: "HTML", ...mainMenuKeyboard(chatId) });
    return;
  }
  if (state.step === "edit_seats") {
    const val = parseInt(text);
    if (isNaN(val) || val < 1 || val > 6) { await bot.sendMessage(chatId, "❌ 1 dan 6 gacha kiriting:", cancelKeyboard(chatId)); return; }
    drivers[chatId].seats = val;
    userStates[chatId] = { step: "main", data: {} };
    await bot.sendMessage(chatId, `${t(chatId, "editDone")}\n💺 Yangi o'rindiq: <b>${val}</b>`, { parse_mode: "HTML", ...mainMenuKeyboard(chatId) });
    return;
  }
  if (state.step === "edit_route") {
    if (!ROUTES.includes(text)) { await bot.sendMessage(chatId, t(chatId, "chooseRoute"), routeKeyboard(chatId)); return; }
    drivers[chatId].route = text;
    userStates[chatId] = { step: "main", data: {} };
    await bot.sendMessage(chatId, `${t(chatId, "editDone")}\n📍 Yangi yo'nalish: <b>${text}</b>`, { parse_mode: "HTML", ...mainMenuKeyboard(chatId) });
    return;
  }

  // ── Rad etish sababi ─────────────────────────────────────────
  if (state.step === "reject_reason") {
    const { orderId, passengerId } = state.data;
    const order = orders[orderId];
    if (order) {
      order.status = "rejected";
      const passLang = userLang[passengerId] || "uz";
      await bot.sendMessage(
        passengerId,
        `${TEXTS.rejectedReason[passLang]} <i>${text}</i>`,
        { parse_mode: "HTML" }
      );
    }
    userStates[chatId] = { step: "main", data: {} };
    await bot.sendMessage(chatId, "❌ Buyurtma rad etildi.", mainMenuKeyboard(chatId));
    return;
  }

  // ── Matn sharhi ──────────────────────────────────────────────
  if (state.step === "review_text") {
    const { orderId } = state.data;
    const order = orders[orderId];
    if (text !== "/skip" && order?.driverId && drivers[order.driverId]) {
      const lastTrip = drivers[order.driverId].trips.find((t) => t.orderId === orderId);
      if (lastTrip) lastTrip.comment = text;
      await bot.sendMessage(order.driverId, `💬 Yo'lovchi izohi: <i>${text}</i>`, { parse_mode: "HTML" });
    }
    userStates[chatId] = { step: "main", data: {} };
    await bot.sendMessage(chatId, t(chatId, "reviewSaved"), mainMenuKeyboard(chatId));
    return;
  }

  // ── Admin broadcast / reply steps ────────────────────────────
  if (state.step === "admin_reply_msg") {
    const targetId = state.data.targetUserId as number;
    try {
      await bot.sendMessage(targetId, `${t(targetId, "msgFromAdmin")}\n\n${text}`, { parse_mode: "HTML" });
      await bot.sendMessage(chatId, t(chatId, "adminReplySent"), mainMenuKeyboard(chatId));
    } catch (_) {
      await bot.sendMessage(chatId, "❌ Foydalanuvchiga yuborib bo'lmadi.", mainMenuKeyboard(chatId));
    }
    userStates[chatId] = { step: "main", data: {} };
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
    const onlineDrivers = Object.values(drivers).filter((d) => d.online).length;
    const orderCount = Object.values(orders).length;
    const completedOrders = Object.values(orders).filter((o) => o.status === "completed").length;
    const complaintCount = complaints.length;
    const totalUsers = allUsers.size;
    await bot.sendMessage(
      chatId,
      `👨‍💼 <b>Admin Panel</b>\n\n` +
      `👥 Foydalanuvchilar: ${totalUsers}\n` +
      `🚗 Haydovchilar: ${driverCount} (✅${approved} ⏳${pending} 🟢${onlineDrivers})\n` +
      `📋 Buyurtmalar: ${orderCount} (✅${completedOrders} yakunlangan)\n` +
      `🚫 Shikoyatlar: ${complaintCount}\n` +
      `🚨 SOS: ${sosAlerts.length}\n` +
      `🚷 Blacklist: ${Object.keys(blacklist).length}`,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "👨‍✈️ Haydovchilar", callback_data: "admin_drivers" }],
            [{ text: TEXTS.btnAdminUsers.uz, callback_data: "admin_users" }],
            [{ text: "📋 Buyurtmalar",   callback_data: "admin_orders" }],
            [{ text: "🚫 Shikoyatlar",   callback_data: "admin_complaints" }],
            [{ text: "💬 Foydalanuvchiga javob", callback_data: "admin_reply" }],
            [{ text: `🚨 SOS (${sosAlerts.length})`, callback_data: "admin_sos" }],
            [{ text: `🚷 Blacklist (${Object.keys(blacklist).length})`, callback_data: "admin_blacklist" }],
            [{ text: `📊 Statistika`, callback_data: "admin_stats" }, { text: `📤 Eksport`, callback_data: "admin_export" }],
            [{ text: `📅 Ertangi bronlar`, callback_data: "admin_tomorrow" }],
            [{ text: `📢 Hammaga xabar`, callback_data: "admin_broadcast" }],
            [{ text: TEXTS.btnScheduledBroadcast.uz, callback_data: "admin_scheduled_broadcast" }],
            [{ text: TEXTS.btnRouteAnalytics.uz, callback_data: "admin_route_analytics" }],
            [{ text: TEXTS.btnLeaderboardAdmin.uz, callback_data: "admin_leaderboard" }],
            [{ text: TEXTS.btnMassApprove.uz, callback_data: "admin_mass_approve" }],
            [{ text: TEXTS.btnCleanup.uz, callback_data: "admin_cleanup" }],
          ],
        },
      }
    );
    return;
  }

  // Admin broadcast step
  if (state.step === "admin_broadcast") {
    const broadcastText = text;
    let sent = 0;
    for (const uid of allUsers) {
      try {
        await bot.sendMessage(uid, `📢 <b>Admin xabari:</b>\n\n${broadcastText}`, { parse_mode: "HTML" });
        sent++;
      } catch (_) {}
    }
    userStates[chatId] = { step: "main", data: {} };
    const lang = userLang[chatId] || "uz";
    await bot.sendMessage(chatId, TEXTS.broadcastSent[lang].replace("{count}", String(sent)), mainMenuKeyboard(chatId));
    return;
  }

  // ═════════════════════════════════════════════════════════════
  // DRIVER REGISTRATION (REMOVED TIME & SEATS FROM FLOW)
  // ═════════════════════════════════════════════════════════════
  if (state.step === "driver_name") {
    state.data.name = text; state.step = "driver_phone";
    await bot.sendMessage(chatId, t(chatId, "enterPhone"), sharePhoneKeyboard(chatId));
    return;
  }
  if (state.step === "driver_phone") {
    const phone = normalizeStoredPhone(contact ? contact.phone_number : text);
    if (!validatePhone(phone)) {
      await bot.sendMessage(chatId, "❌ Noto'g'ri telefon raqam. Masalan: 998901234567 yoki +998901234567\nQayta kiriting:", sharePhoneKeyboard(chatId));
      return;
    }
    if (isDuplicatePhone(phone, chatId)) {
      await bot.sendMessage(chatId, "❌ Bu telefon raqam allaqachon ro'yxatdan o'tgan. Boshqa raqam kiriting:", sharePhoneKeyboard(chatId));
      return;
    }
    state.data.phone = phone;
    state.step = "driver_car_model";
    await bot.sendMessage(chatId, t(chatId, "enterCarModel"), cancelKeyboard(chatId));
    return;
  }
  if (state.step === "driver_car_model") {
    if (!validateCarModel(text)) {
      await bot.sendMessage(chatId,
        "❌ Noto'g'ri yoki noma'lum mashina modeli.\n\n📋 Misol uchun: <b>Cobalt, Lacetti, Nexia, Camry, Tracker, Damas, Matiz, Malibu</b> va boshqalar.\n\nQayta kiriting:",
        { parse_mode: "HTML", ...cancelKeyboard(chatId) }
      );
      return;
    }
    state.data.carModel = text; state.step = "driver_car_number";
    await bot.sendMessage(chatId, t(chatId, "enterCarNum"), cancelKeyboard(chatId));
    return;
  }
  if (state.step === "driver_car_number") {
    const carNum = text.replace(/\s/g, "").toUpperCase();
    if (!validateCarNumber(carNum)) {
      await bot.sendMessage(chatId, "❌ Noto'g'ri mashina raqami.\n\n📋 To'g'ri format: <b>01A123BC</b>\n• 2 ta raqam + 1 harf + 3 raqam + 2 harf\n\nQayta kiriting:", { parse_mode: "HTML", ...cancelKeyboard(chatId) });
      return;
    }
    if (isDuplicateCarNumber(carNum, chatId)) {
      await bot.sendMessage(chatId, "❌ Bu mashina raqami allaqachon ro'yxatda bor. Qayta tekshiring:", cancelKeyboard(chatId));
      return;
    }
    state.data.carNumber = carNum; state.step = "driver_route";
    await bot.sendMessage(chatId, t(chatId, "chooseRoute"), routeKeyboard(chatId));
    return;
  }
  if (state.step === "driver_route") {
    if (!ROUTES.includes(text)) { await bot.sendMessage(chatId, t(chatId, "chooseRoute"), routeKeyboard(chatId)); return; }
    state.data.route = text; state.step = "driver_price";
    await bot.sendMessage(chatId, `${t(chatId, "enterPrice")}\n<i>5,000 – 5,000,000 so'm oralig'ida</i>`, { parse_mode: "HTML", ...cancelKeyboard(chatId) });
    return;
  }
  if (state.step === "driver_price") {
    const price = parseInt(text.replace(/\s/g, "").replace(/,/g, ""));
    if (isNaN(price) || price < 5000 || price > 5000000) {
      await bot.sendMessage(chatId, "❌ Narx 5,000 dan 5,000,000 so'mgacha bo'lishi kerak. Qayta kiriting:", cancelKeyboard(chatId));
      return;
    }
    state.data.price = price;
    // Default values for removed fields
    state.data.departureTime = "08:00";
    state.data.seats = 4;

    const verification = autoVerifyDriver(state.data as Partial<Driver>, chatId);
    const isReRegistration = !!drivers[chatId];
    const prevTrips   = drivers[chatId]?.trips || [];
    const prevRating  = drivers[chatId]?.totalRating || 0;
    const prevCount   = drivers[chatId]?.ratingCount || 0;
    const prevEarnings = drivers[chatId]?.earnings || [];
    const prevAnalytics = drivers[chatId]?.analytics || {
      routeCounts: {}, hourlyDistribution: {}, dailyEarnings: {},
      categoryRatings: { punctuality: [], cleanliness: [], driving: [], behavior: [] },
    };
    const driver: Driver = {
      chatId, name: state.data.name, phone: state.data.phone,
      carNumber: state.data.carNumber, carModel: state.data.carModel,
      route: state.data.route, seats: state.data.seats,
      departureTime: state.data.departureTime, price,
      approved: verification.passed,
      blocked: false, online: false, verification,
      totalRating: prevRating, ratingCount: prevCount, trips: prevTrips,
      earnings: prevEarnings, analytics: prevAnalytics,
      dailyOrders: 0, lastOrderDate: getTodayStr(),
    };
    drivers[chatId] = driver;
    userStates[chatId] = { step: "main", data: {} };
    const card = formatVerificationCard(verification);
    let suffix: string;
    if (verification.passed) {
      suffix = `\n\n🎉 ${isReRegistration ? "Ma'lumotlar yangilandi" : "Ro'yxatdan o'tdingiz"}! Profil avtomatik tasdiqlandi va buyurtmalar olishingiz mumkin 🚗`;
    } else {
      const failed = verification.checks.filter((c) => !c.ok).map((c) => `• ${c.label}: ${c.note}`).join("\n");
      suffix = `\n\n⚠️ Quyidagi xatoliklarni tuzating:\n${failed}\n\nQayta ro'yxatdan o'tish uchun 🚗 Haydovchi tugmasini bosing.`;
    }
    await bot.sendMessage(chatId, `${card}${suffix}`, { parse_mode: "HTML", ...mainMenuKeyboard(chatId) });
    await sendToAdmins(
      `${isReRegistration ? "🔄" : "🆕"} <b>${isReRegistration ? "Qayta ro'yxat" : "Yangi haydovchi"}</b> (${verification.passed ? "✅ AUTO " + verification.score + "/5" : `❌ ${verification.score}/5`})\n` +
      `👤 ${driver.name} | 📞 ${driver.phone}\n` +
      `🚗 ${driver.carModel} (${driver.carNumber})\n` +
      `📍 ${driver.route} | 🕐 ${driver.departureTime} | 💺 ${driver.seats}\n` +
      `💰 ${price.toLocaleString()} so'm | ID: ${chatId}`
    );
    return;
  }

  // ═════════════════════════════════════════════════════════════
  // ERTANGI BRON FLOW
  // ═════════════════════════════════════════════════════════════
  if (state.step === "tmrw_name") {
    state.data.name = text; state.step = "tmrw_phone";
    await bot.sendMessage(chatId, t(chatId, "enterPhone"), sharePhoneKeyboard(chatId));
    return;
  }
  if (state.step === "tmrw_phone") {
    const phone = normalizeStoredPhone(contact ? contact.phone_number : text);
    if (!validatePhone(phone)) {
      await bot.sendMessage(chatId, "❌ Noto'g'ri telefon. Qayta kiriting:", sharePhoneKeyboard(chatId));
      return;
    }
    state.data.phone = phone; state.step = "tmrw_route";
    await bot.sendMessage(chatId, t(chatId, "chooseRoute"), routeKeyboard(chatId));
    return;
  }
  if (state.step === "tmrw_route") {
    if (!ROUTES.includes(text)) { await bot.sendMessage(chatId, t(chatId, "chooseRoute"), routeKeyboard(chatId)); return; }
    state.data.route = text; state.step = "tmrw_seats";
    await bot.sendMessage(chatId, t(chatId, "enterSeatsP"), cancelKeyboard(chatId));
    return;
  }
  if (state.step === "tmrw_seats") {
    const n = parseInt(text);
    if (isNaN(n) || n < 1 || n > 4) { await bot.sendMessage(chatId, "❌ 1 dan 4 gacha kiriting:", cancelKeyboard(chatId)); return; }
    state.data.seats = n; state.step = "tmrw_time";
    await bot.sendMessage(chatId, t(chatId, "enterTime"), cancelKeyboard(chatId));
    return;
  }
  if (state.step === "tmrw_time") {
    if (!validateTime(text.trim())) {
      await bot.sendMessage(chatId, "❌ To'g'ri format: 08:30. Qayta kiriting:", cancelKeyboard(chatId));
      return;
    }
    const d = state.data;
    const orderId = `tmrw_${chatId}_${Date.now()}`;
    // Save passenger profile
    if (!passengers[chatId]) passengers[chatId] = { chatId, name: d.name, phone: d.phone, route: d.route, seats: d.seats, departureTime: text.trim(), favorites: [], savedAddresses: [] };
    else {
      passengers[chatId].name = d.name;
      passengers[chatId].phone = d.phone;
    }
    const passenger: Passenger = {
      chatId, name: d.name, phone: d.phone,
      route: d.route, seats: d.seats, departureTime: text.trim(),
      favorites: passengers[chatId]?.favorites || [],
      savedAddresses: passengers[chatId]?.savedAddresses || [],
    };
    passengers[chatId] = passenger;
    lastOrders[chatId] = { route: d.route, seats: d.seats, name: d.name, phone: d.phone };
    const order: Order = {
      id: orderId, passenger, driverId: null, status: "pending",
      createdAt: new Date(), rated: false, type: "passenger",
      scheduledDate: d.scheduledDate, retryCount: 0,
      expiresAt: new Date(Date.now() + CONFIG.ORDER_EXPIRY_MINUTES * 60 * 1000),
    };
    orders[orderId] = order;
    userStates[chatId] = { step: "main", data: {} };
    await bot.sendMessage(
      chatId,
      `${t(chatId, "tomorrowDone")}\n\n📅 ${d.scheduledDate}\n📍 ${d.route}\n🕐 ${text.trim()}\n💺 ${d.seats} o'rin`,
      { parse_mode: "HTML", ...mainMenuKeyboard(chatId) }
    );
    await notifyDrivers(order);
    return;
  }

  // ═════════════════════════════════════════════════════════════
  // ANNOUNCEMENT DIRECT ORDER FLOW
  // ═════════════════════════════════════════════════════════════
  if (state.step === "ann_order_name") {
    state.data.name = text; state.step = "ann_order_phone";
    await bot.sendMessage(chatId, t(chatId, "enterPhone"), sharePhoneKeyboard(chatId));
    return;
  }
  if (state.step === "ann_order_phone") {
    const phone = normalizeStoredPhone(contact ? contact.phone_number : text);
    if (!validatePhone(phone)) {
      await bot.sendMessage(chatId, "❌ Noto'g'ri telefon. Qayta kiriting:", sharePhoneKeyboard(chatId));
      return;
    }
    state.data.phone = phone; state.step = "ann_order_seats";
    await bot.sendMessage(chatId, t(chatId, "enterSeatsP"), cancelKeyboard(chatId));
    return;
  }
  if (state.step === "ann_order_seats") {
    const n = parseInt(text);
    if (isNaN(n) || n < 1 || n > 4) {
      await bot.sendMessage(chatId, "❌ 1 dan 4 gacha son kiriting:", cancelKeyboard(chatId));
      return;
    }
    state.data.seats = n; state.step = "ann_order_time";
    await bot.sendMessage(chatId, t(chatId, "enterTime"), cancelKeyboard(chatId));
    return;
  }
  if (state.step === "ann_order_time") {
    if (!validateTime(text.trim())) {
      await bot.sendMessage(chatId, "❌ To'g'ri format: 08:30. Qayta kiriting:", cancelKeyboard(chatId));
      return;
    }
    const d = state.data;
    const targetDriver = drivers[d.targetDriverId];
    if (!targetDriver || !targetDriver.online) {
      await bot.sendMessage(chatId, "😔 Haydovchi hozir offline bo'lib qoldi. Boshqa haydovchi tanlang.", mainMenuKeyboard(chatId));
      userStates[chatId] = { step: "main", data: {} };
      return;
    }
    const orderId = `ann_${chatId}_${Date.now()}`;
    // Save passenger profile
    if (!passengers[chatId]) passengers[chatId] = { chatId, name: d.name, phone: d.phone, route: d.route, seats: d.seats, departureTime: text.trim(), favorites: [], savedAddresses: [] };
    else {
      passengers[chatId].name = d.name;
      passengers[chatId].phone = d.phone;
    }
    const passenger: Passenger = {
      chatId, name: d.name, phone: d.phone,
      route: d.route, seats: d.seats, departureTime: text.trim(),
      favorites: passengers[chatId]?.favorites || [],
      savedAddresses: passengers[chatId]?.savedAddresses || [],
    };
    passengers[chatId] = passenger;
    lastOrders[chatId] = { route: d.route, seats: d.seats, name: d.name, phone: d.phone };
    const order: Order = {
      id: orderId, passenger, driverId: targetDriver.chatId, status: "pending",
      createdAt: new Date(), rated: false, type: "passenger", retryCount: 0,
      expiresAt: new Date(Date.now() + CONFIG.ORDER_EXPIRY_MINUTES * 60 * 1000),
    };
    orders[orderId] = order;
    userStates[chatId] = { step: "main", data: {} };
    await bot.sendMessage(chatId, `✅ Buyurtma <b>${targetDriver.name}</b> ga yuborildi!\n📞 ${targetDriver.phone}`, { parse_mode: "HTML", ...mainMenuKeyboard(chatId) });
    const driverLang = userLang[targetDriver.chatId] || "uz";
    await bot.sendMessage(
      targetDriver.chatId,
      `📦 <b>Yangi shaxsiy buyurtma!</b>\n\n👤 ${passenger.name}\n📍 ${passenger.route}\n🕐 ${passenger.departureTime}\n💺 ${passenger.seats} o'rin\n📞 ${passenger.phone}`,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "✅ Qabul qilish", callback_data: `accept_${orderId}` }],
            [{ text: "❌ Rad etish",    callback_data: `reject_${orderId}` }],
          ],
        },
      }
    );
    scheduleReminder(orderId, chatId, text.trim());
    return;
  }

  // ═════════════════════════════════════════════════════════════
  // PASSENGER REGISTRATION (ENHANCED WITH PROFILE SAVING)
  // ═════════════════════════════════════════════════════════════
  if (state.step === "passenger_name") {
    state.data.name = text; state.step = "passenger_phone";
    await bot.sendMessage(chatId, t(chatId, "enterPhone"), sharePhoneKeyboard(chatId));
    return;
  }
  if (state.step === "passenger_phone") {
    const phone = normalizeStoredPhone(contact ? contact.phone_number : text);
    if (!validatePhone(phone)) {
      await bot.sendMessage(chatId, "❌ To'g'ri telefon kiriting: 998901234567", sharePhoneKeyboard(chatId));
      return;
    }
    state.data.phone = phone;
    // Save profile immediately
    if (!passengers[chatId]) passengers[chatId] = { chatId, name: state.data.name, phone, route: "", seats: 0, departureTime: "", favorites: [], savedAddresses: [] };
    else {
      passengers[chatId].name = state.data.name;
      passengers[chatId].phone = phone;
    }
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
    if (!validateTime(text)) {
      await bot.sendMessage(chatId, t(chatId, "enterTime"), cancelKeyboard(chatId));
      return;
    }
    state.data.departureTime = text;
    state.step = "passenger_prefs";
    const lang = userLang[chatId] || "uz";
    await bot.sendMessage(chatId, `${TEXTS.orderNotesPrompt[lang]}\n\n(Ixtiyoriy — o'tkazib yuborish uchun /skip)`, { parse_mode: "HTML", ...cancelKeyboard(chatId) });
    return;
  }

  if (state.step === "passenger_prefs") {
    const notes = text === "/skip" ? undefined : text;
    state.data.prefs = { notes };
    state.step = "passenger_location";
    const lang = userLang[chatId] || "uz";
    await bot.sendMessage(chatId, "📍 Joylashuvingizni ulashmoqchimisiz? (Ixtiyoriy)", {
      reply_markup: {
        keyboard: [
          [{ text: TEXTS.btnShareLoc[lang], request_location: true }],
          [{ text: TEXTS.btnSkipLoc[lang] }],
        ],
        resize_keyboard: true,
      },
    });
    return;
  }

  if (state.step === "passenger_location") {
    const loc = msg.location;
    const isSkip = text === t(chatId, "btnSkipLoc");
    if (!loc && !isSkip) {
      const lang = userLang[chatId] || "uz";
      await bot.sendMessage(chatId, "📍 Joylashuv tugmasini bosing yoki o'tkazib yuboring:", {
        reply_markup: {
          keyboard: [
            [{ text: TEXTS.btnShareLoc[lang], request_location: true }],
            [{ text: TEXTS.btnSkipLoc[lang] }],
          ],
          resize_keyboard: true,
        },
      });
      return;
    }
    const orderId = `${chatId}_${Date.now()}`;
    const location = loc ? { latitude: loc.latitude, longitude: loc.longitude } : undefined;
    const existingFavs = passengers[chatId]?.favorites || [];
    const existingAddrs = passengers[chatId]?.savedAddresses || [];
    const existingEmerg = passengers[chatId]?.emergencyContact;
    const existingPrefs = passengers[chatId]?.prefs;
    const passenger: Passenger = {
      chatId, name: state.data.name, phone: state.data.phone,
      route: state.data.route, seats: state.data.seats,
      departureTime: state.data.departureTime,
      location,
      favorites: existingFavs,
      savedAddresses: existingAddrs,
      emergencyContact: existingEmerg,
      prefs: state.data.prefs?.notes ? state.data.prefs : (existingPrefs || undefined),
    };
    passengers[chatId] = passenger;
    lastOrders[chatId] = { route: state.data.route, seats: state.data.seats, name: state.data.name, phone: state.data.phone };
    const order: Order = {
      id: orderId, passenger, driverId: null, status: "pending",
      createdAt: new Date(), rated: false, type: "passenger",
      prefs: state.data.prefs, retryCount: 0,
      expiresAt: new Date(Date.now() + CONFIG.ORDER_EXPIRY_MINUTES * 60 * 1000),
      isBookedForOther: state.data.isBookedForOther,
      actualPassengerName: state.data.otherName,
      actualPassengerPhone: state.data.otherPhone,
    };
    orders[orderId] = order;
    userStates[chatId] = { step: "main", data: {} };

    const waitMin = getWaitTimeEstimate(state.data.route);
    const surge = isSurgeActive(state.data.route);
    let confirmMsg = location
      ? `${t(chatId, "orderSent")}\n📍 Joylashuvingiz haydovchiga yuboriladi.`
      : t(chatId, "orderSent");
    if (waitMin > 0) confirmMsg += `\n⏱️ Taxminiy kutish: ~${waitMin} daqiqa`;
    if (surge) confirmMsg += `\n⚡ ${t(chatId, "surgeNotice")}`;

    await bot.sendMessage(chatId, confirmMsg, mainMenuKeyboard(chatId));
    await notifyDrivers(order);
    return;
  }

  if (state.step === "quick_order_time") {
    if (!validateTime(text)) {
      await bot.sendMessage(chatId, t(chatId, "enterTime"), cancelKeyboard(chatId));
      return;
    }
    const d = state.data;
    const orderId = `${chatId}_${Date.now()}`;
    const existingFavs = passengers[chatId]?.favorites || [];
    const existingAddrs = passengers[chatId]?.savedAddresses || [];
    const passenger: Passenger = {
      chatId, name: d.name, phone: d.phone,
      route: d.route, seats: d.seats, departureTime: text,
      favorites: existingFavs, savedAddresses: existingAddrs,
    };
    passengers[chatId] = passenger;
    const order: Order = {
      id: orderId, passenger, driverId: null, status: "pending",
      createdAt: new Date(), rated: false, type: "passenger", retryCount: 0,
      expiresAt: new Date(Date.now() + CONFIG.ORDER_EXPIRY_MINUTES * 60 * 1000),
    };
    orders[orderId] = order;
    userStates[chatId] = { step: "main", data: {} };
    await bot.sendMessage(chatId, t(chatId, "quickOrderDone"), mainMenuKeyboard(chatId));
    await notifyDrivers(order);
    return;
  }

  // ═════════════════════════════════════════════════════════════
  // PARCEL FLOW
  // ═════════════════════════════════════════════════════════════
  if (state.step === "parcel_name") {
    state.data.name = text; state.step = "parcel_phone";
    await bot.sendMessage(chatId, t(chatId, "enterPhone"), sharePhoneKeyboard(chatId));
    return;
  }
  if (state.step === "parcel_phone") {
    const phone = normalizeStoredPhone(contact ? contact.phone_number : text);
    if (!validatePhone(phone)) {
      await bot.sendMessage(chatId, "❌ To'g'ri telefon kiriting: 998901234567", sharePhoneKeyboard(chatId));
      return;
    }
    state.data.phone = phone;
    // Save profile
    if (!passengers[chatId]) passengers[chatId] = { chatId, name: state.data.name, phone, route: "", seats: 0, departureTime: "", favorites: [], savedAddresses: [] };
    else {
      passengers[chatId].name = state.data.name;
      passengers[chatId].phone = phone;
    }
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
    const existingFavs = passengers[chatId]?.favorites || [];
    const existingAddrs = passengers[chatId]?.savedAddresses || [];
    const passenger: Passenger = {
      chatId, name: state.data.name, phone: state.data.phone,
      route: state.data.route, seats: 0, departureTime: state.data.departureTime,
      favorites: existingFavs, savedAddresses: existingAddrs,
    };
    const order: Order = {
      id: orderId, passenger, driverId: null, status: "pending",
      createdAt: new Date(), rated: false, type: "parcel", parcelDesc: text, retryCount: 0,
      expiresAt: new Date(Date.now() + CONFIG.ORDER_EXPIRY_MINUTES * 60 * 1000),
    };
    orders[orderId] = order;
    userStates[chatId] = { step: "main", data: {} };
    await bot.sendMessage(chatId, t(chatId, "parcelSent"), mainMenuKeyboard(chatId));
    await notifyDrivers(order);
    return;
  }

  // ═════════════════════════════════════════════════════════════
  // COMPLAINT FLOW
  // ═════════════════════════════════════════════════════════════
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
      resolved: false,
    };
    complaints.push(complaint);
    userStates[chatId] = { step: "main", data: {} };
    await bot.sendMessage(chatId, t(chatId, "complaintSent"), mainMenuKeyboard(chatId));
    await sendToAdmins(`🚫 <b>Yangi shikoyat</b>\n👤 ${complaint.fromName} (ID:${chatId})\n📍 ${complaint.route}\n📝 ${text}`);
    return;
  }
});

// ═══════════════════════════════════════════════════════════════
// CALLBACK QUERIES (FIXED - NO DUPLICATE ANSWERS)
// ═══════════════════════════════════════════════════════════════
bot.on("callback_query", async (query) => {
  const chatId = query.message?.chat.id!;
  const data = query.data || "";
  const messageId = query.message?.message_id!;
  markDirty();

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
      await answerCb(query.id, { text: "Bu buyurtma allaqachon qabul qilingan!", show_alert: true });
      await bot.editMessageText(`❌ Allaqachon qabul qilingan: ${order?.passenger?.name || ""}`, { chat_id: chatId, message_id: messageId });
      return;
    }
    const driver = drivers[chatId];
    if (!driver) return;
    order.status = "accepted";
    order.driverId = chatId;
    activeChats[chatId] = order.passenger.chatId;
    activeChats[order.passenger.chatId] = chatId;

    initDriverDefaults(chatId);
    driver.dailyOrders++;
    driver.lastOrderDate = getTodayStr();
    driver.earnings.push({
      date: getTodayStr(), amount: driver.price, route: order.passenger.route,
      passengerName: order.passenger.name, orderId,
    });
    driver.analytics.routeCounts[order.passenger.route] = (driver.analytics.routeCounts[order.passenger.route] || 0) + 1;
    const hour = order.passenger.departureTime.split(":")[0];
    driver.analytics.hourlyDistribution[hour] = (driver.analytics.hourlyDistribution[hour] || 0) + 1;
    driver.analytics.dailyEarnings[getTodayStr()] = (driver.analytics.dailyEarnings[getTodayStr()] || 0) + driver.price;

    await bot.editMessageText(
      `✅ <b>Qabul qilindi!</b>\n👤 ${order.passenger.name}\n📍 ${order.passenger.route}\n🕐 ${order.passenger.departureTime}\n💺 ${order.passenger.seats}`,
      { chat_id: chatId, message_id: messageId, parse_mode: "HTML" }
    );

    const driverLang = userLang[chatId] || "uz";
    await bot.sendMessage(
      chatId,
      `🚗 <b>Safar boshqaruv paneli</b>\n\n👤 ${order.passenger.name}\n📞 ${order.passenger.phone}\n📍 ${order.passenger.route}\n🕐 ${order.passenger.departureTime}`,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "📍 Yo'lovchi oldiga yetib keldim", callback_data: `arrived_${orderId}` }],
            [{ text: "💬 Yo'lovchiga xabar",            callback_data: `msg_start_${order.passenger.chatId}` }],
            [{ text: "✅ Manzilga yetkazdim — Yakunlash", callback_data: `complete_driver_${orderId}` }],
          ],
        },
      }
    );

    const passLang = userLang[order.passenger.chatId] || "uz";
    let passMsg = `${TEXTS.driverFound[passLang]}\n\n👤 ${driver.name}\n🚗 ${driver.carModel} (${driver.carNumber})\n📞 ${driver.phone}\n🕐 ${driver.departureTime}\n💰 ${driver.price.toLocaleString()} so'm\n${formatRating(driver)}`;
    if (order.isBookedForOther) {
      passMsg += `\n\n👤 <b>Haqiqiy yo'lovchi:</b> ${order.actualPassengerName}\n📞 ${order.actualPassengerPhone}`;
    }
    await bot.sendMessage(
      order.passenger.chatId,
      passMsg,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: TEXTS.btnMsg[passLang],          callback_data: `msg_start_${chatId}` }],
            [{ text: "✅ Yetib keldi — Yakunlash",    callback_data: `complete_pass_${orderId}` }],
            [{ text: TEXTS.btnShareTrip[passLang],    callback_data: `share_trip_${orderId}` }],
          ],
        },
      }
    );

    if (order.passenger.location) {
      await bot.sendMessage(driver.chatId, TEXTS.locFromPass[driverLang]);
      await bot.sendLocation(driver.chatId, order.passenger.location.latitude, order.passenger.location.longitude);
    }

    scheduleReminder(orderId, order.passenger.chatId, order.passenger.departureTime);
    return;
  }

  // Reject order
  if (data.startsWith("reject_")) {
    const orderId = data.replace("reject_", "");
    const order = orders[orderId];
    if (!order || order.status !== "pending") {
      await bot.editMessageText("❌ Bu buyurtma allaqachon o'zgartirilgan.", { chat_id: chatId, message_id: messageId });
      return;
    }
    await bot.editMessageText("⏳ Sabab kiritilmoqda...", { chat_id: chatId, message_id: messageId });
    userStates[chatId] = { step: "reject_reason", data: { orderId, passengerId: order.passenger.chatId } };
    await bot.sendMessage(chatId, t(chatId, "rejectReason"), cancelKeyboard(chatId));
    return;
  }

  // Arrived
  if (data.startsWith("arrived_")) {
    const orderId = data.replace("arrived_", "");
    const order = orders[orderId];
    if (!order) return;
    await bot.editMessageReplyMarkup(
      {
        inline_keyboard: [
          [{ text: "💬 Yo'lovchiga xabar",            callback_data: `msg_start_${order.passenger.chatId}` }],
          [{ text: "✅ Manzilga yetkazdim — Yakunlash", callback_data: `complete_driver_${orderId}` }],
        ],
      },
      { chat_id: chatId, message_id: messageId }
    );
    const passLang = userLang[order.passenger.chatId] || "uz";
    await bot.sendMessage(
      order.passenger.chatId,
      `🚗 <b>Haydovchingiz sizning oldingizga yetib keldi!</b>\n\nChiqishga tayyor bo'ling 😊`,
      { parse_mode: "HTML" }
    );
    await answerCb(query.id, { text: "✅ Yo'lovchiga xabar yuborildi!", show_alert: false });
    return;
  }

  // Complete — driver
  if (data.startsWith("complete_driver_")) {
    const orderId = data.replace("complete_driver_", "");
    const order = orders[orderId];
    if (!order || order.status === "completed") {
      await answerCb(query.id, { text: "Safar allaqachon yakunlangan.", show_alert: true });
      return;
    }
    order.status = "completed";
    delete activeChats[chatId];
    delete activeChats[order.passenger.chatId];
    await bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: messageId });
    await bot.sendMessage(chatId, "✅ <b>Safar yakunlandi!</b> Rahmat 🙏", { parse_mode: "HTML" });
    const passLang = userLang[order.passenger.chatId] || "uz";
    await bot.sendMessage(order.passenger.chatId, `✅ <b>Safar yakunlandi!</b>\n\n${TEXTS.rateTrip[passLang]}`, { parse_mode: "HTML" });
    await bot.sendMessage(order.passenger.chatId, "⭐", ratingKeyboard(orderId));
    return;
  }

  // Complete — passenger
  if (data.startsWith("complete_pass_")) {
    const orderId = data.replace("complete_pass_", "");
    const order = orders[orderId];
    if (!order || order.status === "completed") {
      await answerCb(query.id, { text: "Safar allaqachon yakunlangan.", show_alert: true });
      return;
    }
    order.status = "completed";
    delete activeChats[chatId];
    if (order.driverId) delete activeChats[order.driverId];
    await bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: messageId });
    await bot.sendMessage(chatId, `✅ <b>Safar yakunlandi!</b>\n\n${t(chatId, "rateTrip")}`, { parse_mode: "HTML" });
    await bot.sendMessage(chatId, "⭐", ratingKeyboard(orderId));
    if (order.driverId && drivers[order.driverId]) {
      await bot.sendMessage(order.driverId, `✅ <b>Safar yakunlandi!</b>\nYo'lovchi manzilga yetganini tasdiqladi. Rahmat 🙏`, { parse_mode: "HTML" });
    }
    return;
  }

  // Legacy complete
  if (data.startsWith("complete_") && !data.startsWith("complete_driver_") && !data.startsWith("complete_pass_")) {
    const orderId = data.replace("complete_", "");
    const order = orders[orderId];
    if (!order) return;
    if (order.status === "completed") {
      await answerCb(query.id, { text: "Safar allaqachon yakunlangan.", show_alert: true });
      return;
    }
    order.status = "completed";
    delete activeChats[chatId];
    if (order.driverId) delete activeChats[order.driverId];
    await bot.editMessageText("✅ Sayohat yakunlandi!", { chat_id: chatId, message_id: messageId });
    if (!order.rated) {
      await bot.sendMessage(order.passenger.chatId, t(order.passenger.chatId, "rateTrip"), ratingKeyboard(orderId));
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
        price: driver.price,
      });
      initDriverDefaults(driver.chatId);
      driver.analytics.categoryRatings.punctuality.push(stars);
      driver.analytics.categoryRatings.cleanliness.push(stars);
      driver.analytics.categoryRatings.driving.push(stars);
      driver.analytics.categoryRatings.behavior.push(stars);
      await bot.sendMessage(driver.chatId, `⭐ Yangi baho: ${"⭐".repeat(stars)} (${stars}/5)\nJami: ${formatRating(driver)}`);
    }
    await bot.editMessageText(`${t(chatId, "thankRating")} ${"⭐".repeat(stars)}`, { chat_id: chatId, message_id: messageId });
    userStates[chatId] = { step: "review_text", data: { orderId } };
    await bot.sendMessage(chatId, t(chatId, "reviewPrompt"), cancelKeyboard(chatId));
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

  // Share trip
  if (data.startsWith("share_trip_")) {
    const orderId = data.replace("share_trip_", "");
    const order = orders[orderId];
    if (!order) return;
    const driver = order.driverId ? drivers[order.driverId] : null;
    const shareText =
      `📤 <b>Sayohat ma'lumotlari</b>\n\n` +
      `👤 Yo'lovchi: ${order.passenger.name}\n` +
      `📍 Yo'nalish: ${order.passenger.route}\n` +
      `🕐 Vaqt: ${order.passenger.departureTime}\n` +
      (driver ? `🚗 Haydovchi: ${driver.name}\n📞 ${driver.phone}\n🚗 ${driver.carModel} (${driver.carNumber})\n` : "");
    await bot.sendMessage(chatId, `${t(chatId, "shareTripText")}\n\n${shareText}\n\n<i>Bu xabarni do'stlaringizga yuboring.</i>`, { parse_mode: "HTML" });
    return;
  }

  // Edit driver callbacks
  if (data === "edit_price" && drivers[chatId]) {
    userStates[chatId] = { step: "edit_price", data: {} };
    await bot.sendMessage(chatId, `💰 Yangi narxni kiriting (so'mda, 5000–5,000,000):`, cancelKeyboard(chatId));
    return;
  }
  if (data === "edit_time" && drivers[chatId]) {
    userStates[chatId] = { step: "edit_time", data: {} };
    await bot.sendMessage(chatId, `🕐 Yangi jo'nash vaqtini kiriting (masalan: 08:30):`, cancelKeyboard(chatId));
    return;
  }
  if (data === "edit_seats" && drivers[chatId]) {
    userStates[chatId] = { step: "edit_seats", data: {} };
    await bot.sendMessage(chatId, `💺 Bo'sh o'rindiqlar soni (1–6):`, cancelKeyboard(chatId));
    return;
  }
  if (data === "edit_route" && drivers[chatId]) {
    userStates[chatId] = { step: "edit_route", data: {} };
    await bot.sendMessage(chatId, t(chatId, "chooseRoute"), routeKeyboard(chatId));
    return;
  }

  if (data === "break_cancel") {
    await bot.sendMessage(chatId, t(chatId, "cancelled"), mainMenuKeyboard(chatId));
    return;
  }

  // Break duration
  if (data.startsWith("break_")) {
    const mins = parseInt(data.replace("break_", ""));
    const driver = drivers[chatId];
    if (driver) {
      driver.breakUntil = new Date(Date.now() + mins * 60 * 1000);
      driver.online = false;
      setTimeout(() => {
        if (driver.breakUntil && new Date() >= driver.breakUntil) {
          driver.breakUntil = undefined;
          driver.online = true;
          bot.sendMessage(chatId, t(chatId, "breakDone")).catch(() => {});
        }
      }, mins * 60 * 1000);
      await bot.sendMessage(chatId, t(chatId, "breakSet", { min: String(mins) }), mainMenuKeyboard(chatId));
    }
    return;
  }

  // Break stop
  if (data === "break_stop") {
    const driver = drivers[chatId];
    if (driver?.breakUntil) {
      driver.breakUntil = undefined;
      driver.online = true;
      markDirty();
      await bot.sendMessage(chatId, t(chatId, "breakDone"), mainMenuKeyboard(chatId));
    }
    return;
  }

  // Earnings callbacks
  if (data.startsWith("earn_")) {
    const driver = drivers[chatId];
    if (!driver) return;
    initDriverDefaults(chatId);
    const period = data.replace("earn_", "");
    const now = new Date();
    let entries: EarningsEntry[] = [];
    let title = "";
    if (period === "daily") {
      const today = getTodayStr();
      entries = driver.earnings.filter((e) => e.date === today);
      title = TEXTS.earningsDaily.uz;
    } else if (period === "weekly") {
      const weekStart = getWeekStart();
      entries = driver.earnings.filter((e) => {
        const [d, m, y] = e.date.split(".").map(Number);
        return new Date(y, m - 1, d) >= weekStart;
      });
      title = TEXTS.earningsWeekly.uz;
    } else if (period === "monthly") {
      const monthStart = getMonthStart();
      entries = driver.earnings.filter((e) => {
        const [d, m, y] = e.date.split(".").map(Number);
        return new Date(y, m - 1, d) >= monthStart;
      });
      title = TEXTS.earningsMonthly.uz;
    }
    await bot.sendMessage(chatId, formatEarnings(entries, title), { parse_mode: "HTML", ...mainMenuKeyboard(chatId) });
    return;
  }

  // Favorite order
  if (data.startsWith("fav_order_")) {
    const dId = parseInt(data.replace("fav_order_", ""));
    const driver = drivers[dId];
    if (!driver || !driver.online) {
      await answerCb(query.id, { text: "Haydovchi hozir offline.", show_alert: true });
      return;
    }
    const savedProfile = getSavedPassengerProfile(chatId);
    if (savedProfile) {
      userStates[chatId] = { step: "ann_order_seats", data: { targetDriverId: dId, route: driver.route, ...savedProfile } };
      await answerCb(query.id);
      await bot.sendMessage(chatId, `🚕 <b>${driver.name}</b> ga buyurtma:\n📍 ${driver.route}\n🕐 ${driver.departureTime}\n💰 ${driver.price.toLocaleString()} so'm\n\n✅ Сохранённые данные загружены.\n${t(chatId, "enterSeatsP")}`,
        { parse_mode: "HTML", ...cancelKeyboard(chatId) });
      return;
    }
    userStates[chatId] = { step: "ann_order_name", data: { targetDriverId: dId, route: driver.route } };
    await answerCb(query.id);
    await bot.sendMessage(chatId, `🚕 <b>${driver.name}</b> ga buyurtma:\n📍 ${driver.route}\n🕐 ${driver.departureTime}\n💰 ${driver.price.toLocaleString()} so'm\n\nIsmingizni kiriting:`,
      { parse_mode: "HTML", ...cancelKeyboard(chatId) });
    return;
  }

  // Favorite delete
  if (data.startsWith("fav_del_")) {
    const dId = parseInt(data.replace("fav_del_", ""));
    if (passengers[chatId]?.favorites) {
      passengers[chatId].favorites = passengers[chatId].favorites.filter((id) => id !== dId);
      await answerCb(query.id, { text: "Sevimlilardan o'chirildi!", show_alert: false });
      await bot.sendMessage(chatId, "✅ Haydovchi sevimlilardan o'chirildi.", mainMenuKeyboard(chatId));
    }
    return;
  }

  // Admin export
  if (data === "admin_export" && isAdmin(chatId)) {
    const list = Object.values(drivers);
    if (list.length === 0) { await bot.sendMessage(chatId, "Haydovchilar yo'q."); return; }
    let txt = `📤 <b>Haydovchilar ro'yxati</b> (${list.length} ta)\n${"─".repeat(30)}\n\n`;
    list.forEach((d, i) => {
      txt += `${i + 1}. ${d.approved ? "✅" : "⏳"}${d.blocked ? "🚫" : ""} <b>${d.name}</b>\n`;
      txt += `   📞 ${d.phone} | 🚗 ${d.carModel} (${d.carNumber})\n`;
      txt += `   📍 ${d.route} | 🕐 ${d.departureTime} | 💰 ${d.price.toLocaleString()}\n`;
      txt += `   ${formatRating(d)} | 🛣️ ${d.trips.length} safar | ${d.online ? "🟢" : "🔴"}\n\n`;
    });
    await bot.sendMessage(chatId, txt, { parse_mode: "HTML" });
    return;
  }

  // Admin tomorrow
  if (data === "admin_tomorrow" && isAdmin(chatId)) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toLocaleDateString("uz-UZ", { day: "2-digit", month: "2-digit", year: "numeric" });
    const list = Object.values(orders).filter((o) => o.scheduledDate === dateStr);
    if (list.length === 0) {
      await bot.sendMessage(chatId, `📅 ${dateStr} — ertangi bron yo'q.`);
      return;
    }
    let txt = `📅 <b>Ertangi bronlar (${dateStr}):</b>\n\n`;
    list.forEach((o, i) => {
      txt += `${i + 1}. 👤 ${o.passenger.name} | 📞 ${o.passenger.phone}\n`;
      txt += `   📍 ${o.passenger.route} | 🕐 ${o.passenger.departureTime} | 💺 ${o.passenger.seats}\n`;
      txt += `   Holat: ${o.status === "pending" ? "⏳ Kutilmoqda" : o.status === "accepted" ? "✅ Qabul" : "❌ Bekor"}\n\n`;
    });
    await bot.sendMessage(chatId, txt, { parse_mode: "HTML" });
    return;
  }

  if (data === "admin_users" && isAdmin(chatId)) {
    const ids = [...new Set([...allUsers, ...Object.keys(drivers).map(Number), ...Object.keys(passengers).map(Number)])].sort((a, b) => b - a);
    if (ids.length === 0) {
      await bot.sendMessage(chatId, "Foydalanuvchilar yo'q.");
      return;
    }
    const lines = ids.map((uid, index) => {
      const driver = drivers[uid];
      const passenger = passengers[uid];
      const role = driver ? "🚗 Haydovchi" : passenger ? "🧑 Yo'lovchi" : "👤 Foydalanuvchi";
      const name = driver?.name || passenger?.name || `ID:${uid}`;
      const phone = driver?.phone || passenger?.phone || "—";
      return `${index + 1}. ${role} — <b>${name}</b> | 📞 ${phone} | 🆔 <code>${uid}</code>`;
    });
    await sendChunkedHtml(chatId, `👥 <b>Foydalanuvchilar ro'yxati</b> (${ids.length})`, lines);
    return;
  }

  // Admin drivers
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

  // Admin driver info
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
      markDirty();
      await bot.editMessageText(`✅ Tasdiqlandi: ${drivers[dId].name}`, { chat_id: chatId, message_id: messageId });
      await bot.sendMessage(dId, t(dId, "approved"));
    }
    return;
  }

  if (data.startsWith("block_") && isAdmin(chatId)) {
    const dId = parseInt(data.replace("block_", ""));
    if (drivers[dId]) {
      drivers[dId].blocked = true;
      markDirty();
      await bot.editMessageText(`🚫 Bloklandi: ${drivers[dId].name}`, { chat_id: chatId, message_id: messageId });
      await bot.sendMessage(dId, t(dId, "blocked"));
    }
    return;
  }

  if (data.startsWith("unblock_") && isAdmin(chatId)) {
    const dId = parseInt(data.replace("unblock_", ""));
    if (drivers[dId]) {
      drivers[dId].blocked = false;
      markDirty();
      await bot.editMessageText(`🔓 Blokdan chiqarildi: ${drivers[dId].name}`, { chat_id: chatId, message_id: messageId });
      await bot.sendMessage(dId, t(dId, "unblocked"));
    }
    return;
  }

  if (data === "admin_orders" && isAdmin(chatId)) {
    const list = Object.values(orders);
    if (list.length === 0) { await bot.sendMessage(chatId, "Buyurtmalar yo'q."); return; }
    const statusIcon = (s: string) => s === "accepted" ? "✅" : s === "completed" ? "🏁" : s === "rejected" ? "❌" : s === "expired" ? "⏳" : "⏳";
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
      txt += `${i + 1}. 👤 ${c.fromName} | 📍 ${c.route}\n📝 ${c.text}\n${c.resolved ? "✅ Hal qilindi" : "⏳ Kutilmoqda"}\n\n`;
    });
    await bot.sendMessage(chatId, txt, { parse_mode: "HTML" });
    return;
  }

  // E'lonlar
  if (data.startsWith("ann_route_")) {
    const lang = userLang[chatId] || "uz";
    const routeKey = data.replace("ann_route_", "");
    const allApproved = Object.values(drivers).filter((d) => d.approved && !d.blocked);
    const selectedDrivers = routeKey === "ALL"
      ? allApproved.filter((d) => d.online)
      : allApproved.filter((d) => d.online && d.route === routeKey);
    const backBtn = [{ text: TEXTS.btnBackRoutes[lang], callback_data: "ann_back" }];

    if (selectedDrivers.length === 0) {
      await bot.editMessageText(
        `😔 ${routeKey === "ALL" ? "Hozircha online haydovchi yo'q." : `<b>${routeKey}</b> yo'nalishida online haydovchi yo'q.`}`,
        { chat_id: chatId, message_id: messageId, parse_mode: "HTML", reply_markup: { inline_keyboard: [backBtn] } }
      );
      return;
    }

    let txt = routeKey === "ALL"
      ? `🟢 <b>Barcha online haydovchilar (${selectedDrivers.length}):</b>\n\n`
      : `🟢 <b>${routeKey}</b>\n<b>${selectedDrivers.length}</b> ta online haydovchi:\n\n`;

    const driverButtons: { text: string; callback_data: string }[][] = [];
    selectedDrivers.forEach((d, i) => {
      txt += `${i + 1}. 🚗 <b>${d.carModel}</b> (${d.carNumber})\n`;
      txt += `   👤 ${d.name}`;
      if (routeKey === "ALL") txt += ` | 📍 ${d.route}`;
      txt += `\n`;
      txt += `   🕐 ${d.departureTime} | 💰 ${d.price.toLocaleString()} so'm | 💺 ${d.seats} joy\n`;
      txt += `   ${formatRating(d)}\n\n`;
      driverButtons.push([
        { text: `📞 ${d.name} — tel`, callback_data: `ann_phone_${d.chatId}` },
        { text: `🚕 Buyurtma`,       callback_data: `ann_order_${d.chatId}` },
        { text: `⭐ Sevimlilar`,     callback_data: `fav_add_${d.chatId}` },
      ]);
    });
    driverButtons.push(backBtn);
    await bot.editMessageText(txt, {
      chat_id: chatId, message_id: messageId, parse_mode: "HTML",
      reply_markup: { inline_keyboard: driverButtons },
    });
    return;
  }

  if (data === "ann_back") {
    const lang = userLang[chatId] || "uz";
    const allApproved = Object.values(drivers).filter((d) => d.approved && !d.blocked);
    const totalOnline = allApproved.filter((d) => d.online).length;
    const routeButtons = ROUTES.map((r) => {
      const count = allApproved.filter((d) => d.online && d.route === r).length;
      return [{ text: `${count > 0 ? "🟢" : "⚪"} ${r} (${count})`, callback_data: `ann_route_${r}` }];
    });
    routeButtons.push([{ text: TEXTS.announceAll[lang], callback_data: "ann_route_ALL" }]);
    await bot.editMessageText(
      `📢 <b>Haydovchilar e'lonlari</b>\n\n🟢 Jami online: <b>${totalOnline}</b> haydovchi\n\n${TEXTS.announceRoute[lang]}`,
      { chat_id: chatId, message_id: messageId, parse_mode: "HTML", reply_markup: { inline_keyboard: routeButtons } }
    );
    return;
  }

  if (data.startsWith("ann_phone_")) {
    const dId = parseInt(data.replace("ann_phone_", ""));
    const driver = drivers[dId];
    if (!driver) { await answerCb(query.id, { text: "Haydovchi topilmadi.", show_alert: true }); return; }
    await answerCb(query.id, { text: `📞 ${driver.name}: ${driver.phone}`, show_alert: true });
    return;
  }

  if (data.startsWith("ann_order_")) {
    const dId = parseInt(data.replace("ann_order_", ""));
    const driver = drivers[dId];
    if (!driver || !driver.online) {
      await answerCb(query.id, { text: "Haydovchi hozir offline.", show_alert: true });
      return;
    }
    const savedProfile = getSavedPassengerProfile(chatId);
    if (savedProfile) {
      userStates[chatId] = { step: "ann_order_seats", data: { targetDriverId: dId, route: driver.route, ...savedProfile } };
      await answerCb(query.id);
      await bot.sendMessage(chatId, `🚕 <b>${driver.name}</b> ga buyurtma:\n📍 ${driver.route}\n🕐 ${driver.departureTime}\n💰 ${driver.price.toLocaleString()} so'm\n\n✅ Сохранённые данные загружены.\n${t(chatId, "enterSeatsP")}`,
        { parse_mode: "HTML", ...cancelKeyboard(chatId) });
      return;
    }
    userStates[chatId] = { step: "ann_order_name", data: { targetDriverId: dId, route: driver.route } };
    await answerCb(query.id);
    await bot.sendMessage(chatId, `🚕 <b>${driver.name}</b> ga buyurtma:\n📍 ${driver.route}\n🕐 ${driver.departureTime}\n💰 ${driver.price.toLocaleString()} so'm\n\nIsmingizni kiriting:`,
      { parse_mode: "HTML", ...cancelKeyboard(chatId) });
    return;
  }

  // Add favorite
  if (data.startsWith("fav_add_")) {
    const dId = parseInt(data.replace("fav_add_", ""));
    if (!passengers[chatId]) passengers[chatId] = { chatId, name: "", phone: "", route: "", seats: 0, departureTime: "", favorites: [], savedAddresses: [] };
    if (!passengers[chatId].favorites.includes(dId)) {
      passengers[chatId].favorites.push(dId);
    }
    await answerCb(query.id, { text: "⭐ Sevimlilarga qo'shildi!", show_alert: false });
    return;
  }

  // Cancel order
  if (data.startsWith("cancel_order_")) {
    const orderId = data.replace("cancel_order_", "");
    const order = orders[orderId];
    if (!order || order.passenger.chatId !== chatId) {
      await answerCb(query.id, { text: "Buyurtma topilmadi.", show_alert: true });
      return;
    }
    if (order.status !== "pending") {
      await answerCb(query.id, { text: "Bu buyurtma allaqachon qabul qilingan, bekor qilib bo'lmaydi.", show_alert: true });
      return;
    }
    order.status = "rejected";
    await bot.editMessageText(
      `❌ <b>Buyurtma bekor qilindi</b>\n\n📍 ${order.passenger.route}\n🕐 ${order.passenger.departureTime}`,
      { chat_id: chatId, message_id: messageId, parse_mode: "HTML" }
    );
    await answerCb(query.id, { text: "✅ Buyurtma bekor qilindi.", show_alert: false });
    return;
  }

  // Admin reply
  if (data === "admin_reply" && isAdmin(chatId)) {
    const recentUsers = [...allUsers].slice(-20);
    if (recentUsers.length === 0) {
      await bot.sendMessage(chatId, "Hozircha foydalanuvchilar yo'q.");
      return;
    }
    const userButtons = recentUsers.map((uid) => {
      const driver = drivers[uid];
      const passenger = passengers[uid];
      const name = driver?.name || passenger?.name || `ID:${uid}`;
      const role = driver ? "🚗" : "🧑";
      return [{ text: `${role} ${name}`, callback_data: `admin_reply_to_${uid}` }];
    });
    await bot.sendMessage(chatId, t(chatId, "adminReplyWho"), {
      reply_markup: { inline_keyboard: userButtons },
    });
    return;
  }

  if (data.startsWith("admin_reply_to_") && isAdmin(chatId)) {
    const targetId = parseInt(data.replace("admin_reply_to_", ""));
    const driver = drivers[targetId];
    const passenger = passengers[targetId];
    const name = driver?.name || passenger?.name || `ID:${targetId}`;
    userStates[chatId] = { step: "admin_reply_msg", data: { targetUserId: targetId } };
    await bot.sendMessage(chatId, `${t(chatId, "adminReplyType")}\n\n👤 Kimga: <b>${name}</b>`, {
      parse_mode: "HTML",
      ...cancelKeyboard(chatId),
    });
    return;
  }

  // Admin stats
  if (data === "admin_stats" && isAdmin(chatId)) {
    const dList = Object.values(drivers);
    const oList = Object.values(orders);
    const routeStatsLocal: Record<string, number> = {};
    oList.forEach((o) => {
      routeStatsLocal[o.passenger.route] = (routeStatsLocal[o.passenger.route] || 0) + 1;
    });
    const topRoute = Object.entries(routeStatsLocal).sort((a, b) => b[1] - a[1])[0];
    const avgRating = dList.filter((d) => d.ratingCount > 0).map((d) => d.totalRating / d.ratingCount);
    const avgRatingStr = avgRating.length > 0 ? (avgRating.reduce((a, b) => a + b, 0) / avgRating.length).toFixed(1) : "—";
    const totalTrips = dList.reduce((s, d) => s + d.trips.length, 0);
    let txt = `📊 <b>Bot Statistikasi</b>\n\n`;
    txt += `👥 Jami foydalanuvchilar: ${allUsers.size}\n`;
    txt += `🚗 Jami haydovchilar: ${dList.length}\n`;
    txt += `  ✅ Tasdiqlangan: ${dList.filter((d) => d.approved).length}\n`;
    txt += `  🟢 Online: ${dList.filter((d) => d.online).length}\n`;
    txt += `📋 Jami buyurtmalar: ${oList.length}\n`;
    txt += `  ✅ Yakunlangan: ${oList.filter((o) => o.status === "completed").length}\n`;
    txt += `  ⏳ Kutilmoqda: ${oList.filter((o) => o.status === "pending").length}\n`;
    txt += `  ⏳ Tugagan: ${oList.filter((o) => o.status === "expired").length}\n`;
    txt += `🛣️ Jami safarlar: ${totalTrips}\n`;
    txt += `⭐ O'rtacha reyting: ${avgRatingStr}\n`;
    txt += `🚫 Shikoyatlar: ${complaints.length}\n`;
    txt += `🆘 SOS signallar: ${sosAlerts.length}\n`;
    txt += `🚷 Blacklist: ${Object.keys(blacklist).length}\n`;
    if (topRoute) txt += `\n📍 Eng mashhur yo'nalish: ${topRoute[0]} (${topRoute[1]} marta)`;
    await bot.sendMessage(chatId, txt, { parse_mode: "HTML" });
    return;
  }

  // Admin broadcast trigger
  if (data === "admin_broadcast" && isAdmin(chatId)) {
    userStates[chatId] = { step: "admin_broadcast", data: {} };
    await bot.sendMessage(chatId, t(chatId, "broadcastPrompt"), cancelKeyboard(chatId));
    return;
  }

  // Admin SOS
  if (data === "admin_sos" && isAdmin(chatId)) {
    if (sosAlerts.length === 0) {
      await bot.sendMessage(chatId, "🚨 SOS signallar yo'q.");
      return;
    }
    let txt = "🚨 <b>SOS Signallar (oxirgi 10):</b>\n\n";
    sosAlerts.slice(-10).reverse().forEach((s, i) => {
      txt += `${i + 1}. 👤 ${s.fromName} | 📞 ${s.phone}\n`;
      if (s.route) txt += `   📍 ${s.route}\n`;
      if (s.driverName) txt += `   🚗 ${s.driverName} (${s.carNumber})\n`;
      txt += `   ⏰ ${s.createdAt.toLocaleString("uz-UZ")}\n`;
      txt += `   🆔 ID: ${s.from}\n\n`;
    });
    await bot.sendMessage(chatId, txt, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: sosAlerts.slice(-5).reverse().map((s) => [{
          text: `🚷 ${s.fromName} ni blacklistga`,
          callback_data: `bl_add_${s.from}_${s.fromName}`,
        }]),
      },
    });
    return;
  }

  // Admin Blacklist
  if (data === "admin_blacklist" && isAdmin(chatId)) {
    const list = Object.values(blacklist);
    if (list.length === 0) {
      await bot.sendMessage(chatId, t(chatId, "noBlacklist"));
      return;
    }
    let txt = "🚷 <b>Blacklist:</b>\n\n";
    list.forEach((b, i) => {
      txt += `${i + 1}. 👤 ${b.name} | 📞 ${b.phone}\n`;
      txt += `   📝 Sabab: ${b.reason}\n`;
      txt += `   📅 ${b.addedAt.toLocaleDateString("uz-UZ")}\n\n`;
    });
    await bot.sendMessage(chatId, txt, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: list.map((b) => [{
          text: `🔓 ${b.name} ni chiqarish`,
          callback_data: `bl_remove_${b.chatId}`,
        }]),
      },
    });
    return;
  }

  if (data.startsWith("bl_add_") && isAdmin(chatId)) {
    const parts = data.replace("bl_add_", "").split("_");
    const targetId = parseInt(parts[0]);
    const targetName = parts.slice(1).join("_");
    const targetPhone = passengers[targetId]?.phone || drivers[targetId]?.phone || "Noma'lum";
    markDirty();
    blacklist[targetId] = {
      chatId: targetId,
      name: targetName,
      phone: targetPhone,
      reason: "Admin tomonidan qo'shildi (SOS)",
      addedAt: new Date(),
    };
    await bot.editMessageText(`🚷 ${targetName} blacklistga qo'shildi.`, { chat_id: chatId, message_id: messageId });
    try { await bot.sendMessage(targetId, t(targetId, "blacklisted")); } catch (_) {}
    return;
  }

  if (data.startsWith("bl_remove_") && isAdmin(chatId)) {
    const targetId = parseInt(data.replace("bl_remove_", ""));
    const entry = blacklist[targetId];
    if (entry) {
      delete blacklist[targetId];
      markDirty();
      await bot.editMessageText(`🔓 ${entry.name} blacklistdan chiqarildi.`, { chat_id: chatId, message_id: messageId });
      try { await bot.sendMessage(targetId, "✅ Siz tizimga qaytadingiz. /start bosing."); } catch (_) {}
    }
    return;
  }

  // PRO ADMIN CALLBACKS

  // Route analytics
  if (data === "admin_route_analytics" && isAdmin(chatId)) {
    const oList = Object.values(orders).filter((o) => o.status === "completed");
    const routeCounts: Record<string, number> = {};
    const hourlyCounts: Record<string, number> = {};
    oList.forEach((o) => {
      routeCounts[o.passenger.route] = (routeCounts[o.passenger.route] || 0) + 1;
      const h = o.passenger.departureTime.split(":")[0];
      hourlyCounts[h] = (hourlyCounts[h] || 0) + 1;
    });
    let txt = TEXTS.routeAnalyticsTitle.uz + "\n\n";
    txt += `📊 <b>Yo'nalishlar bo'yicha:</b>\n`;
    Object.entries(routeCounts).sort((a, b) => b[1] - a[1]).forEach(([r, c]) => {
      txt += `   📍 ${r}: <b>${c}</b> ta\n`;
    });
    txt += `\n🕐 <b>Soatlar bo'yicha (top 5):</b>\n`;
    Object.entries(hourlyCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).forEach(([h, c]) => {
      txt += `   🕐 ${h}:00 — <b>${c}</b> ta\n`;
    });
    await bot.sendMessage(chatId, txt, { parse_mode: "HTML" });
    return;
  }

  // Leaderboard admin
  if (data === "admin_leaderboard" && isAdmin(chatId)) {
    const leaders = getDriverLeaderboard();
    if (leaders.length === 0) {
      await bot.sendMessage(chatId, "Hozircha yetakchilar yo'q.");
      return;
    }
    let txt = TEXTS.leaderboardTitle.uz + "\n\n";
    leaders.forEach((d, i) => {
      const avg = d.ratingCount > 0 ? (d.totalRating / d.ratingCount).toFixed(1) : "—";
      txt += `${i + 1}. ${i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "🏅"} <b>${d.name}</b>\n`;
      txt += `   🚗 ${d.carModel} | ⭐ ${avg} | 🛣️ ${d.trips.length} safar | 💰 ${d.earnings?.reduce((s, e) => s + e.amount, 0).toLocaleString() || 0} so'm\n`;
    });
    await bot.sendMessage(chatId, txt, { parse_mode: "HTML" });
    return;
  }

  // Mass approve
  if (data === "admin_mass_approve" && isAdmin(chatId)) {
    const pending = Object.values(drivers).filter((d) => !d.approved);
    let count = 0;
    for (const d of pending) {
      d.approved = true;
      count++;
      try { await bot.sendMessage(d.chatId, t(d.chatId, "approved")); } catch (_) {}
    }
    await bot.sendMessage(chatId, t(chatId, "massApproveDone", { count: String(count) }), { parse_mode: "HTML" });
    return;
  }

  // Cleanup
  if (data === "admin_cleanup" && isAdmin(chatId)) {
    const cleaned = cleanupOldOrders();
    await bot.sendMessage(chatId, t(chatId, "cleanupDone", { count: String(cleaned) }), { parse_mode: "HTML" });
    return;
  }

  // Scheduled broadcast
  if (data === "admin_scheduled_broadcast" && isAdmin(chatId)) {
    userStates[chatId] = { step: "admin_sched_msg", data: {} };
    await bot.sendMessage(chatId, "📅 Xabar matnini kiriting:", cancelKeyboard(chatId));
    return;
  }

  // Add place
  if (data === "add_place") {
    userStates[chatId] = { step: "place_name", data: {} };
    await bot.sendMessage(chatId, "Manzil nomini kiriting (masalan: Uy, Ish):", cancelKeyboard(chatId));
    return;
  }

  // Delete place
  if (data.startsWith("del_place_")) {
    const idx = parseInt(data.replace("del_place_", ""));
    if (passengers[chatId]?.savedAddresses && passengers[chatId].savedAddresses[idx]) {
      const name = passengers[chatId].savedAddresses[idx].name;
      passengers[chatId].savedAddresses.splice(idx, 1);
      await answerCb(query.id, { text: `${name} o'chirildi!`, show_alert: false });
      await bot.sendMessage(chatId, "✅ Manzil o'chirildi.", mainMenuKeyboard(chatId));
    }
    return;
  }

  // Quick messages
  if (data.startsWith("quickmsg_")) {
    const msg = data.replace("quickmsg_", "");
    const activeOrder = Object.values(orders).find(
      (o) => o.passenger.chatId === chatId && o.status === "accepted"
    );
    if (activeOrder?.driverId) {
      await bot.sendMessage(activeOrder.driverId, `💬 <b>Tez xabar yo'lovchidan:</b>\n<i>${msg}</i>`, { parse_mode: "HTML" });
      await answerCb(query.id, { text: "Yuborildi!", show_alert: false });
    } else {
      await answerCb(query.id, { text: "Faol buyurtma yo'q!", show_alert: true });
    }
    return;
  }
});

logger.info("🚖 Taxi Bot PRO ishga tushdi!");
