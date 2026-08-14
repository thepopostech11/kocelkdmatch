import { describe, expect, it } from "vitest";
import { useContractModuleStore } from "@/stores/contractModuleStore";

describe("contract module store", () => {
  it("defaults to the production Matches & Differs module", () => {
    expect(useContractModuleStore.getState().activeContractModule).toBe("matches_differs");
  });

  it("tracks the selected module without resetting the app state", () => {
    useContractModuleStore.setState({ activeContractModule: "matches_differs" });
    useContractModuleStore.getState().setActiveContractModule("rise_fall");
    expect(useContractModuleStore.getState().activeContractModule).toBe("rise_fall");

    useContractModuleStore.getState().setActiveContractModule("matches_differs");
    expect(useContractModuleStore.getState().activeContractModule).toBe("matches_differs");
  });
});
