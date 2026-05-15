import { pgTable, text, integer, boolean, timestamp, bigint, uuid, jsonb, serial } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  chatId: bigint("chat_id", { mode: "number" }).unique().notNull(),
  name: text("name"),
  phone: text("phone"),
  lang: text("lang").$type<"uz" | "ru">().default("uz"),
  role: text("role").$type<"driver" | "passenger" | "admin">(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const drivers = pgTable("drivers", {
  chatId: bigint("chat_id", { mode: "number" }).primaryKey().references(() => users.chatId),
  carNumber: text("car_number"),
  carModel: text("car_model"),
  route: text("route"),
  seats: integer("seats"),
  departureTime: text("departure_time"),
  price: integer("price"),
  approved: boolean("approved").default(false),
  blocked: boolean("blocked").default(false),
  online: boolean("online").default(false),
  totalRating: integer("total_rating").default(0),
  ratingCount: integer("rating_count").default(0),
  dailyOrders: integer("daily_orders").default(0),
  lastOrderDate: text("last_order_date"),
  schedule: jsonb("schedule"),
  analytics: jsonb("analytics"),
  breakUntil: timestamp("break_until"),
});

export const orders = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  passengerId: bigint("passenger_id", { mode: "number" }).references(() => users.chatId),
  driverId: bigint("driver_id", { mode: "number" }).references(() => users.chatId),
  route: text("route"),
  seats: integer("seats"),
  departureTime: text("departure_time"),
  status: text("status").$type<"pending" | "accepted" | "completed" | "rejected" | "expired">().default("pending"),
  type: text("type").$type<"passenger" | "parcel">().default("passenger"),
  parcelDesc: text("parcel_desc"),
  createdAt: timestamp("created_at").defaultNow(),
  expiresAt: timestamp("expires_at"),
  rated: boolean("rated").default(false),
  price: integer("price"),
});

export const complaints = pgTable("complaints", {
  id: uuid("id").primaryKey().defaultRandom(),
  fromId: bigint("from_id", { mode: "number" }).references(() => users.chatId),
  fromName: text("from_name"),
  route: text("route"),
  text: text("text"),
  resolved: boolean("resolved").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const sosAlerts = pgTable("sos_alerts", {
  id: uuid("id").primaryKey().defaultRandom(),
  fromId: bigint("from_id", { mode: "number" }).references(() => users.chatId),
  fromName: text("from_name"),
  phone: text("phone"),
  orderId: text("order_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const blacklist = pgTable("blacklist", {
  chatId: bigint("chat_id", { mode: "number" }).primaryKey(),
  name: text("name"),
  phone: text("phone"),
  reason: text("reason"),
  addedAt: timestamp("added_at").defaultNow(),
});

export const referrals = pgTable("referrals", {
  id: serial("id").primaryKey(),
  inviterId: bigint("inviter_id", { mode: "number" }).references(() => users.chatId),
  invitedId: bigint("invited_id", { mode: "number" }).references(() => users.chatId),
  createdAt: timestamp("created_at").defaultNow(),
});

