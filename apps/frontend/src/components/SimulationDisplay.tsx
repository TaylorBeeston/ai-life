import React, { useRef, useEffect, useState, useCallback } from "react";
import init, * as brotli from "brotli-dec-wasm/web";
import wasmUrl from "brotli-dec-wasm/web/bg.wasm?url";
import { Renderer, initializeCanvasRenderer } from "@shared/visuals";
import type { WorldState, Message } from "@shared/types";

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

    const isMobile =
        typeof window !== "undefined" ? window.innerWidth < 768 : true; // Tailwind md

    const calculatePan = useCallback(
        (agent: { position: { x: number; y: number } }) => {
            if (canvasRef.current && renderer) {
                const canvas = canvasRef.current;
                const worldDimensions = renderer.getWorldDimensions();
                const cellSize = worldDimensions.width / worldState!.grid[0].length;

                const agentScreenX = agent.position.x * cellSize * zoom;
                const agentScreenY = agent.position.y * cellSize * zoom;

                const centerX = canvas.width / 2;
                const centerY = canvas.height / 2;

                return {
                    x: centerX - agentScreenX,
                    y: centerY - agentScreenY,
                };
            }
            return { x: 0, y: 0 };
        },
        [renderer, worldState, zoom],
    );

    const updateCanvasSize = useCallback(() => {
        if (canvasRef.current) {
            const canvas = canvasRef.current;
            const parent = canvas.parentElement;
            if (parent) {
                const rect = parent.getBoundingClientRect();
                const dpr = window.devicePixelRatio || 1;
                canvas.width = rect.width * dpr;
                canvas.height = rect.height * dpr;
                canvas.style.width = `${rect.width}px`;
                canvas.style.height = `${rect.height}px`;
                if (renderer) {
                    renderer.updateCanvasSize(canvas.width, canvas.height, dpr);
                }
            }
        }
    }, [renderer]);

    useEffect(() => {
        if (canvasRef.current) {
            const newRenderer = initializeCanvasRenderer(canvasRef.current);
            setRenderer(newRenderer);
            updateCanvasSize();

            const resizeObserver = new ResizeObserver(() => {
                updateCanvasSize();
            });
            resizeObserver.observe(canvasRef.current.parentElement!);

            let socket: WebSocket | null = null;
            let reconnectAttempts = 0;
            const maxReconnectAttempts = 5;
            const reconnectDelay = 3000; // 3 seconds

            function connect() {
                if (socket) socket.close();

                socket = new WebSocket(
                    import.meta.env.PUBLIC_BACKEND_URL || "wss://ai-life.fly.dev",
                );

                socket.onopen = () => {
                    console.log("Connected to WebSocket server");
                    reconnectAttempts = 0;
                };

                socket.onmessage = async (event) => {
                    const data = event.data;

                    if (typeof data === "string") {
                        const newWorldState = JSON.parse(data);
                        setWorldState(newWorldState);
                    } else {
                        await init(wasmUrl);
                        const compressedData = await event.data.arrayBuffer();
                        const decompressedData = brotli.decompress(
                            new Uint8Array(compressedData),
                        );
                        const newWorldState = JSON.parse(
                            new TextDecoder().decode(decompressedData),
                        );
                        setWorldState(newWorldState);
                    }
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

            return () => {
                socket?.close();
                resizeObserver.disconnect();
            };
        }
    }, []);

    useEffect(() => {
        if (renderer && worldState) {
            renderer.setZoom(zoom);
            renderer.setPan(pan.x, pan.y);
            renderer.render(worldState);
        }
    }, [renderer, worldState, zoom, following, pan]);

    useEffect(() => {
        if (worldState && following) {
            const followingAgent = worldState.agents.find(
                (agent) => agent.id === following,
            );
            if (followingAgent) {
                const newPan = calculatePan(followingAgent);
                setPan(newPan);
            }
        }
    }, [worldState, following, calculatePan]);

    const handleWheel = (e: React.WheelEvent) => {
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

    const messages = worldState?.messages?.slice(-5) ?? [];

    console.log(worldState);

    return (
        <div className="relative w-full h-full p-1 md:p-4">
            <div className="h-full w-full">
                <canvas
                    className="w-full h-full block"
                    ref={canvasRef}
                    onWheel={handleWheel}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    style={{ cursor: isDragging ? "grabbing" : "grab" }}
                />
            </div>
            {worldState && (
                <>
                    {messages.length > 0 && (
                        <div className="absolute top-0 left-0 m-4 p-2 bg-black bg-opacity-50 rounded">
                            <h3 className="text-white font-bold mb-2">Recent Messages:</h3>
                            <ul className="text-white">
                                {messages.map((msg, index) => (
                                    <li key={index} className="mb-1">
                                        <span className="font-bold">{msg.sender}:</span>{" "}
                                        {msg.content}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    <output className="absolute bottom-0 ml-1 md:ml-4 mb-2 md:mb-8 p-4 backdrop-blur-md bg-opacity-20 bg-white rounded">
                        <header className="text-gray-800">
                            Time: {formatTime(worldState.timeOfDay)}{" "}
                            {worldState.isNight ? "🌙" : ""}
                        </header>

                        <ul className="w-full flex flex-col gap-1">
                            {worldState.agents.map((agent) => (
                                <li className="w-full p-0" key={agent.id}>
                                    <button
                                        className={`flex flex-wrap h-full w-full gap-2 px-1 justify-between items-center rounded border transition-colors hover:bg-gray-200 text-gray-800 ${following === agent.id ? "bg-gray-100" : ""
                                            }`}
                                        type="button"
                                        onClick={() =>
                                            setFollowing(following === agent.id ? null : agent.id)
                                        }
                                    >
                                        <span>
                                            {agent.emoji}
                                            {agent.state === "sleeping" && "💤"}
                                        </span>
                                        <span>
                                            {agent.name}
                                            {agent.model ? `(${agent.model})` : ""}
                                        </span>
                                        <span>💓: {agent.hp}</span>
                                        {(!isMobile || following === agent.id) && (
                                            <>
                                                <span>Hunger: {agent.stats.hunger.toFixed(0)}</span>
                                                <span>Fatigue: {agent.stats.fatigue.toFixed(0)}</span>
                                                <span>Social: {agent.stats.social}</span>
                                                <span>🍞: {agent.inventory.food}</span>
                                                <span>🪵: {agent.inventory.wood}</span>
                                                <span>🌰: {agent.inventory.saplings}</span>
                                            </>
                                        )}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </output>
                </>
            )}
        </div>
    );
};

export default SimulationDisplay;
