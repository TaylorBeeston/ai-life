import { produce } from "immer";
import { WorldState, Agent, TileType, Action, Position } from "./types";
import { createEnemy } from "./enemy";

const createRiver = (
    grid: TileType[][],
    startX: number,
    startY: number,
    length: number,
) => {
    let x = startX;
    let y = startY;

    for (let i = 0; i < length; i++) {
        if (y >= 0 && y < grid.length && x >= 0 && x < grid[0].length) {
            grid[y][x] = TileType.Water;
        }

        // Randomly choose direction, with bias towards continuing in the same direction
        const direction = Math.random();
        if (direction < 0.7) {
            x += 1; // Move right
        } else if (direction < 0.8) {
            x -= 1; // Move left
        } else if (direction < 0.9) {
            y += 1; // Move down
        } else {
            y -= 1; // Move up
        }
    }
};

const createForest = (
    grid: TileType[][],
    centerX: number,
    centerY: number,
    size: number,
) => {
    for (let i = 0; i < size; i++) {
        const angle = Math.random() * 2 * Math.PI;
        const distance = (Math.random() * size) / 2;
        const x = Math.floor(centerX + Math.cos(angle) * distance);
        const y = Math.floor(centerY + Math.sin(angle) * distance);

        if (
            y >= 0 &&
            y < grid.length &&
            x >= 0 &&
            x < grid[0].length &&
            grid[y][x] === TileType.Grass
        ) {
            grid[y][x] = TileType.Tree;
        }
    }
};

export const createWorld = (width: number, height: number): WorldState => {
    const grid = Array(height)
        .fill(null)
        .map(() => Array(width).fill(TileType.Grass));

    // Create rivers
    const numRivers = Math.floor(Math.random() * 3) + 1; // 1 to 3 rivers
    for (let i = 0; i < numRivers; i++) {
        const startX = Math.floor(Math.random() * width);
        const startY = Math.floor(Math.random() * height);

        // Bias towards longer rivers
        const minLength = Math.min(width, height);
        const maxLength = width + height;
        const lengthBias = 0.7; // Adjust this value between 0 and 1 to control the bias (higher = longer rivers)

        const length = Math.floor(
            minLength +
            (maxLength - minLength) * Math.pow(Math.random(), 1 - lengthBias),
        );

        createRiver(grid, startX, startY, length);
    }

    // Create forests
    const numForests = Math.floor(Math.random() * 5) + 5; // 5 to 9 forests
    for (let i = 0; i < numForests; i++) {
        const centerX = Math.floor(Math.random() * width);
        const centerY = Math.floor(Math.random() * height);
        const size = Math.floor(Math.random() * 50) + 20; // 20 to 69 trees per forest
        createForest(grid, centerX, centerY, size);
    }

    return {
        grid,
        agents: [],
        enemies: [],
        seedGrowthTimers: {},
        buildingProjects: [],
        isNight: false,
        timeOfDay: 12 * 60, // Start at noon (720 minutes)
    };
};

export const addAgentToWorld = (
    world: WorldState,
    agent: Agent,
): WorldState => {
    return produce(world, (draft) => {
        // Find a suitable location for the house
        const housePosition = findSafePosition(draft);
        draft.grid[housePosition.y][housePosition.x] = TileType.House;

        // Find an adjacent position for the agent
        const directions = [
            { dx: -1, dy: 0 },
            { dx: 1, dy: 0 },
            { dx: 0, dy: -1 },
            { dx: 0, dy: 1 },
        ];

        for (const { dx, dy } of directions) {
            const newX = housePosition.x + dx;
            const newY = housePosition.y + dy;

            if (
                newX >= 0 &&
                newX < draft.grid[0].length &&
                newY >= 0 &&
                newY < draft.grid.length &&
                draft.grid[newY][newX] === TileType.Grass
            ) {
                agent.position = { x: newX, y: newY };
                break;
            }
        }

        // If no adjacent position was found, use the original findSafePosition for the agent
        if (!agent.position) {
            agent.position = findSafePosition(draft);
        }

        draft.agents.push(agent);
    });
};

