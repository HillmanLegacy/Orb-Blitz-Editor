import { users, leaderboard, type User, type InsertUser, type LeaderboardEntry, type InsertLeaderboardEntry } from "@shared/schema";
import { db } from "./db";
import { desc, eq, sql } from "drizzle-orm";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getTopScores(limit?: number): Promise<LeaderboardEntry[]>;
  getLowestTopScore(limit?: number): Promise<number>;
  submitScore(entry: InsertLeaderboardEntry): Promise<LeaderboardEntry | null>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username));
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await db.insert(users).values(insertUser).returning();
    return result[0];
  }

  async getTopScores(limit: number = 200): Promise<LeaderboardEntry[]> {
    return await db.select()
      .from(leaderboard)
      .orderBy(desc(leaderboard.score))
      .limit(limit);
  }

  async getLowestTopScore(limit: number = 200): Promise<number> {
    const scores = await db.select()
      .from(leaderboard)
      .orderBy(desc(leaderboard.score))
      .limit(limit);
    
    if (scores.length < limit) {
      return 0;
    }
    return scores[scores.length - 1]?.score || 0;
  }

  async submitScore(entry: InsertLeaderboardEntry): Promise<LeaderboardEntry | null> {
    const lowestScore = await this.getLowestTopScore(200);
    const count = await db.select({ count: sql<number>`count(*)` }).from(leaderboard);
    const totalEntries = Number(count[0]?.count || 0);

    if (totalEntries >= 200 && entry.score <= lowestScore) {
      return null;
    }

    const result = await db.insert(leaderboard).values(entry).returning();

    if (totalEntries >= 200) {
      const lowest = await db.select()
        .from(leaderboard)
        .orderBy(desc(leaderboard.score))
        .limit(1)
        .offset(200);
      
      if (lowest.length > 0) {
        await db.delete(leaderboard).where(eq(leaderboard.id, lowest[0].id));
      }
    }

    return result[0];
  }
}

export const storage = new DatabaseStorage();
