import { sqliteTable, text, int } from "drizzle-orm/sqlite-core";

export const usersTable = sqliteTable("users_table", {
  id: text().primaryKey(),
  username: text().notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  salt: text().notNull(),
  iterations: int().notNull(),
  createdAt: text("created_at").notNull(),
});

export const sessionsTable = sqliteTable("sessions_table", {
  token: text().primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => usersTable.id),
  createdAt: text("created_at").notNull(),
});

/** Contacto del usuario: teléfono + vínculo con Telegram. Modelo separado de `users`. */
export const contactsTable = sqliteTable("contacts", {
  id: text().primaryKey(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => usersTable.id),
  phone: text().notNull().default(""),
  telegramChatId: text("telegram_chat_id"),
  createdAt: text("created_at").notNull(),
});

/** Contrato de vinculación Telegram: expira a los 10 minutos sin confirmar. */
export const telegramLinkRequestsTable = sqliteTable(
  "telegram_link_requests",
  {
    id: text().primaryKey(), // código único (va en /start <code>)
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id),
    status: text().notNull().default("pending"), // pending|confirmed|cancelled|expired
    expiresAt: text("expires_at").notNull(),
    createdAt: text("created_at").notNull(),
  },
);

/**
 * Historial del agente Checky por usuario. `role` = "user" | "assistant";
 * `day` (YYYY-MM-DD UTC) se usa para el límite diario de inputs.
 */
export const checkyMessagesTable = sqliteTable("checky_messages", {
  id: text().primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => usersTable.id),
  role: text().notNull(),
  text: text().notNull(),
  day: text().notNull(),
  createdAt: text("created_at").notNull(),
});

/** Documento JSON con el dominio (places, listas, productos, invitaciones). */
export const appStateTable = sqliteTable("app_state", {
  id: int().primaryKey(),
  doc: text().notNull(),
  updatedAt: text("updated_at").notNull(),
});
