import { combineReducers } from '@reduxjs/toolkit';
import {
  EXPAND_TARGETS_KEY,
  expandTargetReducer,
} from '../expand-targets/expand-targets.slice';
import { RootState } from './root-state.interface';

export const rootReducer = combineReducers<RootState>({
  [EXPAND_TARGETS_KEY]: expandTargetReducer,
});
