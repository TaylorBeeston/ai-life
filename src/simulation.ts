import * as path from "path";
import * as fs from "fs";
import { WorldState, Agent, Action } from "./types";
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
    findSafePosition,
} from "./world";
import { visualizeWorld } from "./visualization";
import { logState, loadMostRecentState } from "./persistence";
import { produce } from "immer";

export const agentLoop = (agent: Agent, world: WorldState): Action => {
    const perception = perceive(agent, world);
    const emotionalOutputs = processEmotions(perception, agent.stats);
    const streamOfConsciousness = cognitiveProcess(
        perception,
        agent.stats,
        emotionalOutputs,
    );

    return executeAction(agent, world, streamOfConsciousness);
};

// Simulation step
export const simulationStep = (world: WorldState): WorldState => {
    const newWorld = world.agents.reduce((updatedWorld, agent) => {
        const action = agentLoop(agent, updatedWorld);
        const worldAfterAction = updateWorld(updatedWorld, agent, action);

        return worldAfterAction;
    }, world);

    // Remove agents with 0 HP
    return produce(newWorld, (draft) => {
        draft.agents = draft.agents.filter((agent) => agent.hp > 0);
    });
};

// Main simulation loop
export const runSimulation = async (
    updater?: (world: WorldState) => void | Promise<void>,
) => {
    const logDir = path.join(__dirname, "logs");
    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir);
    }

    let world = (await loadMostRecentState(logDir)) || createWorld(75, 60);
    if (world.agents.length === 0) {
        for (let i = 0; i < 3; i += 1) {
            const newAgent = createAgent({ x: 0, y: 0 }); // Position will be set in addAgentToWorld
            world = addAgentToWorld(world, newAgent);
        }
    }

    let stepCount = 0;
    const simulationInterval = setInterval(() => {
        world = simulationStep(world);
        stepCount++;

        updater?.(world);

        if (stepCount % 100 === 0) {
            // Log every 100 steps
            // const logFile = path.join(logDir, `world_state_${Date.now()}.json`);
            // logState(world, logFile);
            // console.log(`Logged state to ${logFile}`);
        }

        if (stepCount % 100 === 0 && Math.random() > 0.8) {
            const newAgent = createAgent({ x: 0, y: 0 }); // Position will be set in addAgentToWorld
            world = addAgentToWorld(world, newAgent);
        }
    }, 100);

    // To stop the simulation:
    // clearInterval(simulationInterval);
};
