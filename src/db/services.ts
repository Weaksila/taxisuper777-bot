import { db } from "./index";
import { users, drivers, orders, complaints, blacklist, referrals } from "./schema";
import { eq, and, sql } from "drizzle-orm";
import { UserState, Driver, Passenger, Order } from "../bot/types";

export const userService = {
  async getByChatId(chatId: number) {
    const result = await db.select().from(users).where(eq(users.chatId, chatId)).limit(1);
    return result[0];
  },
  async createOrUpdate(chatId: number, data: Partial<typeof users.$inferInsert>) {
    const existing = await this.getByChatId(chatId);
    if (existing) {
      return await db.update(users).set(data).where(eq(users.chatId, chatId)).returning();
    }
    return await db.insert(users).values({ chatId, ...data } as any).returning();
  }
};

export const driverService = {
  async getByChatId(chatId: number) {
    const result = await db.select().from(drivers).where(eq(drivers.chatId, chatId)).limit(1);
    return result[0];
  },
  async update(chatId: number, data: Partial<typeof drivers.$inferInsert>) {
    return await db.update(drivers).set(data).where(eq(drivers.chatId, chatId)).returning();
  },
  async create(data: typeof drivers.$inferInsert) {
    return await db.insert(drivers).values(data).returning();
  },
  async getOnlineByRoute(route: string) {
    return await db.select().from(drivers).where(
      and(
        eq(drivers.online, true),
        eq(drivers.approved, true),
        eq(drivers.blocked, false),
        eq(drivers.route, route)
      )
    );
  }
};

export const orderService = {
  async create(data: typeof orders.$inferInsert) {
    return await db.insert(orders).values(data).returning();
  },
  async getById(id: string) {
    const result = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
    return result[0];
  },
  async updateStatus(id: string, status: string) {
    return await db.update(orders).set({ status: status as any }).where(eq(orders.id, id)).returning();
  }
};
