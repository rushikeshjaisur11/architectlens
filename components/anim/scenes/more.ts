import type { Scene } from "../scene/types";
import { MORE_SD_1 } from "./more-sd-1";
import { MORE_SD_2 } from "./more-sd-2";
import { MORE_SD_3 } from "./more-sd-3";
import { MORE_AI_1 } from "./more-ai-1";
import { MORE_AI_2 } from "./more-ai-2";
import { MORE_AI_3 } from "./more-ai-3";
import { MORE_AD } from "./more-ad-1";
import { MORE_AD_2 } from "./more-ad-2";
import { MORE_AD_3 } from "./more-ad-3";
import { MORE_AD_4 } from "./more-ad-4";
import { MORE_AD_5 } from "./more-ad-5";
import { MORE_AD_6 } from "./more-ad-6";

// Extra scenes per lesson key, appended after the lesson's main scene.
export const MORE: Record<string, Scene[]> = { ...MORE_SD_1, ...MORE_SD_2, ...MORE_SD_3, ...MORE_AI_1, ...MORE_AI_2, ...MORE_AI_3, ...MORE_AD, ...MORE_AD_2, ...MORE_AD_3, ...MORE_AD_4, ...MORE_AD_5, ...MORE_AD_6 };
