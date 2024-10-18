import { WorldState, Agent, Action, Perception } from "@shared/types";
import {
    createAgent,
    perceive,
    processEmotions,
    cognitiveProcess,
    executeAction,
} from "./agent";
import {
    createWorld,
    addAgentToWorld,
    updateWorld,
    updateWorldFromAgentAction,
} from "./world";
import {
    saveWorldState,
    saveAgentDetails,
    createNewRun,
    finishRun,
    getCurrentRun,
    getCurrentWorldStateForRun,
} from "./db/operations";
import { makeSmartAgentDecision } from "./llm";
import { produce } from "immer";

export const agentLoop = async (
    agent: Agent,
    world: WorldState,
    worldStateId: string,
): Promise<{ action: Action; agent: Agent }> => {
    const perception = await perceive(agent, world);
    const emotionalOutputs = processEmotions(perception, agent.stats);

    if (agent.model === "gemini-1.5-flash") {
        if (agent.stats.fatigue === 100 || agent.state === "sleeping") {
            console.log(
                `-------------------------------[ ${agent.name} ]----------------------------------------------------------------`,
            );
            return { action: { type: "Sleep" }, agent };
        }

        const { action, thoughts } = await makeSmartAgentDecision(
            agent,
            world,
            perception,
            emotionalOutputs,
        );

        const newAgent = produce(agent, (draft) => {
            if (draft.state === "awake") {
                draft.context?.push(
                    `Stats before Action: ${JSON.stringify({ hp: draft.hp, inventory: draft.inventory, stats: draft.stats, position: draft.position, state: draft.state })}`,
                );
                draft.context?.push(
                    `Perception before Action: ${JSON.stringify({
                        ...perception,
                        nearbyAgents: perception.nearbyAgents.map((a) => ({
                            name: a.name,
                            id: a.id,
                            position: a.position,
                            hp: a.hp,
                        })),
                        nearbyEnemies: perception.nearbyEnemies.map((enemy) => ({
                            id: enemy.id,
                            position: enemy.position,
                            hp: enemy.hp,
                        })),
                    })}`,
                );
                draft.context?.push(`Thoughts: ${JSON.stringify(thoughts)}`);
                draft.context?.push(`Action: ${JSON.stringify(action)}`);
            } else {
                // Reset context when the agent goes to sleep
                draft.context = [];
            }
        });

        const getActionDisplay = () => {
            if (action.type === "Sleep") return "";
            if (action.type === "Move")
                return `(${action.position.x}, ${action.position.y})`;
            if (action.type === "Interact")
                return `(${action.position.x}, ${action.position.y})`;
            if (action.type === "Use")
                return `${action.item} (${action.position.x}, ${action.position.y})`;
            if (action.type === "Attack")
                return `(${action.position.x}, ${action.position.y})`;
            if (action.type === "Build")
                return `${action.structure} (${action.position.x}, ${action.position.y})`;
            if (action.type === "Talk") return `[${action.volume}] ${action.message}`;
        };

        console.log(
            action.type,
            getActionDisplay(),
            emotionalOutputs.map((e) => `${e.emotion} ${e.intensity}`),
            "Nearby Agents:",
            perception.nearbyAgents.filter((a) => a.model).map((a) => a.name),
            "Nearby Enemies:",
            perception.nearbyEnemies.length,
        );

        await saveAgentDetails(
            { ...newAgent, thoughts, emotions: emotionalOutputs, action },
            worldStateId,
        );

        return { action, agent: newAgent };
    } else {
        const streamOfConsciousness = cognitiveProcess(
            perception,
            agent.stats,
            emotionalOutputs,
        );

        return {
            action: await executeAction(
                agent,
                world,
                streamOfConsciousness,
                perception,
            ),
            agent,
        };
    }
};

// Simulation step
export const simulationStep = async (
    world: WorldState,
    worldStateId: string,
    runId: string,
): Promise<WorldState> => {
    let newWorld = world;

    for await (const agent of world.agents) {
        const { action, agent: newAgent } = await agentLoop(
            agent,
            newWorld,
            worldStateId,
        );

        newWorld = await updateWorldFromAgentAction(
            newWorld,
            newAgent,
            action,
            runId,
        );
    }

    newWorld = updateWorld(newWorld);

    // Remove agents with 0 HP
    return produce(newWorld, (draft) => {
        draft.agents = draft.agents.filter((agent) => agent.hp > 0);
    });
};

// Main simulation loop
export const runSimulation = async (
    updater?: (world: WorldState, runId: string) => void | Promise<void>,
) => {
    // TODO: GET THE WORLD FOR THIS RUN!

    const existingRun = await getCurrentRun();

    let runId = existingRun?.id;

    let world = runId ? await getCurrentWorldStateForRun(runId) : undefined;

    console.log(world);

    if (!world) {
        if (!runId) runId = await createNewRun();
        console.log(runId, "starting");
        world = createWorld(75, 60);

        if (world.agents.length === 0) {
            for (let i = 0; i < 15; i += 1) {
                const newAgent = createAgent(
                    { x: 0, y: 0 },
                    i < 2 ? "gemini-1.5-flash" : undefined,
                );
                world = addAgentToWorld(world, newAgent);
            }
        }
    }

    let stepCount = 0;
    while (true) {
        try {
            const worldStateId = await saveWorldState(world, runId);

            world = await simulationStep(world, worldStateId, runId);
            stepCount++;

            await updater?.(world, runId);

            if (stepCount % 100 === 0 && Math.random() > 0.8) {
                stepCount = 0;
                const newAgent = createAgent({ x: 0, y: 0 }); // Position will be set in addAgentToWorld
                world = addAgentToWorld(world, newAgent);
            }

            if (world.agents.length === 0) {
                console.log(runId, "finished");

                await finishRun(runId);

                runSimulation(updater);

                break;
            }
        } catch (error) {
            console.error("Error!", error);

            await finishRun(runId);

            break;
        }
    }
};
