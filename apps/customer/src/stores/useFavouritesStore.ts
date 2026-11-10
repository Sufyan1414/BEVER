/** Favourite products, kept on this device. */
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@bever/favourites';

interface FavState {
  ids: string[];
  loaded: boolean;
  load: () => Promise<void>;
  toggle: (productId: string) => void;
}

export const useFavouritesStore = create<FavState>((set, get) => ({
  ids: [],
  loaded: false,
  load: async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      set({ ids: raw ? (JSON.parse(raw) as string[]) : [], loaded: true });
    } catch {
      set({ loaded: true });
    }
  },
  toggle: (productId) => {
    const cur = get().ids;
    const next = cur.includes(productId) ? cur.filter((x) => x !== productId) : [productId, ...cur].slice(0, 200);
    set({ ids: next });
    AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => undefined);
  },
}));
