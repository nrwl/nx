import { PayloadAction, createSlice } from '@reduxjs/toolkit';

export const EXPAND_TARGETS_KEY = 'expandTargets';

export const initialExpandTargets: string[] = [];

export const expandTargetSlice = createSlice({
  name: EXPAND_TARGETS_KEY,
  initialState: initialExpandTargets,
  reducers: {
    expandTarget: (state: string[], action: PayloadAction<string>) => {
      if (state.includes(action.payload)) {
        return state;
      }
      state.push(action.payload);
      return state;
    },
    collapseTarget: (state: string[], action: PayloadAction<string>) => {
      if (state.includes(action.payload)) {
        state = state.filter((target) => target !== action.payload);
      }
      return state;
    },
    toggleExpandTarget: (state: string[], action: PayloadAction<string>) => {
      if (state.includes(action.payload)) {
        state = state.filter((target) => target !== action.payload);
      } else {
        state.push(action.payload);
      }
      return state;
    },
    setExpandTargets: (state: string[], action: PayloadAction<string[]>) => {
      state = action.payload;
      return state;
    },
    collapseAllTargets: (state: string[]) => {
      state = [];
      return state;
    },
  },
});

/*
 * Export reducer for store configuration.
 */
export const expandTargetReducer = expandTargetSlice.reducer;

export const expandTargetActions = expandTargetSlice.actions;

export const getExpandedTargets = <
  ROOT extends { [EXPAND_TARGETS_KEY]: string[] }
>(
  rootState: ROOT
): string[] => rootState[EXPAND_TARGETS_KEY];
