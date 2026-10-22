import { sql } from "drizzle-orm";
import { boolean, check, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

/**
 * A school. Every other table points here through tenant_id (Charter section 10.1).
 * The subdomain is a DNS label: 1 to 63 lowercase letters, digits or hyphens, with no hyphen at
 * either end. Reserved names (api, www, admin) are rejected by the API (EVT-102), not here.
 */
export const tenants = pgTable(
  "tenants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    subdomain: varchar("subdomain", { length: 63 }).notNull().unique(),
    schoolName: varchar("school_name", { length: 255 }).notNull(),
    primaryColor: varchar("primary_color", { length: 7 }).notNull().default("#1e40af"),
    secondaryColor: varchar("secondary_color", { length: 7 }).notNull().default("#f59e0b"),
    logoUrl: text("logo_url"),
    motto: varchar("motto", { length: 255 }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    check("tenants_subdomain_format", sql`${t.subdomain} ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$'`),
    check("tenants_primary_color_hex", sql`${t.primaryColor} ~ '^#[0-9a-fA-F]{6}$'`),
    check("tenants_secondary_color_hex", sql`${t.secondaryColor} ~ '^#[0-9a-fA-F]{6}$'`),
  ],
);

export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;
