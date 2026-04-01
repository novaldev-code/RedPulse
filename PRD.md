🔴 PRODUCT REQUIREMENTS DOCUMENT: REDPULSE (X x IG HYBRID)1. Project OverviewName: RedPulseConcept: A high-performance social media platform combining the speed of X (Twitter) and the visual aesthetics of Instagram.Core Aesthetic: High-contrast "Pulse Red" and "Midnight Black" (OLED Optimized).Architecture: Monorepo (using Turborepo) for unified type safety across Frontend and Backend.2. Technical StackMonorepo: Turborepo / Nx.Frontend: React.js, Tailwind CSS, Shadcn UI, TanStack Query (React Query).Backend: Node.js (Express.js) with TypeScript.Database & ORM: PostgreSQL with Drizzle ORM.Validation: Zod (Shared across monorepo).Authentication: JWT with HttpOnly Cookies.3. Design System & UI/UX3.1 Color PaletteElementDark Mode (Primary)Light ModeBackground#000000 (Pitch Black)#FFFFFFPrimary Accent#FF0000 (Pulse Red)#E11D48 (Crimson)Surface/Cards#121212 (Elevated Black)#F3F4F6Text Primary#FFFFFF#1118273.2 Key UI ComponentsHybrid Feed: Toggle between "List View" (X-style) and "Grid View" (IG-style).Animations: Smooth "Double-tap to like" with red pulse effect (Framer Motion).Theming: Seamless Dark/Light mode transition using CSS Variables.4. Database Schema (Drizzle ORM)Implement the following relational structure:Users Table: id (uuid), username, email, password_hash, avatar_url, bio, created_at.Posts Table: id (uuid), author_id, content (text), media_urls (text array), type (post/repost/reply), parent_id (self-ref for threads), created_at.Follows Table: follower_id, following_id (Composite PK).Likes Table: user_id, post_id (Composite PK).5. Functional Requirements5.1 AuthenticationSecure Login/Register with Zod validation.Session management via JWT stored in HttpOnly Cookies.Protected routes for Feed and Profile.5.2 Social CorePost Creation: Support for 280 characters + up to 4 image/video URLs.Interactions: Like, Repost (X-style), and Threaded Comments.Feed Algorithm: Mix of following content and trending posts (cursor-based pagination).6. Monorepo Structure (Handover Instructions for Claude)Plaintext/redpulse-monorepo
/apps
/web (React app)
/api (Express app)
/packages
/db (Drizzle schemas & migrations)
/ui (Shared Shadcn/Tailwind components)
/validation (Shared Zod schemas) 7. Developer Implementation Guidelines (For Claude Opus)Strict Type Safety: Use Zod schemas defined in packages/validation to infer types in both the Express backend and React frontend.Optimistic UI: Implement onMutate in TanStack Query for Like and Follow actions to ensure zero-latency feel.Drizzle Performance: Use .leftJoin() and sql fragments in Drizzle to fetch post metadata (like counts, follows) in a single query.Responsive Design: Use a "Mobile-First" approach, ensuring the Red/Black theme is consistent across all breakpoints.Note to GPt 5.4: Please start by scaffolding the Monorepo structure and defining the Drizzle Schema in packages/db. Once the foundation is set, proceed to the Express Auth middleware and the React Feed components

1. Visual ERD (Mermaid Syntax)

Cuplikan kode
erDiagram
USERS ||--o{ POSTS : "writes"
USERS ||--o{ LIKES : "gives"
USERS ||--o{ FOLLOWS : "follower/following"

    POSTS ||--o{ LIKES : "received"
    POSTS ||--o{ MEDIA : "contains"
    POSTS ||--o{ POSTS : "replies_to / reposts"

    USERS {
        uuid id PK
        varchar username UK
        varchar email UK
        text password_hash
        text avatar_url
        text bio
        timestamp created_at
    }

    POSTS {
        uuid id PK
        uuid author_id FK
        text content
        enum type "post, reply, repost"
        uuid parent_id FK "self-ref for threads"
        uuid repost_id FK "self-ref for reposts"
        timestamp created_at
    }

    MEDIA {
        uuid id PK
        uuid post_id FK
        text url
        enum type "image, video"
        integer sort_order
    }

    LIKES {
        uuid user_id PK, FK
        uuid post_id PK, FK
        timestamp created_at
    }

    FOLLOWS {
        uuid follower_id PK, FK
        uuid following_id PK, FK
        timestamp created_at
    }

2. Penjelasan Relasi (Logic Business)
   Sebagai developer, ini poin-poin krusial yang harus kamu tekankan pada Claude:

Self-Referencing Posts (X-Style):

parent_id: Jika kolom ini terisi, maka postingan tersebut adalah Reply/Thread.

repost_id: Jika kolom ini terisi, maka postingan tersebut adalah Repost. Konten asli diambil dari ID ini.

Many-to-Many (Social Graph):

Tabel FOLLOWS menggunakan Composite Primary Key (follower_id + following_id). Ini mencegah user mem-follow orang yang sama dua kali.

Tabel LIKES juga menggunakan Composite PK agar satu user hanya bisa memberi satu "Pulse" per postingan.

Media Carousel (IG-Style):

Alih-alih menyimpan satu URL di tabel Post, kita gunakan tabel MEDIA terpisah. Ini memungkinkan fitur Carousel (geser foto) seperti Instagram dengan urutan (sort_order) yang jelas.

3. Snippet Drizzle Schema (Untuk Claude Opus)
   Berikan kode ini ke Claude agar dia langsung punya dasar coding-nya:

TypeScript
// packages/db/schema.ts

import { pgTable, uuid, text, timestamp, varchar, integer, pgEnum, primaryKey } from "drizzle-orm/pg-core";

export const postTypeEnum = pgEnum("post_type", ["post", "reply", "repost"]);

export const users = pgTable("users", {
id: uuid("id").primaryKey().defaultRandom(),
username: varchar("username", { length: 25 }).notNull().unique(),
email: varchar("email", { length: 255 }).notNull().unique(),
passwordHash: text("password_hash").notNull(),
avatarUrl: text("avatar_url"),
bio: text("bio"),
createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const posts = pgTable("posts", {
id: uuid("id").primaryKey().defaultRandom(),
authorId: uuid("author_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
content: text("content"),
type: postTypeEnum("type").default("post").notNull(),
parentId: uuid("parent_id"), // Untuk Thread
repostId: uuid("repost_id"), // Untuk Repost
createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const media = pgTable("media", {
id: uuid("id").primaryKey().defaultRandom(),
postId: uuid("post_id").references(() => posts.id, { onDelete: "cascade" }).notNull(),
url: text("url").notNull(),
type: text("type").notNull(), // image atau video
sortOrder: integer("sort_order").default(0),
});

export const follows = pgTable("follows", {
followerId: uuid("follower_id").references(() => users.id).notNull(),
followingId: uuid("following_id").references(() => users.id).notNull(),
createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
pk: primaryKey({ columns: [table.followerId, table.followingId] }),
}));

export const likes = pgTable("likes", {
userId: uuid("user_id").references(() => users.id).notNull(),
postId: uuid("post_id").references(() => posts.id).notNull(),
createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
pk: primaryKey({ columns: [table.userId, table.postId] }),
}));
