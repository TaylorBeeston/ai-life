import {
    FunctionDeclaration,
    FunctionDeclarationSchemaType,
} from "@google/generative-ai";
import {
    Agent,
    WorldState,
    Perception,
    EmotionalOutput,
    Action,
    TileType,
    Item,
} from "@shared/types";
import { genAI } from "./ai";
import { getAdjacentActions } from "./agent";

const customStringify = (obj: any, space?: string | number): string => {
    const replacer = (key: string, value: any): any => {
        // Check if the value is a finite number and has a decimal point
        if (
            typeof value === "number" &&
            isFinite(value) &&
            !Number.isInteger(value)
        ) {
            // Convert the float to a fixed-point notation with 2 decimal places
            return Number(value.toFixed(2));
        }
        return value;
    };

    // Use the built-in JSON.stringify with our custom replacer function
    return JSON.stringify(obj, replacer, space);
};

// Function declarations for each action type
const moveFunctionDeclaration: FunctionDeclaration = {
    name: "move",
    description:
        "Move the agent to a new position. Max move distance is 1 (can move diagonally)",
    parameters: {
        type: FunctionDeclarationSchemaType.OBJECT,
        properties: {
            x: {
                type: FunctionDeclarationSchemaType.NUMBER,
                description: "X coordinate to move to (delta) [-1, 0, 1]",
            },
            y: {
                type: FunctionDeclarationSchemaType.NUMBER,
                description: "Y coordinate to move to (delta) [-1, 0, 1]",
            },
        },
        required: ["x", "y"],
    },
};

const interactFunctionDeclaration: FunctionDeclaration = {
    name: "interact",
    description: "Interact with an object at a specific position",
    parameters: {
        type: FunctionDeclarationSchemaType.OBJECT,
        properties: {
            x: {
                type: FunctionDeclarationSchemaType.NUMBER,
                description: "X coordinate of the object",
            },
            y: {
                type: FunctionDeclarationSchemaType.NUMBER,
                description: "Y coordinate of the object",
            },
        },
        required: ["x", "y"],
    },
};

const talkFunctionDeclaration: FunctionDeclaration = {
    name: "talk",
    description: "Make the agent talk",
    parameters: {
        type: FunctionDeclarationSchemaType.OBJECT,
        properties: {
            volume: {
                type: FunctionDeclarationSchemaType.NUMBER,
                description: "Volume of the speech (0-100)",
            },
            message: {
                type: FunctionDeclarationSchemaType.STRING,
                description: "The message to say",
            },
        },
        required: ["volume", "message"],
    },
};

const useFunctionDeclaration: FunctionDeclaration = {
    name: "use",
    description: "Use an item at a specific position",
    parameters: {
        type: FunctionDeclarationSchemaType.OBJECT,
        properties: {
            item: {
                type: FunctionDeclarationSchemaType.STRING,
                enum: ["wood", "saplings", "food"],
                description: "The item to use",
            },
            x: {
                type: FunctionDeclarationSchemaType.NUMBER,
                description: "X coordinate to use the item",
            },
            y: {
                type: FunctionDeclarationSchemaType.NUMBER,
                description: "Y coordinate to use the item",
            },
        },
        required: ["item", "x", "y"],
    },
};

const sleepFunctionDeclaration: FunctionDeclaration = {
    name: "sleep",
    description: "Make the agent sleep",
};

const buildFunctionDeclaration: FunctionDeclaration = {
    name: "build",
    description: "Build a structure at a specific position",
    parameters: {
        type: FunctionDeclarationSchemaType.OBJECT,
        properties: {
            structure: {
                type: FunctionDeclarationSchemaType.STRING,
                enum: ["0", "1", "2", "3", "4", "5", "6", "7"],
                description:
                    "The type of structure to build (corresponds to TileType enum)",
            },
            x: {
                type: FunctionDeclarationSchemaType.NUMBER,
                description: "X coordinate to build at",
            },
            y: {
                type: FunctionDeclarationSchemaType.NUMBER,
                description: "Y coordinate to build at",
            },
        },
        required: ["structure", "x", "y"],
    },
};

