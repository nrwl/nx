import {
  EXPAND_TARGETS_KEY,
  initialExpandTargets,
} from '../expand-targets/expand-targets.slice';
import {
  SELECT_TARGET_KEY,
  initialSelectTarget,
} from '../select-target/select-target.slice';
import { RootState } from './root-state.interface';

export const initialRootState: RootState = {
  [EXPAND_TARGETS_KEY]: initialExpandTargets,
  [SELECT_TARGET_KEY]: initialSelectTarget,
};
