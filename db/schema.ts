import { boolean, index, integer, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";

export const users = pgTable("user", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
});

export const accounts = pgTable(
  "account",
  {
    userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    primaryKey({ columns: [account.provider, account.providerAccountId] }),
    index("account_user_idx").on(account.userId),
  ],
);

export const sessions = pgTable(
  "session",
  {
    sessionToken: text("sessionToken").primaryKey(),
    userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (s) => [index("session_user_idx").on(s.userId)],
);

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })],
);

export const lessonProgress = pgTable(
  "lesson_progress",
  {
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    lessonKey: text("lesson_key").notNull(),
    completedAt: timestamp("completed_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.lessonKey] })],
);

export const quizResults = pgTable(
  "quiz_results",
  {
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    lessonKey: text("lesson_key").notNull(),
    kind: text("kind", { enum: ["predict", "check"] }).notNull(),
    questionIndex: integer("question_index").notNull(),
    correct: boolean("correct").notNull(),
    answeredAt: timestamp("answered_at").notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.lessonKey, t.kind, t.questionIndex] }),
    index("quiz_results_user_idx").on(t.userId),
  ],
);

export const userPreferences = pgTable("user_preferences", {
  userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  theme: text("theme", { enum: ["light", "dark", "black", "sepia"] }),
  textSize: text("text_size", { enum: ["sm", "md", "lg"] }),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
