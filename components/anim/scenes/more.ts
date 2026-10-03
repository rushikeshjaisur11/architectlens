import type { Scene } from "../scene/types";
import { MORE_SD_1 } from "./more-sd-1";
import { MORE_SD_2 } from "./more-sd-2";
import { MORE_SD_3 } from "./more-sd-3";

// Extra scenes per lesson key, appended after the lesson's main scene.
export const MORE: Record<string, Scene[]> = { ...MORE_SD_1, ...MORE_SD_2, ...MORE_SD_3 };
