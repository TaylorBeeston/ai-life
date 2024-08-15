import { v4 as uuidv4 } from "uuid";

import { Enemy, Position } from "@shared/types";

export const createEnemy = (position: Position): Enemy => ({
    id: uuidv4(),
    position,
    hp: 100,
    emoji: "👹",
});
