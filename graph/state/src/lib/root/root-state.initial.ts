import {
  EXPAND_TARGETS_KEY,
  initialExpandTargets,
} from '../expand-targets/expand-targets.slice';
import {
  SELECT_TARGET_GROUP_KEY,
  initialSelectTargetGroup,
} from '../select-target-group/select-target-group.slice';

import { RootState } from './root.reducer';

export const initialRootState: RootState = {
  [EXPAND_TARGETS_KEY]: initialExpandTargets,
  [SELECT_TARGET_GROUP_KEY]: initialSelectTargetGroup,
};
