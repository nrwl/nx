import { PayloadAction, createSlice } from '@reduxjs/toolkit';

export const SELECT_TARGET_GROUP_KEY = 'selectTargetGroup';

export const initialSelectTargetGroup: string = '';

export const selectTargetSlice = createSlice({
  name: SELECT_TARGET_GROUP_KEY,
  initialState: initialSelectTargetGroup,
  reducers: {
    selectTargetGroup: (_: string, action: PayloadAction<string>): string => {
      return action.payload;
    },
    clearTargetGroup: (): string => {
      return '';
    },
  },
});

/*
 * Export reducer for store configuration.
 */
export const selectTargetGroupReducer = selectTargetSlice.reducer;

export const selectTargetGroupActions = selectTargetSlice.actions;

export const getSelectedTargetGroup = <
  ROOT extends { [SELECT_TARGET_GROUP_KEY]: string }
>(
  rootState: ROOT
): string => rootState[SELECT_TARGET_GROUP_KEY];
