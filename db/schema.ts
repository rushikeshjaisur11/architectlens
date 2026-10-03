import { boolean, index, integer, pgTable, primaryKey, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";

export const users = pgTable("user", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
  passwordHash: text("password_hash"),
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

export const authAttempts = pgTable(
  "auth_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: text("key").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("auth_attempts_key_created_idx").on(t.key, t.createdAt)],
);

export const coupons = pgTable("coupons", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  description: text("description"),
  kind: text("kind", { enum: ["percent", "fixed", "free_access"] }).notNull(),
  value: integer("value").notNull().default(0),
  currency: text("currency"),
  maxRedemptions: integer("max_redemptions"),
  redeemedCount: integer("redeemed_count").notNull().default(0),
  validFrom: timestamp("valid_from"),
  validUntil: timestamp("valid_until"),
  grantsPlan: text("grants_plan"),
  grantDays: integer("grant_days"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: text("created_by"),
});

export const couponRedemptions = pgTable(
  "coupon_redemptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    couponId: uuid("coupon_id").notNull().references(() => coupons.id),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    redeemedAt: timestamp("redeemed_at").notNull().defaultNow(),
  },
  (t) => [unique("coupon_redemptions_coupon_user_unique").on(t.couponId, t.userId)],
);

export const entitlements = pgTable(
  "entitlements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    plan: text("plan").notNull(),
    source: text("source", { enum: ["coupon", "purchase", "admin"] }).notNull(),
    couponId: uuid("coupon_id").references(() => coupons.id),
    startsAt: timestamp("starts_at").notNull().defaultNow(),
    endsAt: timestamp("ends_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("entitlements_user_idx").on(t.userId)],
);
