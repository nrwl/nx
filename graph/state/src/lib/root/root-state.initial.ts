import {
  EXPAND_TARGETS_KEY,
  initialExpandTargets,
} from '../expand-targets/expand-targets.slice';
import { RootState } from './root-state.interface';

export const initialRootState: RootState = {
  [EXPAND_TARGETS_KEY]: initialExpandTargets,
};
