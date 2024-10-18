import { ServerWebSocket } from "bun";
import { runSimulation } from "./simulation";

import {
    getAllRuns,
    getWorldStates,
    getAgentDetails,
    getCurrentRun,
} from "./db/operations";
import { serializeState } from "./persistence";

const clients = new Set<ServerWebSocket>();
const SENTINEL = Buffer.from([0xff, 0xfe, 0xff, 0xfe]); // Unique sentinel sequence

const handleNewConnection = (ws: ServerWebSocket) => {
    clients.add(ws);
    console.log("New client connected");
};

const getHistoricalData = async () => {
    const currentRun = await getCurrentRun();

    if (!currentRun) return null;

    const worldStates = await getWorldStates(currentRun.id);

    console.log("got worldStates!", worldStates.length);

    const compressedWorldStates = await Promise.all(
        worldStates.map(serializeState),
    );

    console.log("compressed worldStates!", compressedWorldStates.length);

    return Buffer.concat(
        compressedWorldStates.flatMap((worldState) => [worldState, SENTINEL]),
    );
};

const corsHeaders = {
    "Access-Control-Allow-Origin": "*", // Replace with your frontend origin in production
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
};

const server = Bun.serve({
    port: 5000,
    idleTimeout: 120,
    async fetch(req, server) {
        const url = new URL(req.url);

        // Handle CORS preflight requests
        if (req.method === "OPTIONS") {
            return new Response(null, { headers: corsHeaders });
        }

        if (url.pathname === "/api/history") {
            const historicalData = await getHistoricalData();

            console.log("Got historicalData!", !!historicalData);

            if (historicalData) {
                return new Response(historicalData, {
                    headers: {
                        "Content-Type": "application/octet-stream",
                        ...corsHeaders,
                    },
                });
            } else {
                return new Response("Error fetching historical data", {
                    status: 500,
                    headers: corsHeaders,
                });
            }
        }

        if (url.pathname === "/api/runs") {
            const runs = await getAllRuns();
            return new Response(JSON.stringify(runs), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        } else if (url.pathname.startsWith("/api/worldStates/")) {
            const runId = url.pathname.split("/").pop();
            if (runId) {
                const worldStates = await getWorldStates(runId);
                return new Response(JSON.stringify(worldStates), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
            }
        } else if (url.pathname.startsWith("/api/agentDetails/")) {
            const [runId, agentId] = url.pathname.split("/").slice(-2);
            if (runId && agentId) {
                const agentDetails = await getAgentDetails(agentId, runId);
                return new Response(JSON.stringify(agentDetails), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
            }
        } else {
            // For all other routes, attempt to upgrade to WebSocket
            if (server.upgrade(req)) {
                return; // Upgraded to WebSocket, no Response needed
            }
            return new Response("Upgrade to WebSocket failed", {
                status: 500,
                headers: corsHeaders,
            });
        }
    },
    websocket: {
        open: handleNewConnection,
        message(ws, message) {
            // Handle any incoming messages from clients if needed
        },
        close(ws) {
            clients.delete(ws);
            console.log("Client disconnected");
        },
    },
});

console.log(`Server listening on port ${server.port}`);

runSimulation(async (world) => {
    const update = await serializeState(world);

    // Broadcast world state to all connected clients
    clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) client.send(update);
    });
});
