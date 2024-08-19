import { ServerWebSocket } from "bun";

import { runSimulation } from "./simulation";
import { serializeState } from "./persistence";

const clients = new Set<ServerWebSocket>();

const handleNewConnection = (ws: ServerWebSocket) => {
    clients.add(ws);
    console.log("New client connected");
};

const server = Bun.serve({
    port: 5000,
    fetch(req, server) {
        // Upgrade the request to a WebSocket connection
        if (server.upgrade(req)) {
            return; // Do not return a Response
        }
        return new Response("Upgrade failed :(", { status: 500 });
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

console.log(`WebSocket server listening on port ${server.port}`);

runSimulation(async (world) => {
    // Broadcast world state to all connected clients
    const update = await serializeState(world);

    clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) client.send(update);
    });
});
