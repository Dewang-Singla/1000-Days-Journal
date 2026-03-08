import { create } from "zustand";
import type { RedemptionDay } from "../db";
import storage from "../storage";
import type { ClaimResult } from "../storage";

interface RedemptionState {
  redemptions: RedemptionDay[];
  isLoading: boolean;
  lastRedemptionDate: string | null;
  loadRedemptions: () => Promise<void>;
  claimRedemption: (wastedDateId: string) => Promise<ClaimResult>;
  /** Number of redemption days remaining (out of 21) */
  remaining: () => number;
  /** Get the redemption assigned to a specific wasted day */
  getRedemptionForDate: (dateId: string) => RedemptionDay | undefined;
  /** Get the redemption that IS a specific Dec day */
  getRedemptionById: (redemptionId: string) => RedemptionDay | undefined;
}

export const useRedemptionStore = create<RedemptionState>((set, get) => ({
  redemptions: [],
  isLoading: false,
  lastRedemptionDate: null,

  async loadRedemptions() {
    set({ isLoading: true });
    const [redemptions, lastDate] = await Promise.all([
      storage.getRedemptions(),
      storage.getLastRedemptionDate(),
    ]);
    set({ redemptions, lastRedemptionDate: lastDate, isLoading: false });
  },

  async claimRedemption(wastedDateId: string) {
    const result = await storage.claimRedemption(wastedDateId);
    if (result.ok) {
      // Reload redemptions
      await get().loadRedemptions();
    }
    return result;
  },

  remaining() {
    return 21 - get().redemptions.length;
  },

  getRedemptionForDate(dateId: string) {
    return get().redemptions.find((r) => r.assignedToDateId === dateId);
  },

  getRedemptionById(redemptionId: string) {
    return get().redemptions.find((r) => r.id === redemptionId);
  },
}));
