/**
 * Templates table schema for material templates system
 * Add this to drizzle/schema.ts
 */

import { mysqlTable, int, varchar, text, timestamp, mysqlEnum, boolean, json } from "drizzle-orm/mysql-core";

export const templates = mysqlTable("templates", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  type: mysqlEnum("type", [
    "quiz",
    "slides",
    "crossword",
    "missing_words",
    "wordsearch",
    "flashcards",
  ]).notNull(),
  structure: json("structure").notNull(),
  isPublic: boolean("isPublic").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  tenantId: int("tenantId"),
});
