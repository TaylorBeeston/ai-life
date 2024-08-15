import { faker } from "@faker-js/faker";
import { v4 as uuidv4 } from "uuid";

import {
    Agent,
    Position,
    WorldState,
    Perception,
    TileType,
    Stats,
    EmotionalOutput,
    Action,
    Tile,
} from "@shared/types";

const agentEmojis = [
    "👤",
    "👩",
    "👨",
    "👱",
    "👵",
    "👴",
    "👧",
    "👦",
    "👮",
    "👷",
    "👸",
    "🤴",
    "🧙",
];

// Agent functions
export const createAgent = (position: Position): Agent => ({
    id: uuidv4(),
    name: faker.person.fullName(),
    position,
    stats: { hunger: 0, fatigue: 0, social: 100 },
    state: "awake",
    inventory: { wood: 0, seeds: 0, food: 0 },
    emoji: agentEmojis[Math.floor(Math.random() * agentEmojis.length)],
    hp: 100,
});

export const perceive = (agent: Agent, world: WorldState): Perception => {
    const { x, y } = agent.position;
    const visibleArea: TileType[][] = [];

    for (let dy = -1; dy <= 1; dy++) {
        const row: TileType[] = [];
        for (let dx = -1; dx <= 1; dx++) {
            const newX = x + dx;
            const newY = y + dy;
            if (
                newX >= 0 &&
                newX < world.grid[0].length &&
                newY >= 0 &&
                newY < world.grid.length
            ) {
                row.push(world.grid[newY][newX]);
            } else {
                row.push(TileType.Wall); // Treat out of bounds as walls
            }
        }
        visibleArea.push(row);
    }

    const nearbyAgents = world.agents.filter(
        (other) =>
            Math.abs(other.position.x - x) <= 1 &&
            Math.abs(other.position.y - y) <= 1 &&
            other.id !== agent.id,
    );

    const nearbyEnemies = world.enemies.filter(
        (enemy) =>
            Math.abs(enemy.position.x - x) <= 1 &&
            Math.abs(enemy.position.y - y) <= 1,
    );

    return { visibleArea, nearbyAgents, nearbyEnemies, isNight: world.isNight };
};

// Emotional processing
const emotionalModules = ["joy", "fear", "anger", "sadness"];

const processEmotion = (
    emotion: string,
    perception: Perception,
    stats: Stats,
): EmotionalOutput => {
    // Simplified emotional processing
    return {
        emotion,
        intensity: Math.random(),
    };
};

export const processEmotions = (
    perception: Perception,
    stats: Stats,
): EmotionalOutput[] =>
    emotionalModules.map((emotion) => processEmotion(emotion, perception, stats));

// Cognitive processing
export const cognitiveProcess = (
    perception: Perception,
    stats: Stats,
    emotionalOutputs: EmotionalOutput[],
): string => {
    // Simplified cognitive processing
    return "Thinking about moving...";
};

const getAdjacentActions = (agent: Agent, world: WorldState): Tile[] => {
    const { x, y } = agent.position;
    const adjacentPositions = [
        { x: x - 1, y },
        { x: x + 1, y },
        { x, y: y - 1 },
        { x, y: y + 1 },
    ];

    return adjacentPositions
        .filter(
            (pos) =>
                pos.x >= 0 &&
                pos.x < world.grid[0].length &&
                pos.y >= 0 &&
                pos.y < world.grid.length,
        )
        .map((pos) => {
            const tileType = world.grid[pos.y][pos.x];
            return {
                position: pos,
                type: tileType,
            };
        })
        .filter(
            (tile) =>
                tile.type === TileType.Tree ||
                tile.type === TileType.Water ||
                tile.type === TileType.Door ||
                (tile.type === TileType.Grass && agent.inventory.seeds > 0),
        );
};

const findNearestHouse = (agent: Agent, world: WorldState): Position | null => {
    const { grid } = world;
    const { x: agentX, y: agentY } = agent.position;
    let nearestHouse: Position | null = null;
    let minDistance = Infinity;

    for (let y = 0; y < grid.length; y++) {
        for (let x = 0; x < grid[y].length; x++) {
            if (grid[y][x] === TileType.House) {
                const distance = Math.abs(x - agentX) + Math.abs(y - agentY);
                if (distance < minDistance) {
                    minDistance = distance;
                    nearestHouse = { x, y };
                }
            }
        }
    }

    return nearestHouse;
};

const findAdjacentBuildingSpot = (
    agent: Agent,
    housePosition: Position,
    world: WorldState,
): { position: Position; type: TileType.Wall | TileType.Door } | null => {
    const { grid } = world;
    const { x: agentX, y: agentY } = agent.position;
    const directions = [
        { dx: -1, dy: 0 },
        { dx: 1, dy: 0 },
        { dx: 0, dy: -1 },
        { dx: 0, dy: 1 },
    ];

    // Check adjacent tiles to the agent
    for (const { dx, dy } of directions) {
        const newX = agentX + dx;
        const newY = agentY + dy;
        if (
            newX >= 0 &&
            newX < grid[0].length &&
            newY >= 0 &&
            newY < grid.length &&
            grid[newY][newX] === TileType.Grass &&
            !world.buildingProjects.some(
                (project) => project.position.x === newX && project.position.y === newY,
            )
        ) {
            const distanceX = Math.abs(newX - housePosition.x);
            const distanceY = Math.abs(newY - housePosition.y);

            // Check if this position helps form a larger rectangle around the house
            if (
                distanceX <= 4 &&
                distanceY <= 4 &&
                (distanceX === 4 || distanceY === 4)
            ) {
                // Determine if this should be a wall or a door
                const isDoor =
                    (distanceX === 4 && newY === housePosition.y) ||
                    (distanceY === 4 && newX === housePosition.x);

                return {
                    position: { x: newX, y: newY },
                    type: isDoor ? TileType.Door : TileType.Wall,
                };
            }
        }
    }

    return null;
};

