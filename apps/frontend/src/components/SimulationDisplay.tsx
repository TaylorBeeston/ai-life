import React, { useRef, useEffect, useState } from "react";
import { Renderer, initializeCanvasRenderer } from "@shared/visuals";
import type { WorldState } from "@shared/types";

const formatTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, "0")}:${mins
        .toString()
        .padStart(2, "0")}`;
};

const SimulationDisplay: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [renderer, setRenderer] = useState<Renderer | null>(null);
    const [worldState, setWorldState] = useState<WorldState | null>(null);
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
    const [following, setFollowing] = useState<string | null>(null);

    useEffect(() => {
        if (canvasRef.current) {
            const newRenderer = initializeCanvasRenderer(canvasRef.current);
            setRenderer(newRenderer);

            let socket: WebSocket | null = null;
            let reconnectAttempts = 0;
            const maxReconnectAttempts = 5;
            const reconnectDelay = 3000; // 3 seconds

            function connect() {
                if (socket) socket.close();

                socket = new WebSocket(
                    import.meta.env.PUBLIC_BACKEND_URL || "wss://ai-life.fly.dev"
                );

                socket.onopen = () => {
                    console.log("Connected to WebSocket server");
                    reconnectAttempts = 0;
                };

                socket.onmessage = (event) => {
                    const newWorldState = JSON.parse(event.data);
                    setWorldState(newWorldState);
                };

                socket.onerror = (error) => {
                    console.error("WebSocket error:", error);
                };

                socket.onclose = (event) => {
                    console.log("Disconnected from WebSocket server");

                    if (reconnectAttempts < maxReconnectAttempts) {
                        setTimeout(() => {
                            reconnectAttempts++;
                            connect();
                        }, reconnectDelay);
                    }
                };
            }

            connect();

            return () => socket?.close();
        }
    }, []);

    useEffect(() => {
        if (renderer && worldState) {
            renderer.setZoom(zoom);
            const followingPosition =
                worldState.agents.find((agent) => agent.id === following)?.position ??
                pan;
            renderer.setPan(followingPosition.x, followingPosition.y);
            renderer.render(worldState);
        }
    }, [renderer, worldState, zoom, pan]);

    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        const newZoom = zoom * (1 - e.deltaY * 0.001);
        setZoom(Math.max(0.1, Math.min(5, newZoom)));
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        setLastMousePos({ x: e.clientX, y: e.clientY });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isDragging) {
            setFollowing(null);
            const dx = e.clientX - lastMousePos.x;
            const dy = e.clientY - lastMousePos.y;
            setPan({ x: pan.x + dx, y: pan.y + dy });
            setLastMousePos({ x: e.clientX, y: e.clientY });
        }
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    return (
        <div className="w-full h-full">
            <canvas
                className="w-full"
                ref={canvasRef}
                width={800}
                height={600}
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                style={{ cursor: isDragging ? "grabbing" : "grab" }}
            />
            {worldState && (
                <div>
                    <h2>Simulation Info</h2>
                    <output>
                        Time: {formatTime(worldState.timeOfDay)}{" "}
                        {worldState.isNight ? "🌙" : ""}
                    </output>
                    <ul className="w-full flex flex-col gap-1">
                        {worldState.agents.map((agent) => (
                            <li className="w-full p-0" key={agent.id}>
                                <button
                                    className="flex h-full w-full gap-2 px-1 justify-between items-center rounded border transition-colors hover:bg-gray-900"
                                    type="button"
                                    onClick={() => setFollowing(agent.id)}
                                >
                                    <span>
                                        {agent.emoji}
                                        {agent.state === "sleeping" && "💤"}
                                    </span>

                                    <span>{agent.name}</span>

                                    <span>
                                        Pos({agent.position.x},{agent.position.y})
                                    </span>

                                    <span>💓: {agent.hp}</span>

                                    <span>Hunger: {agent.stats.hunger.toFixed(0)}</span>
                                    <span>Fatigue: {agent.stats.fatigue}</span>
                                    <span>Social: {agent.stats.social}</span>

                                    <span>🍞: {agent.inventory.food}</span>
                                    <span>🪵: {agent.inventory.wood}</span>
                                    <span>🌰: {agent.inventory.seeds}</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default SimulationDisplay;
