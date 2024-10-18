import { pick } from "lodash";
import * as zlib from "zlib";
import { promisify } from "util";

import { db } from "./";
import * as schema from "./schema";
import {
    Agent,
    WorldState,
    TileType,
    Enemy,
    BuildingProject,
    Message,
} from "@shared/types";
import { eq, sql, and, isNotNull, desc, inArray } from "drizzle-orm";

const compress = promisify(zlib.brotliCompress);
const decompress = promisify(zlib.brotliDecompress);

const FULL_STATE_INTERVAL = 5;

export const compressGrid = async (grid: TileType[][]): Promise<string> => {
    const gridString = JSON.stringify(grid);
    const compressedBuffer = await compress(Buffer.from(gridString));
    return compressedBuffer.toString("base64");
};

export const decompressGrid = async (
    compressedGrid: string,
): Promise<TileType[][]> => {
    const compressedBuffer = Buffer.from(compressedGrid, "base64");
    const decompressedBuffer = await decompress(compressedBuffer);
    return JSON.parse(decompressedBuffer.toString());
};

export const calculateGridDiff = (
    oldGrid: TileType[][],
    newGrid: TileType[][],
): schema.GridDiff => {
    const diff: schema.GridDiff = {};
    for (let y = 0; y < newGrid.length; y++) {
        for (let x = 0; x < newGrid[y].length; x++) {
            if (oldGrid[y][x] !== newGrid[y][x]) {
                diff[`${x},${y}`] = newGrid[y][x];
            }
        }
    }
    return diff;
};

export const applyGridDiff = (
    baseGrid: TileType[][],
    diff: schema.GridDiff,
): TileType[][] => {
    const newGrid = structuredClone(baseGrid);

    for (const [key, value] of Object.entries(diff)) {
        const [x, y] = key.split(",").map(Number);
        newGrid[y][x] = value as TileType;
    }

    return newGrid;
};

export const saveWorldState = async (worldState: WorldState, runId: string) => {
    const stateCount = await db
        .select({ count: sql`count(*)` })
        .from(schema.worldStates)
        .where(eq(schema.worldStates.runId, runId));

    const isFullState =
        (stateCount[0].count as number) % FULL_STATE_INTERVAL === 0;

    let previousFullStateId: string | null = null;
    let gridDiff: schema.GridDiff | null = null;

    if (!isFullState) {
        const previousFullState = await db
            .select()
            .from(schema.worldStates)
            .where(
                and(
                    eq(schema.worldStates.runId, runId),
                    isNotNull(schema.worldStates.compressedGrid),
                ),
            )
            .orderBy(sql`timestamp DESC`)
            .limit(1);

        if (previousFullState.length > 0) {
            previousFullStateId = previousFullState[0].id;

            const previousGrid = await decompressGrid(
                previousFullState[0].compressedGrid ?? "",
            );

            gridDiff = calculateGridDiff(previousGrid, worldState.grid);
        }
    }

    const [insertedWorldState] = await db
        .insert(schema.worldStates)
        .values({
            runId,
            isNight: worldState.isNight,
            timeOfDay: worldState.timeOfDay,
            compressedGrid: isFullState ? await compressGrid(worldState.grid) : null,
            previousFullStateId,
            gridDiff: isFullState ? null : gridDiff,
        })
        .returning();

    // Save agents
    for (const agent of worldState.agents) {
        if (agent) await saveAgent(agent, insertedWorldState.id);
    }

    // Save enemies
    const enemies = worldState.enemies.map((enemy) => ({
        worldStateId: insertedWorldState.id,
        x: enemy.position.x,
        y: enemy.position.y,
        hp: enemy.hp,
        emoji: enemy.emoji,
    }));

    if (enemies.length > 0) await db.insert(schema.enemies).values(enemies);

    // Save seed growth timers
    const seedTimers = Object.entries(worldState.seedGrowthTimers).map(
        ([key, timer]) => {
            const [x, y] = key.split(",").map(Number);
            return { worldStateId: insertedWorldState.id, x, y, timer };
        },
    );

    if (seedTimers.length > 0) {
        await db.insert(schema.seedGrowthTimers).values(seedTimers);
    }

    // Save building projects
    const buildingProjects = worldState.buildingProjects.map((project) => ({
        worldStateId: insertedWorldState.id,
        x: project.position.x,
        y: project.position.y,
        type: project.type,
        progress: project.progress,
    }));

    if (buildingProjects.length > 0) {
        await db.insert(schema.buildingProjects).values(buildingProjects);
    }

    return insertedWorldState.id;
};

