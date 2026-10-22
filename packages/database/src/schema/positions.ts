import {
  boolean,
  date,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants.js";

/**
 * An elected role such as Head Prefect (Charter section 10.4). The primary key is
 * (tenant_id, id) so a row can never be addressed without its tenant, and so other tables can
 * reference it with a composite foreign key that keeps the tenant consistent.
 */
export const positions = pgTable(
  "positions",
  {
    id: uuid("id").notNull().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 255 }).notNull(),
    displayOrder: integer("display_order").notNull().default(0),
    eligibleClasses: text("eligible_classes").array().notNull(),
    isActive: boolean("is_active").notNull().default(true),
    electionDate: date("election_date"),
  },
  (t) => [
    primaryKey({ columns: [t.tenantId, t.id] }),
    index("positions_tenant_order_idx").on(t.tenantId, t.displayOrder),
  ],
);

export type Position = typeof positions.$inferSelect;
export type NewPosition = typeof positions.$inferInsert;
