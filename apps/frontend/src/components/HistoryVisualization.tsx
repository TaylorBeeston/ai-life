import React, { useRef, useEffect, useState, useCallback } from "react";
import { Renderer, initializeCanvasRenderer } from "@shared/visuals";
import type { WorldState } from "@shared/types";
import init, * as brotli from "brotli-dec-wasm/web";
import wasmUrl from "brotli-dec-wasm/web/bg.wasm?url";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Play, Pause } from "lucide-react";

const SENTINEL = new Uint8Array([0xff, 0xfe, 0xff, 0xfe]);
const PLAYBACK_SPEED = 100; // milliseconds between frames when playing

const HistoryVisualization: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [renderer, setRenderer] = useState<Renderer | null>(null);
    const [worldStates, setWorldStates] = useState<WorldState[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const playIntervalRef = useRef<Timer | null>(null);
    const [following, setFollowing] = useState<string | null>(null);

    const isMobile =
        typeof window !== "undefined" ? window.innerWidth < 768 : true; // Tailwind md

    useEffect(() => {
        let socket: WebSocket | null = null;

        const fetchHistoricalData = async () => {
            try {
                await init(wasmUrl);
                const response = await fetch(
                    `${import.meta.env.PUBLIC_API_URL}/history`,
                );
                if (!response.ok) {
                    throw new Error("Failed to fetch historical data");
                }

                const buffer = await response.arrayBuffer();
                const data = new Uint8Array(buffer);
                const decoder = new TextDecoder();

                let start = 0;
                const states: WorldState[] = [];

                while (start < data.length) {
                    const end = findSentinel(data.subarray(start));
                    if (end === -1) break;

                    const chunk = data.slice(start, start + end);
                    const decompressedData = brotli.decompress(chunk);
                    const jsonString = decoder.decode(decompressedData);
                    const worldState = JSON.parse(jsonString);
                    states.push(worldState);

                    start += end + SENTINEL.length;
                }

                setWorldStates(states);
                setIsLoading(false);

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
                            setWorldStates((oldStates) => [...oldStates, newWorldState]);
                        } else {
                            await init(wasmUrl);
                            const compressedData = await event.data.arrayBuffer();
                            const decompressedData = brotli.decompress(
                                new Uint8Array(compressedData),
                            );
                            const newWorldState = JSON.parse(
                                new TextDecoder().decode(decompressedData),
                            );
                            setWorldStates((oldStates) => [...oldStates, newWorldState]);
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
            } catch (error) {
                console.error("Error fetching historical data:", error);
                setError("Failed to fetch or process historical data");
                setIsLoading(false);
            }
        };

        fetchHistoricalData();

        return () => {
            socket?.close();
        };
    }, []);

    const findSentinel = (buffer: Uint8Array) => {
        for (let i = 0; i <= buffer.length - SENTINEL.length; i++) {
            if (
                buffer
                    .slice(i, i + SENTINEL.length)
                    .every((byte, index) => byte === SENTINEL[index])
            ) {
                return i;
            }
        }
        return -1;
    };

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

    const calculatePan = useCallback(
        (agent: { position: { x: number; y: number } }) => {
            if (canvasRef.current && renderer) {
                const canvas = canvasRef.current;
                const worldDimensions = renderer.getWorldDimensions();
                const cellSize =
                    worldDimensions.width / worldStates[currentIndex]!.grid[0].length;

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
        [renderer, worldStates[currentIndex], zoom],
    );

    useEffect(() => {
        if (canvasRef.current) {
            const newRenderer = initializeCanvasRenderer(canvasRef.current);
            setRenderer(newRenderer);
            updateCanvasSize();

            const resizeObserver = new ResizeObserver(() => {
                updateCanvasSize();
            });
            resizeObserver.observe(canvasRef.current.parentElement!);

            return () => {
                resizeObserver.disconnect();
            };
        }
    }, [canvasRef.current, isLoading]);

    useEffect(() => {
        if (renderer && worldStates.length > 0) {
            renderer.setZoom(zoom);
            renderer.setPan(pan.x, pan.y);
            renderer.render(worldStates[currentIndex]);
        }
    }, [renderer, worldStates, currentIndex, zoom, pan, calculatePan]);

    useEffect(() => {
        if (worldStates[currentIndex] && following) {
            const followingAgent = worldStates[currentIndex].agents.find(
                (agent) => agent.id === following,
            );
            if (followingAgent) {
                const newPan = calculatePan(followingAgent);
                setPan(newPan);
            }
        }
    }, [worldStates, currentIndex, calculatePan, following]);

    useEffect(() => {
        if (isPlaying) {
            playIntervalRef.current = setInterval(() => {
                setCurrentIndex((prevIndex) => {
                    if (prevIndex === worldStates.length - 1) {
                        setIsPlaying(false);
                        return prevIndex;
                    }
                    return prevIndex + 1;
                });
            }, PLAYBACK_SPEED);
        } else {
            if (playIntervalRef.current) {
                clearInterval(playIntervalRef.current);
            }
        }

        return () => {
            if (playIntervalRef.current) {
                clearInterval(playIntervalRef.current);
            }
        };
    }, [isPlaying, worldStates.length]);

    const handleSliderChange = (newValue: number[]) => {
        setCurrentIndex(newValue[0]);
    };

    const togglePlayPause = () => {
        if (!isPlaying && currentIndex === worldStates.length - 1) {
            setCurrentIndex(0);
        }

        setIsPlaying(!isPlaying);
    };

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

    const formatTime = (minutes: number): string => {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
    };

    if (isLoading) return <div>Loading...</div>;
    if (error) return <div>An error occurred: {error}</div>;

    const worldState = worldStates[currentIndex];

    const messages = worldState?.messages?.slice(-5) ?? [];

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
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gray-800 bg-opacity-80">
                <div className="flex justify-between items-center mb-2">
                    <Button onClick={togglePlayPause}>
                        {isPlaying ? (
                            <Pause className="h-4 w-4" />
                        ) : (
                            <Play className="h-4 w-4" />
                        )}
                    </Button>
                    <div className="text-white">
                        {worldState && (
                            <>
                                Time: {formatTime(worldState.timeOfDay)}{" "}
                                {worldState.isNight ? "🌙" : "☀️"}
                            </>
                        )}
                    </div>
                </div>
                <Slider
                    value={[currentIndex]}
                    min={0}
                    max={worldStates.length - 1}
                    step={1}
                    onValueChange={handleSliderChange}
                />
            </div>
        </div>
    );
};

export default HistoryVisualization;
