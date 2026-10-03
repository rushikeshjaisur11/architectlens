import { describe, expect, it } from "vitest";
import { peakLoad, simulate } from "./retryStormLogic";

describe("retry storm", () => {
  it("immediate retries peak higher than jittered backoff", () => {
    expect(peakLoad(simulate("immediate"))).toBeGreaterThan(peakLoad(simulate("jitter")));
  });
});
