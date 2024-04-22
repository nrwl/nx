import { EXPAND_TARGETS_KEY } from '../expand-targets/expand-targets.slice';

export interface RootState {
  [EXPAND_TARGETS_KEY]: string[];
}
