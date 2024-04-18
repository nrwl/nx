import { combineReducers } from '@reduxjs/toolkit';
import {
  EXPAND_TARGETS_KEY,
  expandTargetReducer,
} from '../expand-targets/expand-targets.slice';
import {
  SELECT_TARGET_KEY,
  selectTargetReducer,
} from '../select-target/select-target.slice';
import { RootState } from './root-state.interface';

export const rootReducer = combineReducers<RootState>({
  [EXPAND_TARGETS_KEY]: expandTargetReducer,
  [SELECT_TARGET_KEY]: selectTargetReducer as any,
});