export const updateWorld = (
    world: WorldState,
    _agent: Agent,
    action: Action,
): WorldState => {
    const agent = structuredClone(_agent);

    return produce(world, (draft) => {
        const agentIndex = draft.agents.findIndex((a) => a.id === agent.id);

        if (agentIndex > -1) {
            if (action.type === "Move") {
                const newX = agent.position.x + action.position.x;
                const newY = agent.position.y + action.position.y;

                // Check if the new position is within bounds and passable
                if (
                    newX >= 0 &&
                    newX < draft.grid[0].length &&
                    newY >= 0 &&
                    newY < draft.grid.length &&
                    !draft.agents.find(
                        (agent) => agent.position.x === newX && agent.position.y === newY,
                    ) &&
                    draft.grid[newY][newX] !== TileType.Wall &&
                    draft.grid[newY][newX] !== TileType.LockedDoor &&
                    draft.grid[newY][newX] !== TileType.Tree &&
                    draft.grid[newY][newX] !== TileType.Water
                ) {
                    agent.position.x = newX;
                    agent.position.y = newY;
                    agent.stats.fatigue += 1;
                    agent.stats.hunger += agent.stats.fatigue * 0.01;

                    if (draft.seedGrowthTimers[`${newX},${newY}`]) {
                        delete draft.seedGrowthTimers[`${newX},${newY}`];
                    }
                } else {
                    agent.stats.fatigue -= 1;
                }

                agent.stats.hunger += 0.1;
                // Check for nearby agents and increase social stat
                const nearbyAgents = draft.agents.filter(
                    (otherAgent) =>
                        otherAgent.id !== agent.id &&
                        Math.abs(otherAgent.position.x - agent.position.x) <= 5 &&
                        Math.abs(otherAgent.position.y - agent.position.y) <= 5,
                );

                if (nearbyAgents.length > 0) {
                    agent.stats.social = Math.min(agent.stats.social + 5, 100);
                    nearbyAgents.forEach((nearbyAgent) => {
                        nearbyAgent.stats.social = Math.min(
                            nearbyAgent.stats.social + 5,
                            100,
                        );
                    });
                } else {
                    // Decrease social stat slightly when alone
                    agent.stats.social = Math.max(agent.stats.social - 1, 0);
                }
            } else if (action.type === "Interact") {
                const { x, y } = action.position;

                const target = draft.grid[y][x];

                if (target === TileType.Door) {
                    draft.grid[y][x] = TileType.LockedDoor;
                } else if (target === TileType.LockedDoor) {
                    draft.grid[y][x] = TileType.Door;
                } else if (target === TileType.Tree) {
                    draft.grid[y][x] = TileType.Grass;
                    agent.inventory.wood += 5;
                    agent.inventory.seeds += Math.round(Math.random() * 3);
                    agent.inventory.food += Math.round(Math.random());
                    agent.stats.fatigue += 5;
                    agent.stats.hunger += agent.stats.fatigue * 0.01;
                } else if (target === TileType.Water) {
                    draft.grid[y][x] = TileType.Bridge;
                    agent.inventory.wood -= 3;
                    agent.stats.fatigue += 3;
                    agent.stats.hunger += agent.stats.fatigue * 0.01;
                }

                agent.stats.hunger += 0.1;
            } else if (action.type === "Use") {
                const { x, y } = action.position;

                agent.stats.hunger += 0.1;

                if (action.item === "seeds" && draft.grid[y][x] === TileType.Grass) {
                    agent.inventory.seeds -= 1;

                    const seedId = `${x},${y}`;

                    draft.seedGrowthTimers[seedId] = 100;
                } else if (action.item === "food") {
                    const target = draft.agents.find(
                        (a) => a.position.x === x && a.position.y === y,
                    );

                    if (x === agent.position.x && y === agent.position.y) {
                        agent.stats.hunger -= 40;
                    } else if (target) {
                        target.stats.hunger -= 40;
                        agent.stats.social = 100;
                        target.stats.social = 100;
                    }

                    agent.inventory.food -= 1;
                }
            } else if (action.type === "Sleep") {
                if (agent.stats.fatigue > 0) {
                    if (agent.state === "awake") agent.state = "sleeping";
                    agent.stats.fatigue -= 2;
                } else {
                    agent.state = "awake";
                }

                agent.stats.hunger += 0.1;
            } else if (action.type === "Talk") {
                const { volume } = action;
                const listeningAgents = draft.agents.filter(
                    (otherAgent) =>
                        otherAgent.id !== agent.id &&
                        otherAgent.state === "awake" &&
                        Math.abs(otherAgent.position.x - agent.position.x) <= volume &&
                        Math.abs(otherAgent.position.y - agent.position.y) <= volume,
                );

                listeningAgents.forEach((listeningAgent) => {
                    listeningAgent.stats.social = Math.min(
                        listeningAgent.stats.social + 10,
                        100,
                    );
                });

                agent.stats.social = Math.min(agent.stats.social + 10, 100);
                agent.stats.fatigue += 1;
                agent.stats.hunger += 0.5;
            } else if (action.type === "Build") {
                const { structure, position } = action;
                if (agent.inventory.wood >= 5) {
                    agent.inventory.wood -= 5;
                    draft.buildingProjects.push({
                        type: structure,
                        progress: 0,
                        position,
                    });
                }
            } else if (action.type === "Attack") {
                const { x, y } = action.position;

                const target =
                    draft.enemies.find(
                        (enemy) => enemy.position.x === x && enemy.position.y === y,
                    ) ||
                    draft.agents.find((a) => a.position.x === x && a.position.y === y);

                if (x === agent.position.x && y === agent.position.y) {
                    agent.hp -= 20;
                } else if (target) {
                    target.hp -= 20;
                }

                agent.stats.fatigue += 10;
            }

            // HP update logic
            if (agent.stats.hunger >= 100) {
                agent.hp -= 5;
            } else if (
                agent.stats.hunger < 20 &&
                agent.stats.social > 80 &&
                agent.stats.fatigue < 20
            ) {
                agent.hp = Math.min(agent.hp + 5, 100);
            }

            // Clamp stats
            agent.stats.hunger = Math.max(Math.min(agent.stats.hunger, 100), 0);
            agent.stats.fatigue = Math.max(Math.min(agent.stats.fatigue, 100), 0);
            agent.stats.social = Math.max(Math.min(agent.stats.social, 100), 0);
            agent.hp = Math.max(Math.min(agent.hp, 100), 0);

            draft.agents[agentIndex] = agent;
        }

        // Update building projects
        draft.buildingProjects = draft.buildingProjects.filter((project) => {
            project.progress += 10;
            if (project.progress >= 100) {
                draft.grid[project.position.y][project.position.x] = project.type;
                return false;
            }
            return true;
        });

        // Update time of day and handle day/night cycle
        draft.timeOfDay = (draft.timeOfDay + 1) % 1440; // 1440 minutes in a day
        draft.isNight = draft.timeOfDay >= 20 * 60 || draft.timeOfDay < 6 * 60;

        // Spawn or remove enemies based on time of day
        if (draft.isNight && draft.enemies.length < draft.agents.length * 2) {
            if (draft.timeOfDay % 60 === 0) {
                // Every hour at night
                const newEnemy = createEnemy(findSafePosition(draft));
                draft.enemies.push(newEnemy);
            }
        } else if (!draft.isNight) {
            draft.enemies = [];
        }

        // Kill enemies with HP = 0
        draft.enemies = draft.enemies.filter((enemy) => enemy.hp > 0);

        // Enemy actions
        draft.enemies.forEach((enemy) => {
            const nearbyAgent = draft.agents.find(
                (agent) =>
                    Math.abs(agent.position.x - enemy.position.x) <= 1 &&
                    Math.abs(agent.position.y - enemy.position.y) <= 1,
            );

            if (nearbyAgent) {
                nearbyAgent.hp -= 15;
            } else {
                // Move randomly
                const direction = Math.floor(Math.random() * 4);
                const moves = [
                    { x: -1, y: 0 },
                    { x: 1, y: 0 },
                    { x: 0, y: -1 },
                    { x: 0, y: 1 },
                ];
                const newPos = {
                    x: enemy.position.x + moves[direction].x,
                    y: enemy.position.y + moves[direction].y,
                };

                if (
                    newPos.x >= 0 &&
                    newPos.x < draft.grid[0].length &&
                    newPos.y >= 0 &&
                    newPos.y < draft.grid.length &&
                    draft.grid[newPos.y][newPos.x] !== TileType.Water &&
                    draft.grid[newPos.y][newPos.x] !== TileType.Tree
                ) {
                    enemy.position = newPos;
                }
            }
        });

        // Update seed growth timers
        Object.entries(draft.seedGrowthTimers).forEach(([seedId, timer]) => {
            if (timer > 0) {
                draft.seedGrowthTimers[seedId] = timer - 1;
            } else {
                const [x, y] = seedId.split(",").map(Number);
                draft.grid[y][x] = TileType.Tree;
                delete draft.seedGrowthTimers[seedId];
            }
        });
    });
};

export const findSafePosition = (world: WorldState): Position => {
    const { grid } = world;
    const directions = [
        { dx: -1, dy: 0 },
        { dx: 1, dy: 0 },
        { dx: 0, dy: -1 },
        { dx: 0, dy: 1 },
    ];

    while (true) {
        const x = Math.floor(Math.random() * grid[0].length);
        const y = Math.floor(Math.random() * grid.length);

        if (grid[y][x] === TileType.Grass) {
            // Check if there's at least one adjacent grass tile
            const hasAdjacentGrass = directions.some(({ dx, dy }) => {
                const newX = x + dx;
                const newY = y + dy;
                return (
                    newX >= 0 &&
                    newX < grid[0].length &&
                    newY >= 0 &&
                    newY < grid.length &&
                    grid[newY][newX] === TileType.Grass
                );
            });

            if (hasAdjacentGrass) {
                return { x, y };
            }
        }
    }
};