const attackFunctionDeclaration: FunctionDeclaration = {
    name: "attack",
    description: "Attack a target at a specific position",
    parameters: {
        type: FunctionDeclarationSchemaType.OBJECT,
        properties: {
            x: {
                type: FunctionDeclarationSchemaType.NUMBER,
                description: "X coordinate of the target",
            },
            y: {
                type: FunctionDeclarationSchemaType.NUMBER,
                description: "Y coordinate of the target",
            },
        },
        required: ["x", "y"],
    },
};

export async function makeSmartAgentDecision(
    agent: Agent,
    world: WorldState,
    perception: Perception,
    emotionalOutputs: EmotionalOutput[],
): Promise<{ action: Action; thoughts: string }> {
    try {
        const adjacentActions = getAdjacentActions(agent, world).filter(
            (action) => action.type !== TileType.Grass,
        );

        // Create a new model instance for stream of consciousness
        const socModel = genAI.getGenerativeModel({
            model: "gemini-1.5-flash",
            generationConfig: {
                temperature: 0.9,
                topK: 1,
                topP: 1,
                maxOutputTokens: 2048,
            },
        });

        // Generate stream of consciousness
        const socPrompt = `
As an AI agent in a simulated world, generate an extremely brief stream of consciousness based on the following information:

TileTypes: ${customStringify(TileType)}
Agent: ${customStringify(agent)}
Perception: ${customStringify(perception)}
Emotions: ${customStringify(emotionalOutputs)}
Adjacent Interactions: ${customStringify(adjacentActions)}
Context: ${customStringify(agent.context)}

Hunger and fatigue go from low to high, meaning low numbers are less hungry than high numbers on a 0-100 scale.
Social is a number between 0 and 100, with 0 meaning you are lonely and 100 meaning you are very well socialized.

You can not enter houses. They are only meant to provide good places to make a home by surrounding them with a fence/door and not some magical place that will save you.

Seek ${world.agents.filter((a) => a.model && a.id !== agent.id).map((a) => a.name)} and learn what to do together. Socialization is going to be key to your goal.

Provide an extremely short, introspective monologue that reflects the agent's current thoughts, feelings, and observations.
If it would otherwise be redundant, it is okay for your entire monologue to just be "...", but please at the very least try and
make/keep a consistent plan/goals
`;

        const socResult = await socModel.generateContent(socPrompt);
        const streamOfConsciousness = socResult.response.text();
        console.log(
            `-------------------------------[ ${agent.name} ]----------------------------------------------------------------`,
        );

        console.log(streamOfConsciousness.trimEnd());

        console.log(socResult.response.usageMetadata);

        console.log(
            "Adjacent Actions:",
            adjacentActions.map(
                (action) => `(${action.position.x}, ${action.position.y})`,
            ),
        );

        await new Promise((res) => setTimeout(res, 5000)); // Wait 5 seconds to defeat rate limits

        // Create a new model instance with function calling configuration
        const actionModel = genAI.getGenerativeModel({
            model: "gemini-1.5-flash",
            generationConfig: {
                temperature: 0.9,
                topK: 1,
                topP: 1,
                maxOutputTokens: 2048,
            },
        });

        const chat = actionModel.startChat({
            history: [],
            generationConfig: {
                temperature: 0.9,
                topK: 1,
                topP: 1,
                maxOutputTokens: 2048,
            },
            tools: [
                {
                    functionDeclarations: [
                        moveFunctionDeclaration,
                        interactFunctionDeclaration,
                        talkFunctionDeclaration,
                        useFunctionDeclaration,
                        sleepFunctionDeclaration,
                        buildFunctionDeclaration,
                        attackFunctionDeclaration,
                    ],
                },
            ],
        });

        // Prepare the context for the LLM
        const actionPrompt = `
Based on the following information and the agent's stream of consciousness, determine the next action for the agent.
Choose the most appropriate action by calling one of the provided functions.

TileTypes: ${customStringify(TileType)}
Agent: ${customStringify(agent)}
Perception: ${customStringify(perception)}
Emotions: ${customStringify(emotionalOutputs)}
Adjacent Interactions: ${customStringify(adjacentActions)}
Stream of Consciousness: ${streamOfConsciousness}
Context: ${customStringify(agent.context)}

Remember:
- Movement should be done in deltas, i.e. use x: 0, y: 1 to move 1 square in the y direction, x: -1, y: 0, to move 1 square in the X direction. Movement has a max distance of 1 tile.
- Interactions can and should be preferred, but _only_ when they are available via Adjacent Interactions. Simply use Interact with the position provided in the adjacent interactions.
- When interacting, please _only_ interact with an object that is contained within the Adjacent Interactions provided to you
- You can not enter houses. They are simply meant to provide good places to make a home by surrounding them with a fence/door.

Choose the most appropriate action based on the agent's current situation, goals, and stream of consciousness.
`;

        const result = await chat.sendMessage(actionPrompt);

        const functionCall = result.response.functionCalls()?.[0];

        console.log(result.response.usageMetadata);

        await new Promise((res) => setTimeout(res, 5000)); // Wait 5 seconds to defeat rate limits

        if (!functionCall) {
            console.log("Weird Response:", result.response.text());
            throw new Error("No function call generated by LLM");
        }

        const action = convertFunctionCallToAction(functionCall);

        // Validate the action
        if (!isValidAction(action)) {
            console.error("Invalid action", action);
            throw new Error("Invalid action generated by LLM");
        }

        return { action, thoughts: streamOfConsciousness };
    } catch (error: any) {
        if (error.message !== "No function call generated by LLM")
            console.error("Some kind of error!", error);

        await new Promise((res) => setTimeout(res, 15000)); // Wait 15 seconds to defeat rate limits
        // Fallback to a default action if LLM fails
        return {
            action: { type: "Move", position: { x: 0, y: 0 } },
            thoughts: "...",
        };
    }
}

