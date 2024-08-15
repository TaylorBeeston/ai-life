import { WorldState, TileType } from "./types";

// ANSI escape codes for colors
const RESET = "\x1b[0m";
const BLUE = "\x1b[34m";
const GREEN = "\x1b[32m";
const BROWN = "\x1b[33m";
const RED = "\x1b[31m";
const CYAN = "\x1b[36m";

// Function to convert a character to its fullwidth equivalent
const toFullWidth = (char: string): string => {
    const code = char.charCodeAt(0);
    return String.fromCharCode(code + 0xfee0);
};

export const visualizeWorld = (world: WorldState): string => {
    const tileChars: { [key in TileType]: string } = {
        [TileType.Grass]: GREEN + toFullWidth(".") + RESET,
        [TileType.Tree]: "🌳",
        [TileType.Water]: BLUE + toFullWidth("~") + RESET,
        [TileType.House]: "🏠",
        [TileType.Wall]: "🟫",
        [TileType.Door]: "🚪",
        [TileType.LockedDoor]: RED + "🔒" + RESET,
        [TileType.Bridge]: BROWN + toFullWidth("#") + RESET,
    };

    const agentPositions = new Map(
        world.agents.map((agent) => [
            `${agent.position.x},${agent.position.y}`,
            agent.emoji,
        ]),
    );

    const enemyPositions = new Map(
        world.enemies.map((enemy) => [
            `${enemy.position.x},${enemy.position.y}`,
            enemy.emoji,
        ]),
    );

    const seedPositions = new Map(
        Object.entries(world.seedGrowthTimers).map(([pos, timer]) => [pos, "🌱"]),
    );

    const gridVisual = world.grid
        .map((row, y) =>
            row
                .map((tile, x) => {
                    const posKey = `${x},${y}`;
                    const agentChar = agentPositions.get(posKey);
                    const enemyChar = enemyPositions.get(posKey);
                    const seedChar = seedPositions.get(posKey);
                    return agentChar || enemyChar || seedChar || tileChars[tile];
                })
                .join(""),
        )
        .join("\n");

    const maxNameLength = Math.max(
        ...world.agents.map((agent) => agent.name.length),
    );

    const agentInfo = world.agents
        .map(
            (agent) =>
                `${agent.emoji}${agent.state === "sleeping" ? "💤" : "  "} ${agent.name.padEnd(maxNameLength + 1)}: ` +
                `Pos(${agent.position.x.toString().padStart(3)},${agent.position.y.toString().padStart(3)}) | ` +
                `💓: ${agent.hp.toString().padStart(3)} | ` +
                `Hunger: ${agent.stats.hunger.toFixed(0).padStart(3)} | ` +
                `Fatigue: ${agent.stats.fatigue.toString().padStart(3)} | ` +
                `Social: ${agent.stats.social.toString().padStart(3)} | ` +
                `🍞: ${agent.inventory.food.toString().padStart(3)} | ` +
                `🪵: ${agent.inventory.wood.toString().padStart(3)} | ` +
                `🌰: ${agent.inventory.seeds.toString().padStart(3)}`,
        )
        .join("\n");

    const enemyInfo = `Enemies: ${world.enemies.length}`;

    const formatTime = (minutes: number): string => {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
    };

    const timeInfo = `Time: ${formatTime(world.timeOfDay)} ${world.isNight ? "🌙" : "☀️"}`;

    return `${gridVisual}\n\n${agentInfo}\n\n${enemyInfo}\n${timeInfo}`;
};
