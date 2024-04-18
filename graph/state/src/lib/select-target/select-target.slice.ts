import { PayloadAction, createSlice } from '@reduxjs/toolkit';

export const SELECT_TARGET_KEY = 'selectTarget';

export const initialSelectTarget: string = '';

export const selectTargetSlice = createSlice({
  name: SELECT_TARGET_KEY,
  initialState: initialSelectTarget,
  reducers: {
    selectTarget: (_: string, action: PayloadAction<string>): string => {
      return action.payload;
    },
    clearSelectedTarget: (): string => {
      return '';
    },
  },
});

/*
 * Export reducer for store configuration.
 */
export const selectTargetReducer = selectTargetSlice.reducer;

export const selectTargetActions = selectTargetSlice.actions;

export const getSelectedTarget = <ROOT extends { [SELECT_TARGET_KEY]: string }>(
  rootState: ROOT
): string => rootState[SELECT_TARGET_KEY];