export const saveAgent = async (agent: Agent, worldStateId: string) => {
    await db
        .insert(schema.agents)
        .values({
            id: agent.id,
            name: agent.name,
            emoji: agent.emoji,
            model: agent.model,
        })
        .onConflictDoUpdate({
            target: schema.agents.id,
            set: {
                name: agent.name,
                emoji: agent.emoji,
                model: agent.model,
            },
        });

    const [insertedAgentDetails] = await db
        .insert(schema.agentDetails)
        .values({
            agentId: agent.id,
            worldStateId,
            x: agent.position.x,
            y: agent.position.y,
            state: agent.state,
            hp: agent.hp,
            hunger: agent.stats.hunger,
            social: agent.stats.social,
            fatigue: agent.stats.fatigue,
            wood: agent.inventory.wood,
            saplings: agent.inventory.saplings,
            food: agent.inventory.food,
        })
        .returning();

    return insertedAgentDetails.id;
};

export async function getWorldStates(runId: string): Promise<WorldState[]> {
    const worldStates = await db
        .select()
        .from(schema.worldStates)
        .where(eq(schema.worldStates.runId, runId))
        .orderBy(schema.worldStates.timestamp);

    const reconstructedStates: WorldState[] = [];
    let lastFullGrid: TileType[][] | null = null;

    for (const state of worldStates) {
        let grid: TileType[][];

        if (state.compressedGrid) {
            grid = await decompressGrid(state.compressedGrid);
            lastFullGrid = grid;
        } else {
            if (!lastFullGrid) {
                throw new Error(
                    "Cannot reconstruct diff without a previous full state",
                );
            }
            grid = applyGridDiff(lastFullGrid, state.gridDiff ?? {});
        }

        const agents = await getAgents(state.id);
        const enemies = await getEnemies(state.id);
        const seedGrowthTimers = await getSeedGrowthTimers(state.id);
        const buildingProjects = await getBuildingProjects(state.id);

        reconstructedStates.push({
            grid,
            agents,
            enemies,
            seedGrowthTimers,
            buildingProjects,
            isNight: state.isNight,
            timeOfDay: state.timeOfDay,
        });
    }

    return reconstructedStates;
}

export async function getCurrentWorldStateForRun(
    runId: string,
): Promise<WorldState | undefined> {
    const worldStates = await db
        .select()
        .from(schema.worldStates)
        .where(eq(schema.worldStates.runId, runId))
        .orderBy(schema.worldStates.timestamp)
        .limit(FULL_STATE_INTERVAL);

    const reconstructedStates: WorldState[] = [];
    let lastFullGrid: TileType[][] | null = null;

    for (const state of worldStates) {
        let grid: TileType[][];

        if (state.compressedGrid) {
            grid = await decompressGrid(state.compressedGrid);
            lastFullGrid = grid;
        } else {
            if (!lastFullGrid) {
                throw new Error(
                    "Cannot reconstruct diff without a previous full state",
                );
            }
            grid = applyGridDiff(lastFullGrid, state.gridDiff ?? {});
        }

        const agents = await getAgents(state.id);
        const enemies = await getEnemies(state.id);
        const seedGrowthTimers = await getSeedGrowthTimers(state.id);
        const buildingProjects = await getBuildingProjects(state.id);

        reconstructedStates.push({
            grid,
            agents,
            enemies,
            seedGrowthTimers,
            buildingProjects,
            isNight: state.isNight,
            timeOfDay: state.timeOfDay,
        });
    }

    return reconstructedStates.at(-1);
}

async function getAgents(worldStateId: string): Promise<Agent[]> {
    const agents = await db
        .select()
        .from(schema.agentDetails)
        .where(eq(schema.agentDetails.worldStateId, worldStateId));
    return (
        await Promise.all(
            agents.map(async (agent) => {
                const [info] =
                    (await db
                        .select()
                        .from(schema.agents)
                        .where(eq(schema.agents.id, agent.agentId))
                        .limit(1)) ?? [];

                if (!info) return false;

                return {
                    id: info.id,
                    name: info.name,
                    position: { x: agent.x, y: agent.y },
                    state: agent.state,
                    emoji: info.emoji,
                    hp: agent.hp,
                    model: (info.model as "gemini-1.5-flash") ?? undefined,
                    stats: pick(agent, ["hunger", "social", "fatigue"] as const),
                    inventory: pick(agent, ["wood", "food", "saplings"] as const),
                };
            }),
        )
    ).filter((agent) => !!agent);
}

async function getEnemies(worldStateId: string): Promise<Enemy[]> {
    const enemies = await db
        .select()
        .from(schema.enemies)
        .where(eq(schema.enemies.worldStateId, worldStateId));
    return enemies.map((enemy) => ({
        id: enemy.id,
        position: { x: enemy.x, y: enemy.y },
        hp: enemy.hp,
        emoji: enemy.emoji,
    }));
}

