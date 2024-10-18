import { TileType } from "@shared/types";
import {
    customType,
    pgTable,
    text,
    timestamp,
    uuid,
    doublePrecision,
    integer,
    boolean,
    pgEnum,
    jsonb,
    AnyPgColumn,
} from "drizzle-orm/pg-core";

const bytea = customType<{ data: string; notNull: false; default: false }>({
    dataType() {
        return "bytea";
    },
    toDriver(val) {
        return Buffer.from(val, "base64");
    },
    fromDriver(val: any) {
        return val.toString("base64");
    },
});

export type GridDiff = Record<`${number},${number}`, TileType>;

export const agentStateEnum = pgEnum("agent_state", ["sleeping", "awake"]);

export const runs = pgTable("runs", {
    id: uuid("id").defaultRandom().primaryKey(),
    startTime: timestamp("start_time").defaultNow().notNull(),
    status: text("status"),
});

export const worldStates = pgTable("world_states", {
    id: uuid("id").defaultRandom().primaryKey(),
    runId: uuid("run_id").references(() => runs.id),
    previousFullStateId: uuid("previous_full_state_id").references(
        (): AnyPgColumn => worldStates.id,
    ),
    timestamp: timestamp("timestamp").defaultNow().notNull(),
    isNight: boolean("is_night").notNull(),
    timeOfDay: integer("time_of_day").notNull(),
    compressedGrid: bytea("compressed_grid"),
    gridDiff: jsonb("grid_diff").$type<GridDiff>(),
});

export const agents = pgTable("agents", {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    emoji: text("emoji").notNull(),
    model: text("model"),
});

export const agentDetails = pgTable("agent_details", {
    id: uuid("id").defaultRandom().primaryKey(),
    agentId: uuid("agent_id")
        .references(() => agents.id)
        .notNull(),
    worldStateId: uuid("world_state_id").references(() => worldStates.id),
    x: integer("x").notNull(),
    y: integer("y").notNull(),
    state: agentStateEnum("state").notNull(),
    hp: doublePrecision("hp").notNull(),

    hunger: doublePrecision("hunger").notNull(),
    social: doublePrecision("social").notNull(),
    fatigue: doublePrecision("fatigue").notNull(),

    wood: integer("wood").notNull(),
    saplings: integer("saplings").notNull(),
    food: integer("food").notNull(),
});

export const agentThoughts = pgTable("agent_thoughts", {
    id: uuid("id").defaultRandom().primaryKey(),
    agentId: uuid("agent_id").references(() => agentDetails.id),
    thought: text("thought"),
    timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const agentEmotions = pgTable("agent_emotions", {
    id: uuid("id").defaultRandom().primaryKey(),
    agentId: uuid("agent_id").references(() => agentDetails.id),
    emotion: text("emotion"),
    intensity: doublePrecision("intensity"),
});

export const agentActions = pgTable("agent_actions", {
    id: uuid("id").defaultRandom().primaryKey(),
    agentId: uuid("agent_id").references(() => agentDetails.id),
    actionType: text("action_type"),
    actionDetails: jsonb("action_details"),
});

export const enemies = pgTable("enemies", {
    id: uuid("id").defaultRandom().primaryKey(),
    worldStateId: uuid("world_state_id").references(() => worldStates.id),
    x: integer("x").notNull(),
    y: integer("y").notNull(),
    hp: doublePrecision("hp").notNull(),
    emoji: text("emoji").notNull(),
});

export const seedGrowthTimers = pgTable("seed_growth_timers", {
    id: uuid("id").defaultRandom().primaryKey(),
    worldStateId: uuid("world_state_id").references(() => worldStates.id),
    x: integer("x").notNull(),
    y: integer("y").notNull(),
    timer: integer("timer").notNull(),
});

export const buildingProjects = pgTable("building_projects", {
    id: uuid("id").defaultRandom().primaryKey(),
    worldStateId: uuid("world_state_id").references(() => worldStates.id),
    x: integer("x").notNull(),
    y: integer("y").notNull(),
    type: integer("type").notNull(),
    progress: integer("progress"),
});

export const messages = pgTable("messages", {
    id: uuid("id").defaultRandom().primaryKey(),
    agentId: uuid("agent_id")
        .references(() => agents.id)
        .notNull(),
    runId: uuid("run_id")
        .references(() => runs.id)
        .notNull(),
    x: integer("x").notNull(),
    y: integer("y").notNull(),
    volume: integer("volume").notNull(),
    message: text("message").notNull(),
    timestamp: timestamp("timestamp").defaultNow().notNull(),
});
