import { visualizeWorld } from "./visualization";
const socket = new WebSocket("ws://localhost:3000");

socket.onmessage = (event) => {
    const worldState = JSON.parse(event.data);

    console.clear();
    console.log(visualizeWorld(worldState));
};
