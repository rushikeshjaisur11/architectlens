import type { Scene } from "../scene/types";
import { MORE_SD_1 } from "./more-sd-1";

// Extra scenes per lesson key, appended after the lesson's main scene.
export const MORE: Record<string, Scene[]> = { ...MORE_SD_1 };
