import { visualizeWorldAsText } from "@shared/visuals";
const socket = new WebSocket("wss://ai-life.fly.dev");

socket.onmessage = (event) => {
    const worldState = JSON.parse(event.data);

    console.clear();
    console.log(visualizeWorldAsText(worldState, "cli"));
};
