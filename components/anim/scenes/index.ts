import type { Scene } from "../scene/types";
import { SCENES as sd1 } from "./sd-1";
import { SCENES as sd2 } from "./sd-2";
import { SCENES as sd3 } from "./sd-3";
import { SCENES as sd4 } from "./sd-4";
import { SCENES as sd5 } from "./sd-5";
import { SCENES as sd6 } from "./sd-6";
import { SCENES as sd7 } from "./sd-7";
import { SCENES as ai1 } from "./ai-1";
import { SCENES as ai2 } from "./ai-2";
import { SCENES as ai3 } from "./ai-3";
import { SCENES as ai4 } from "./ai-4";
import { SCENES as ai5 } from "./ai-5";

export const SCENES: Record<string, Scene> = { ...sd1, ...sd2, ...sd3, ...sd4, ...sd5, ...sd6, ...sd7, ...ai1, ...ai2, ...ai3, ...ai4, ...ai5 };
