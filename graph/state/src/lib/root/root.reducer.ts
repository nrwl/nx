import { combineReducers } from '@reduxjs/toolkit';
import {
  EXPAND_TARGETS_KEY,
  expandTargetReducer,
} from '../expand-targets/expand-targets.slice';
import {
  SELECT_TARGET_GROUP_KEY,
  selectTargetGroupReducer,
} from '../select-target-group/select-target-group.slice';

export const rootReducer = combineReducers<{
  [EXPAND_TARGETS_KEY]: string[];
  [SELECT_TARGET_GROUP_KEY]: string;
}>({
  [EXPAND_TARGETS_KEY]: expandTargetReducer,
  [SELECT_TARGET_GROUP_KEY]: selectTargetGroupReducer as any,
});

export type RootState = ReturnType<typeof rootReducer>;
