import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { positions } from "./positions.js";
import { tenants } from "./tenants.js";

/**
 * A student standing for a position (Charter section 10.4). Vetting scores are 0 to 25 each and
 * vetting_total is computed by the database, so it can never disagree with its parts.
 *
 * The position link is a composite foreign key (tenant_id, position_id), so a candidate can never
 * point at a position of another school. The charter's `REFERENCES positions(id)` is not valid SQL
 * because id alone is not unique.
 */
export const candidates = pgTable(
  "candidates",
  {
    id: uuid("id").notNull().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    positionId: uuid("position_id").notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    className: varchar("class", { length: 100 }).notNull(),
    photoUrl: text("photo_url"),
    manifesto: text("manifesto"),
    vettingDiscipline: integer("vetting_discipline"),
    vettingAcademic: integer("vetting_academic"),
    vettingCharacter: integer("vetting_character"),
    vettingInterview: integer("vetting_interview"),
    vettingTotal: integer("vetting_total").generatedAlwaysAs(
      sql`vetting_discipline + vetting_academic + vetting_character + vetting_interview`,
    ),
    isApproved: boolean("is_approved").notNull().default(false),
  },
  (t) => [
    primaryKey({ columns: [t.tenantId, t.id] }),
    foreignKey({
      name: "candidates_position_fk",
      columns: [t.tenantId, t.positionId],
      foreignColumns: [positions.tenantId, positions.id],
    }).onDelete("cascade"),
    index("candidates_position_idx").on(t.tenantId, t.positionId),
    check("candidates_vetting_discipline_range", sql`${t.vettingDiscipline} between 0 and 25`),
    check("candidates_vetting_academic_range", sql`${t.vettingAcademic} between 0 and 25`),
    check("candidates_vetting_character_range", sql`${t.vettingCharacter} between 0 and 25`),
    check("candidates_vetting_interview_range", sql`${t.vettingInterview} between 0 and 25`),
  ],
);

export type Candidate = typeof candidates.$inferSelect;
export type NewCandidate = typeof candidates.$inferInsert;
