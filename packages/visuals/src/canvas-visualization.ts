import type { WorldState, TileType, Position } from "@shared/types";

const CELL_SIZE = 20; // Base size of each grid cell in pixels

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
    private zoom: number = 1;
    private panOffset: Position = { x: 0, y: 0 };
    private worldWidth: number = 0;
    private worldHeight: number = 0;
    private dpr: number = 1;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d", { alpha: false })!;
        this.initTileImages();
        this.updateCanvasSize(
            canvas.width,
            canvas.height,
            window.devicePixelRatio || 1
        );
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
        tempCanvas.width = CELL_SIZE * 2; // Double the size for higher resolution
        tempCanvas.height = CELL_SIZE * 2;
        const tempCtx = tempCanvas.getContext("2d")!;
        tempCtx.font = `${CELL_SIZE * 2}px Arial`;
        tempCtx.textAlign = "center";
        tempCtx.textBaseline = "middle";
        tempCtx.fillText(emoji, CELL_SIZE, CELL_SIZE);

        const img = new Image();
        img.src = tempCanvas.toDataURL();
        return img;
    }

    public updateCanvasSize(width: number, height: number, dpr: number) {
        this.canvas.width = width;
        this.canvas.height = height;
        this.dpr = dpr;
        this.ctx.scale(dpr, dpr);
    }

    public setZoom(zoom: number) {
        this.zoom = Math.max(0.1, Math.min(5, zoom));
    }

    public setPan(x: number, y: number) {
        this.panOffset = { x, y };
    }

    public render(world: WorldState) {
        const { grid, agents, enemies } = world;
        this.worldWidth = grid[0].length * CELL_SIZE;
        this.worldHeight = grid.length * CELL_SIZE;

        this.ctx.save();
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = COLORS.GRASS;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.translate(this.panOffset.x, this.panOffset.y);
        this.ctx.scale(this.zoom, this.zoom);

        this.renderGrid(grid);
        this.renderEntities(agents, "👤");
        this.renderEntities(enemies, "👹");

        this.ctx.restore();
    }

    private renderGrid(grid: TileType[][]) {
        const startX = Math.max(
            0,
            Math.floor(-this.panOffset.x / (CELL_SIZE * this.zoom))
        );
        const startY = Math.max(
            0,
            Math.floor(-this.panOffset.y / (CELL_SIZE * this.zoom))
        );
        const endX = Math.min(
            grid[0].length,
            startX + Math.ceil(this.canvas.width / (CELL_SIZE * this.zoom)) + 1
        );
        const endY = Math.min(
            grid.length,
            startY + Math.ceil(this.canvas.height / (CELL_SIZE * this.zoom)) + 1
        );

        for (let y = startY; y < endY; y++) {
            for (let x = startX; x < endX; x++) {
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

    public getWorldDimensions(): { width: number; height: number } {
        return { width: this.worldWidth, height: this.worldHeight };
    }
}

export function initializeCanvasRenderer(canvas: HTMLCanvasElement): Renderer {
    return new Renderer(canvas);
}
