export type Item = "wood" | "saplings" | "food";
export type Position = { x: number; y: number };
export type Stats = {
    hunger: number;
    social: number;
    fatigue: number;
    [key: string]: number;
};
export type Inventory = {
    [key in Item]: number;
} & {
    [key: string]: number;
};

export enum TileType {
    Grass,
    Tree,
    Water,
    House,
    Wall,
    Door,
    LockedDoor,
    Bridge,
}

export type Tile = {
    position: Position;
    type: TileType;
};

export type BuildingProject = {
    type: TileType;
    progress: number;
    position: Position;
};

export type WorldState = {
    grid: TileType[][];
    agents: Agent[];
    enemies: Enemy[];
    seedGrowthTimers: Record<string, number>;
    buildingProjects: BuildingProject[];
    isNight: boolean;
    timeOfDay: number; // 0-1439 (minutes in a day)
};

export type Message = {
    sender: string;
    content: string;
    timestamp: Date;
    volume: number;
};

export type Agent = {
    id: string;
    name: string;
    position: Position;
    stats: Stats;
    state: "sleeping" | "awake";
    inventory: Inventory;
    emoji: string;
    hp: number;
    model?: "gemini-1.5-flash"; // TODO: Add more models!
    context?: string[];
    perception?: Perception;
    thoughts?: string;
    emotions?: EmotionalOutput[];
    action?: Action;
};

export type Enemy = {
    id: string;
    position: Position;
    hp: number;
    emoji: string;
};

export type Perception = {
    visibleArea: TileType[][];
    nearbyAgents: Agent[];
    nearbyEnemies: Enemy[];
    isNight: boolean;
    messages: { sender: string; content: string; volume: number }[];
};

export type EmotionalOutput = {
    emotion: string;
    intensity: number;
};

export type Action =
    | { type: "Move"; position: Position }
    | { type: "Interact"; position: Position }
    | { type: "Talk"; volume: number; message: string }
    | { type: "Use"; item: Item; position: Position }
    | { type: "Sleep" }
    | { type: "Build"; structure: TileType; position: Position }
    | { type: "Attack"; position: Position };
