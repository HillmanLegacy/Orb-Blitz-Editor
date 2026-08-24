import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const leaderboard = pgTable("leaderboard", {
  id: serial("id").primaryKey(),
  playerName: text("player_name").notNull(),
  score: integer("score").notNull(),
  gameMode: text("game_mode").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertLeaderboardSchema = createInsertSchema(leaderboard).pick({
  playerName: true,
  score: true,
  gameMode: true,
});

export type InsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type InsertLeaderboardEntry = typeof leaderboard.$inferInsert;
export type LeaderboardEntry = typeof leaderboard.$inferSelect;
