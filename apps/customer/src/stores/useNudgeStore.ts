import { create } from 'zustand';

/** Set when the customer taps a notification; Home reads it and opens that basket. */
interface NudgeState {
  bundleId: string | null;
  openBundle: (id: string) => void;
  clear: () => void;
}
export const useNudgeStore = create<NudgeState>((set) => ({
  bundleId: null,
  openBundle: (id) => set({ bundleId: id }),
  clear: () => set({ bundleId: null }),
}));