const shouldBuild = (agent: Agent, world: WorldState): boolean => {
    return agent.inventory.wood >= 5 && Math.random() < 0.3; // 30% chance to build if enough wood
};

export const executeAction = (
    agent: Agent,
    world: WorldState,
    streamOfConsciousness: string,
): Action => {
    if (agent.stats.fatigue > 99 || agent.state === "sleeping") {
        return { type: "Sleep" };
    }

    if (agent.stats.hunger > 40 && agent.inventory.food > 0) {
        return { type: "Use", item: "food", position: agent.position };
    }

    const perception = perceive(agent, world);

    if (perception.nearbyEnemies.length > 0) {
        return { type: "Attack", position: perception.nearbyEnemies[0].position };
    }

    // Check for nearby awake agents
    const nearbyAgents = world.agents.filter(
        (otherAgent) =>
            otherAgent.id !== agent.id &&
            otherAgent.state === "awake" &&
            Math.abs(otherAgent.position.x - agent.position.x) <= 10 &&
            Math.abs(otherAgent.position.y - agent.position.y) <= 10,
    );

    if (nearbyAgents.length > 0 && Math.random() > 0.7) {
        // Find the closest agent
        const closestAgent = nearbyAgents.reduce((closest, current) =>
            Math.abs(current.position.x - agent.position.x) +
                Math.abs(current.position.y - agent.position.y) <
                Math.abs(closest.position.x - agent.position.x) +
                Math.abs(closest.position.y - agent.position.y)
                ? current
                : closest,
        );

        // If adjacent, talk/feed
        if (
            Math.abs(closestAgent.position.x - agent.position.x) <= 1 &&
            Math.abs(closestAgent.position.y - agent.position.y) <= 1
        ) {
            if (closestAgent.stats.hunger > 40 && agent.inventory.food > 0) {
                return { type: "Use", item: "food", position: closestAgent.position };
            }

            return { type: "Talk", volume: 1, message: "Hi!" };
        }

        // Otherwise, move towards the closest agent
        const dx = Math.sign(closestAgent.position.x - agent.position.x);
        const dy = Math.sign(closestAgent.position.y - agent.position.y);

        return { type: "Move", position: { x: dx, y: dy } };
    }

    if (shouldBuild(agent, world)) {
        const nearestHouse = findNearestHouse(agent, world);
        if (nearestHouse) {
            const buildingSpot = findAdjacentBuildingSpot(agent, nearestHouse, world);
            if (buildingSpot) {
                return {
                    type: "Build",
                    structure: buildingSpot.type,
                    position: buildingSpot.position,
                };
            }
        }
    }

    // TODO: This is a hack, actions should be chosen by LLM based on their perception
    const adjacentActions = getAdjacentActions(agent, world);

    if (adjacentActions.length > 0) {
        if (agent.inventory.wood > 0) {
            if (agent.inventory.wood > 2) {
                const buildBridgeAction = adjacentActions.find(
                    (action) => action.type === TileType.Water,
                );

                if (buildBridgeAction) {
                    return { type: "Interact", position: buildBridgeAction.position };
                }
            }
        }

        const chopAction = adjacentActions.find(
            (action) => action.type === TileType.Tree,
        );

        if (chopAction) return { type: "Interact", position: chopAction.position };

        if (agent.inventory.seeds > 0) {
            const plantAction = adjacentActions.find(
                (action) => action.type === TileType.Grass,
            );

            if (plantAction && Math.random() > 0.9) {
                return { type: "Use", item: "seeds", position: plantAction.position };
            }
        }

        const lockUnlockAction = adjacentActions.find(
            (action) => action.type === TileType.Door,
        );

        if (lockUnlockAction && Math.random() > 0.8) {
            return { type: "Interact", position: lockUnlockAction.position };
        }
    }

    // If it's night and no enemies nearby, prefer to stay near the house
    if (world.isNight) {
        const house = findNearestHouse(agent, world);
        if (house) {
            const dx = Math.sign(house.x - agent.position.x);
            const dy = Math.sign(house.y - agent.position.y);
            return { type: "Move", position: { x: dx, y: dy } };
        }
    }

    // Otherwise, move randomly as before
    const randomDirection = Math.floor(Math.random() * 4);
    const moves = [
        { x: -1, y: 0 }, // Left
        { x: 1, y: 0 }, // Right
        { x: 0, y: -1 }, // Up
        { x: 0, y: 1 }, // Down
    ];
    return { type: "Move", position: moves[randomDirection] };
};
