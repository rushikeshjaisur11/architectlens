import type { Scene } from "../scene/types";
import { SCENES as sd1 } from "./sd-1";
import { SCENES as sd2 } from "./sd-2";
import { SCENES as sd3 } from "./sd-3";
import { SCENES as sd4 } from "./sd-4";
import { SCENES as sd5 } from "./sd-5";
import { SCENES as sd6 } from "./sd-6";

export const SCENES: Record<string, Scene> = { ...sd1, ...sd2, ...sd3, ...sd4, ...sd5, ...sd6 };
