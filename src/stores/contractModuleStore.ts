import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ContractModuleId = "matches_differs" | "rise_fall";

type ContractModuleState = {
  activeContractModule: ContractModuleId;
  setActiveContractModule: (module: ContractModuleId) => void;
};

export const useContractModuleStore = create<ContractModuleState>()(
  persist(
    (set) => ({
      activeContractModule: "matches_differs",
      setActiveContractModule: (activeContractModule) => set({ activeContractModule }),
    }),
    { name: "kocel-contract-module" },
  ),
);
