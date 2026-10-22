import { sql } from "drizzle-orm";
import { boolean, check, pgTable, timestamp, unique, uuid, varchar } from "drizzle-orm/pg-core";
import { tenants } from "./tenants.js";

/** Roles from Charter section 9. Students and kiosks are never users (zero PII). */
export const USER_ROLES = ["super_admin", "admin", "teacher"] as const;
export type UserRole = (typeof USER_ROLES)[number];

const roleList = sql.raw(USER_ROLES.map((role) => `'${role}'`).join(", "));

/** Teachers and admins of one school (Charter section 10.2). */
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    email: varchar("email", { length: 255 }).notNull(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    fullName: varchar("full_name", { length: 255 }).notNull(),
    role: varchar("role", { length: 50 }).notNull().default("teacher"),
    isActive: boolean("is_active").notNull().default(true),
    lastLogin: timestamp("last_login", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("unique_email_per_tenant").on(t.tenantId, t.email),
    check("users_role_valid", sql`${t.role} in (${roleList})`),
    // Emails are stored lowercase so the unique constraint above is case-insensitive.
    check("users_email_lowercase", sql`${t.email} = lower(${t.email})`),
  ],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
