import {
  type AnyPgColumn,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

export const user = pgTable(
  'user',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull(),
    emailVerified: boolean('email_verified').notNull(),
    image: text('image'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
  },
  table => [uniqueIndex('user_email_unique').on(table.email)],
)

export const session = pgTable(
  'session',
  {
    id: text('id').primaryKey(),
    token: text('token').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
  },
  table => [
    uniqueIndex('session_token_unique').on(table.token),
    index('session_user_id_idx').on(table.userId),
  ],
)

export const account = pgTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', {
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', {
      withTimezone: true,
    }),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
  },
  table => [
    uniqueIndex('account_provider_account_unique').on(table.providerId, table.accountId),
    index('account_user_id_idx').on(table.userId),
  ],
)

export const verification = pgTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
  },
  table => [
    index('verification_identifier_idx').on(table.identifier),
    index('verification_value_idx').on(table.value),
  ],
)

export const brandKit = pgTable('brand_kit', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  createdByUserId: text('created_by_user_id').references(() => user.id, {
    onDelete: 'set null',
  }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const brandKitColor = pgTable(
  'brand_kit_color',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    brandKitId: uuid('brand_kit_id')
      .notNull()
      .references(() => brandKit.id, { onDelete: 'cascade' }),
    name: text('name'),
    hex: text('hex').notNull(),
    position: integer('position').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  table => [index('brand_kit_color_kit_idx').on(table.brandKitId)],
)

export const brandKitAsset = pgTable(
  'brand_kit_asset',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    brandKitId: uuid('brand_kit_id')
      .notNull()
      .references(() => brandKit.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    name: text('name'),
    url: text('url').notNull(),
    mimeType: text('mime_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    position: integer('position').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  table => [
    index('brand_kit_asset_kit_idx').on(table.brandKitId),
    index('brand_kit_asset_kind_idx').on(table.kind),
  ],
)

export const folder = pgTable(
  'folder',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    parentFolderId: uuid('parent_folder_id').references((): AnyPgColumn => folder.id, {
      onDelete: 'cascade',
    }),
    brandKitId: uuid('brand_kit_id').references(() => brandKit.id, {
      onDelete: 'set null',
    }),
    createdByUserId: text('created_by_user_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  table => [
    index('folder_parent_idx').on(table.parentFolderId),
    index('folder_brand_kit_idx').on(table.brandKitId),
  ],
)

export const document = pgTable(
  'document',
  {
    id: uuid('id').primaryKey(),
    ownerUserId: text('owner_user_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    folderId: uuid('folder_id').references(() => folder.id, {
      onDelete: 'set null',
    }),
    lastEditedByUserId: text('last_edited_by_user_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    title: text('title'),
    document: jsonb('document').notNull(),
    vectorBoards: jsonb('vector_boards').notNull(),
    vectorBoardDocs: jsonb('vector_board_docs').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  table => [
    index('document_owner_user_id_idx').on(table.ownerUserId),
    index('document_folder_id_idx').on(table.folderId),
  ],
)

export const schema = {
  user,
  session,
  account,
  verification,
  brandKit,
  brandKitColor,
  brandKitAsset,
  folder,
  document,
}

export type AppSchema = typeof schema
