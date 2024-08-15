import { TileType } from "@shared/types";

export const RESET = "</span>";
export const BLUE = '<span style="color: #3498db;">';
export const GREEN = '<span style="color: #2ecc71;">';
export const BROWN = '<span style="color: #d35400;">';
export const RED = '<span style="color: #e74c3c;">';

export const tileChars: { [key in TileType]: string } = {
    0: GREEN + "." + RESET, // Grass
    1: "🌳", // Tree
    2: BLUE + "~" + RESET, // Water
    3: "🏠", // House
    4: "🟫", // Wall
    5: "🚪", // Door
    6: RED + "🔒" + RESET, // LockedDoor
    7: BROWN + "#" + RESET, // Bridge
};

export const wrapInFixedWidth = (content: string): string => {
    return `<span class="fixed-width">${content}</span>`;
};
