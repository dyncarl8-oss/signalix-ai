import { z } from "zod";
import { createInsertSchema } from "drizzle-zod";
import { pgTable, varchar, integer, timestamp } from "drizzle-orm/pg-core";

export const cryptoPairs = [
  "BTC/USDT",
  "ETH/USDT",
  "BNB/USDT",
  "SOL/USDT",
  "XRP/USDT",
  "DOGE/USDT",
  "ADA/USDT",
] as const;

// Note: Only forex pairs supported by Binance spot trading are included
// Binance offers these as EURUSDT, GBPUSDT, and AUDUSDT
export const forexPairs = [
  "EUR/USD",
  "GBP/USD",
  "AUD/USD",
] as const;

export const tradingPairs = [...cryptoPairs, ...forexPairs] as const;

export const messageSchema = z.object({
  id: z.string(),
  sender: z.enum(["user", "bot"]),
  content: z.string(),
  timestamp: z.date(),
  prediction: z.object({
    pair: z.enum(tradingPairs),
    direction: z.enum(["UP", "DOWN", "NEUTRAL"]),
    confidence: z.number().min(0).max(100),
    duration: z.string(),
    analysis: z.string().optional(),
    rationale: z.string().optional(),
    riskFactors: z.array(z.string()).optional(),
  }).optional(),
});

export type Message = z.infer<typeof messageSchema>;
export type TradingPair = typeof tradingPairs[number];
export type CryptoPair = typeof cryptoPairs[number];
export type ForexPair = typeof forexPairs[number];

export const users = pgTable("users", {
  id: varchar("id").primaryKey(),
  username: varchar("username").notNull(),
  name: varchar("name").notNull(),
  profilePictureUrl: varchar("profile_picture_url"),
  credits: integer("credits").notNull().default(10),
  hasUnlimitedAccess: varchar("has_unlimited_access").notNull().default("false"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  createdAt: true,
  updatedAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const userCreditsSchema = z.object({
  userId: z.string(),
  credits: z.number().int().min(0),
  hasUnlimitedAccess: z.boolean(),
});

export type UserCredits = z.infer<typeof userCreditsSchema>;