async function getSeedGrowthTimers(
    worldStateId: string,
): Promise<Record<string, number>> {
    const timers = await db
        .select()
        .from(schema.seedGrowthTimers)
        .where(eq(schema.seedGrowthTimers.worldStateId, worldStateId));
    return timers.reduce(
        (acc, timer) => {
            acc[`${timer.x},${timer.y}`] = timer.timer;
            return acc;
        },
        {} as Record<string, number>,
    );
}

async function getBuildingProjects(
    worldStateId: string,
): Promise<BuildingProject[]> {
    const projects = await db
        .select()
        .from(schema.buildingProjects)
        .where(eq(schema.buildingProjects.worldStateId, worldStateId));
    return projects.map((project) => ({
        type: project.type as TileType,
        progress: project.progress ?? 0,
        position: { x: project.x, y: project.y },
    }));
}

export async function saveAgentDetails(agent: Agent, worldStateId: string) {
    const agentId = await saveAgent(agent, worldStateId);

    if (agent.thoughts) {
        await db.insert(schema.agentThoughts).values({
            agentId,
            thought: agent.thoughts,
        });
    }

    if (agent.emotions) {
        await db.insert(schema.agentEmotions).values(
            agent.emotions.map((emotion) => ({
                agentId,
                emotion: emotion.emotion,
                intensity: emotion.intensity,
            })),
        );
    }

    if (agent.action) {
        await db.insert(schema.agentActions).values({
            agentId,
            actionType: agent.action.type,
            actionDetails: agent.action,
        });
    }
}

export async function getAgentDetails(agentId: string, worldStateId: string) {
    const [agent] =
        (await db
            .select()
            .from(schema.agentDetails)
            .where(
                and(
                    eq(schema.agentDetails.agentId, agentId),
                    eq(schema.agentDetails.worldStateId, worldStateId),
                ),
            )
            .limit(1)) ?? [];

    const [info] =
        (await db
            .select()
            .from(schema.agents)
            .where(eq(schema.agents.id, agent.id))
            .limit(1)) ?? [];

    if (!agent || !info) return null;

    const thoughts = await db
        .select()
        .from(schema.agentThoughts)
        .where(eq(schema.agentThoughts.agentId, agent.id))
        .orderBy(schema.agentThoughts.timestamp);
    const emotions = await db
        .select()
        .from(schema.agentEmotions)
        .where(eq(schema.agentEmotions.agentId, agent.id))
        .orderBy(desc(schema.agentEmotions.intensity));
    const actions = await db
        .select()
        .from(schema.agentActions)
        .where(eq(schema.agentActions.agentId, agentId));

    return {
        id: info.id,
        name: info.name,
        position: { x: agent.x, y: agent.y },
        state: agent.state,
        emoji: info.emoji,
        hp: agent.hp,
        model: (info.model as "gemini-1.5-flash") ?? undefined,
        stats: pick(agent, ["hunger", "social", "fatigue"] as const),
        inventory: pick(agent, ["wood", "food", "saplings"] as const),
        thoughts,
        emotions,
        actions,
    };
}

export async function createNewRun() {
    const [result] = await db
        .insert(schema.runs)
        .values({ status: "in_progress" })
        .returning();
    return result.id;
}

export async function finishRun(id: string) {
    return db
        .update(schema.runs)
        .set({ status: "finished" })
        .where(eq(schema.runs.id, id));
}

export async function getCurrentRun() {
    return (
        await db
            .select()
            .from(schema.runs)
            .orderBy(desc(schema.runs.startTime))
            .where(eq(schema.runs.status, "in_progress"))
            .limit(1)
    )[0];
}

export async function getAllRuns() {
    return await db.select().from(schema.runs).orderBy(schema.runs.startTime);
}

export const createMessage = async (
    message: Omit<Message, "timestamp" | "sender">,
    sender: Agent,
    runId: string,
) => {
    const [result] = await db
        .insert(schema.messages)
        .values({
            agentId: sender.id,
            runId,
            x: sender.position.x,
            y: sender.position.y,
            volume: message.volume,
            message: message.content,
        })
        .returning();

    return result.id;
};

export const getRecentMessages = async (
    nearbyAgents: Agent[],
): Promise<Message[]> => {
    return db
        .select({
            sender: schema.messages.agentId,
            volume: schema.messages.volume,
            content: schema.messages.message,
            timestamp: schema.messages.timestamp,
        })
        .from(schema.messages)
        .where(
            inArray(
                schema.messages.agentId,
                nearbyAgents.map((agent) => agent.id),
            ),
        )
        .orderBy(desc(schema.messages.timestamp))
        .limit(25);
};