function convertFunctionCallToAction(functionCall: any): Action {
    const { name, args } = functionCall;

    switch (name) {
        case "move":
            return { type: "Move", position: { x: args.x, y: args.y } };
        case "interact":
            return { type: "Interact", position: { x: args.x, y: args.y } };
        case "talk":
            return { type: "Talk", volume: args.volume, message: args.message };
        case "use":
            return {
                type: "Use",
                item: args.item as Item,
                position: { x: args.x, y: args.y },
            };
        case "sleep":
            return { type: "Sleep" };
        case "build":
            return {
                type: "Build",
                structure: parseInt(args.structure) as TileType,
                position: { x: args.x, y: args.y },
            };
        case "attack":
            return { type: "Attack", position: { x: args.x, y: args.y } };
        default:
            throw new Error(`Unknown function call: ${name}`);
    }
}

// Helper function to validate the action
function isValidAction(action: any): action is Action {
    switch (action.type) {
        case "Move":
        case "Interact":
        case "Attack":
            return (
                typeof action.position === "object" &&
                typeof action.position.x === "number" &&
                typeof action.position.y === "number"
            );
        case "Talk":
            return (
                typeof action.volume === "number" && typeof action.message === "string"
            );
        case "Use":
            return (
                ["wood", "saplings", "food"].includes(action.item) &&
                typeof action.position === "object" &&
                typeof action.position.x === "number" &&
                typeof action.position.y === "number"
            );
        case "Sleep":
            return true;
        case "Build":
            return (
                typeof action.structure === "number" &&
                action.structure >= 0 &&
                action.structure <= 7 &&
                typeof action.position === "object" &&
                typeof action.position.x === "number" &&
                typeof action.position.y === "number"
            );
        default:
            return false;
    }
}
