import * as fs from "fs";
import * as path from "path";
import * as zlib from "zlib";
import { promisify } from "util";
import { WorldState } from "@shared/types";

const brotliCompress = promisify(zlib.brotliCompress);
const brotliDecompress = promisify(zlib.brotliDecompress);

export const logState = async (world: WorldState, logFile: string) => {
    const stateLog = await serializeState(world);
    fs.writeFileSync(logFile, stateLog);
};

export const serializeState = async (world: WorldState): Promise<Buffer> => {
    const jsonString = JSON.stringify(world);
    return brotliCompress(Buffer.from(jsonString));
};

export const deserializeState = async (
    stateBuffer: Buffer,
): Promise<WorldState> => {
    const decompressed = await brotliDecompress(stateBuffer);
    return JSON.parse(decompressed.toString());
};

export const loadMostRecentState = async (
    logDir: string,
): Promise<WorldState | null> => {
    const files = fs
        .readdirSync(logDir)
        .filter((file) => file.startsWith("world_state_"))
        .sort()
        .reverse();
    if (files.length > 0) {
        const mostRecentFile = path.join(logDir, files[0]);
        const stateBuffer = fs.readFileSync(mostRecentFile);
        return deserializeState(stateBuffer);
    }
    return null;
};
