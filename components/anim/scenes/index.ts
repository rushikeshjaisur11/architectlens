import type { Scene } from "../scene/types";
import { SCENES as sd1 } from "./sd-1";
import { SCENES as sd2 } from "./sd-2";
import { SCENES as sd3 } from "./sd-3";

export const SCENES: Record<string, Scene> = { ...sd1, ...sd2, ...sd3 };
