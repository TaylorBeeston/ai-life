// src/visualization.ts

import type { WorldState, TileType, Position } from "@shared/types";

export const CELL_SIZE = 16; // Size of each grid cell in pixels

export const COLORS = {
    GRASS: "#2ecc71",
    TREE: "#27ae60",
    WATER: "#3498db",
    HOUSE: "#e74c3c",
    WALL: "#95a5a6",
    DOOR: "#f39c12",
    LOCKED_DOOR: "#c0392b",
    BRIDGE: "#d35400",
};

export class Renderer {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private tileImages: Map<TileType, HTMLImageElement> = new Map();

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d", { alpha: false })!;
        this.initTileImages();
    }

    private initTileImages() {
        const tileTypes: TileType[] = [0, 1, 2, 3, 4, 5, 6, 7];
        const tileChars = [".", "🌳", "🌊", "🏠", "🧱", "🚪", "🔒", "🌉"];

        tileTypes.forEach((type, index) => {
            const img = this.createImageFromEmoji(tileChars[index]);
            this.tileImages.set(type, img);
        });
    }

    private createImageFromEmoji(emoji: string): HTMLImageElement {
        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = CELL_SIZE;
        tempCanvas.height = CELL_SIZE;
        const tempCtx = tempCanvas.getContext("2d")!;
        tempCtx.font = `${CELL_SIZE}px Arial`;
        tempCtx.textAlign = "center";
        tempCtx.textBaseline = "middle";
        tempCtx.fillText(emoji, CELL_SIZE / 2, CELL_SIZE / 2);

        const img = new Image();
        img.src = tempCanvas.toDataURL();
        return img;
    }

    public render(world: WorldState) {
        const { grid, agents, enemies } = world;
        this.canvas.width = grid[0].length * CELL_SIZE;
        this.canvas.height = grid.length * CELL_SIZE;

        this.ctx.fillStyle = COLORS.GRASS;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.renderGrid(grid);
        this.renderEntities(agents, "👤");
        this.renderEntities(enemies, "👹");
    }

    private renderGrid(grid: TileType[][]) {
        for (let y = 0; y < grid.length; y++) {
            for (let x = 0; x < grid[y].length; x++) {
                const tile = grid[y][x];
                const img = this.tileImages.get(tile);
                if (img) {
                    this.ctx.drawImage(
                        img,
                        x * CELL_SIZE,
                        y * CELL_SIZE,
                        CELL_SIZE,
                        CELL_SIZE
                    );
                }
            }
        }
    }

    private renderEntities(
        entities: { position: Position; emoji: string }[],
        defaultEmoji: string
    ) {
        entities.forEach((entity) => {
            const { x, y } = entity.position;
            this.ctx.font = `${CELL_SIZE}px Arial`;
            this.ctx.textAlign = "center";
            this.ctx.textBaseline = "middle";
            this.ctx.fillText(
                entity.emoji || defaultEmoji,
                (x + 0.5) * CELL_SIZE,
                (y + 0.5) * CELL_SIZE
            );
        });
    }
}

export function initializeCanvasRenderer(canvas: HTMLCanvasElement): Renderer {
    return new Renderer(canvas);
}

export function visualizeWorldInfoViaCanvas(world: WorldState): string {
    const maxNameLength = Math.max(
        ...world.agents.map((agent) => agent.name.length)
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
                `🌰: ${agent.inventory.seeds.toString().padStart(3)}`
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

    return `${agentInfo}\n\n${enemyInfo}\n${timeInfo}`;
}
