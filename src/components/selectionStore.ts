"use client";

import { create } from "zustand";

interface SelectionState {
  selectedGeoid: string | null;
  selectedHour: number | null;
  setSelectedGeoid: (geoid: string | null) => void;
  setSelectedHour: (hour: number | null) => void;
}

export const useSelectionStore = create<SelectionState>((set) => ({
  selectedGeoid: null,
  selectedHour: null,
  setSelectedGeoid: (geoid) => set({ selectedGeoid: geoid }),
  setSelectedHour: (hour) => set({ selectedHour: hour }),
}));
