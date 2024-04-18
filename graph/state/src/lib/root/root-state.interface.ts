import { EXPAND_TARGETS_KEY } from '../expand-targets/expand-targets.slice';
import { SELECT_TARGET_KEY } from '../select-target/select-target.slice';

export interface RootState {
  [EXPAND_TARGETS_KEY]: string[];
  [SELECT_TARGET_KEY]: string;
}
