import { WorldState } from "@shared/types";

import { tileChars as cliTileChars } from "./cli";
import { tileChars as webTileChars, wrapInFixedWidth } from "./web";

export const visualizeWorldAsText = (
    world: WorldState,
    style: "web" | "cli" = "web",
): string => {
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
                    const content =
                        agentChar ||
                        enemyChar ||
                        seedChar ||
                        (style === "web" ? webTileChars[tile] : cliTileChars[tile]);

                    return style === "web" ? wrapInFixedWidth(content) : content;
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
                `${agent.emoji}${agent.state === "sleeping" ? "💤" : "  "
                } ${agent.name.padEnd(maxNameLength + 1)}: ` +
                `Pos(${agent.position.x.toString().padStart(3)},${agent.position.y
                    .toString()
                    .padStart(3)}) | ` +
                `💓: ${agent.hp.toString().padStart(3)} | ` +
                `Hunger: ${agent.stats.hunger.toFixed(0).padStart(3)} | ` +
                `Fatigue: ${agent.stats.fatigue.toString().padStart(3)} | ` +
                `Social: ${agent.stats.social.toString().padStart(3)} | ` +
                `🍞: ${agent.inventory.food.toString().padStart(3)} | ` +
                `🪵: ${agent.inventory.wood.toString().padStart(3)} | ` +
                `🌰: ${agent.inventory.saplings.toString().padStart(3)}`,
        )
        .join("\n");

    const enemyInfo = `Enemies: ${world.enemies.length}`;

    const formatTime = (minutes: number): string => {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours.toString().padStart(2, "0")}:${mins
            .toString()
            .padStart(2, "0")}`;
    };

    const timeInfo = `Time: ${formatTime(world.timeOfDay)} ${world.isNight ? "🌙" : "☀️"
        }`;

    return `${gridVisual}\n\n${agentInfo}\n\n${enemyInfo}\n${timeInfo}`;
};
