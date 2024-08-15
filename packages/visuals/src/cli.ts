import { TileType } from "@shared/types";

export const RESET = "\x1b[0m";
export const BLUE = "\x1b[34m";
export const GREEN = "\x1b[32m";
export const BROWN = "\x1b[33m";
export const RED = "\x1b[31m";
export const CYAN = "\x1b[36m";

export const toFullWidth = (char: string): string => {
    const code = char.charCodeAt(0);
    return String.fromCharCode(code + 0xfee0);
};

export const tileChars: { [key in TileType]: string } = {
    [TileType.Grass]: GREEN + toFullWidth(".") + RESET,
    [TileType.Tree]: "🌳",
    [TileType.Water]: BLUE + toFullWidth("~") + RESET,
    [TileType.House]: "🏠",
    [TileType.Wall]: "🟫",
    [TileType.Door]: "🚪",
    [TileType.LockedDoor]: RED + "🔒" + RESET,
    [TileType.Bridge]: BROWN + toFullWidth("#") + RESET,
};
