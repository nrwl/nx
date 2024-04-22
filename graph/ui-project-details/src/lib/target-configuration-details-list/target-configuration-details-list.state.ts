/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import { AppDispatch, RootState, expandTargetActions } from '@nx/graph/state';

const mapStateToProps = (state: RootState) => {
  return {};
};

const mapDispatchToProps = (dispatch: AppDispatch) => {
  return {
    setExpandTargets(targets: string[]) {
      dispatch(expandTargetActions.setExpandTargets(targets));
    },
    collapseAllTargets() {
      dispatch(expandTargetActions.collapseAllTargets());
    },
  };
};

type mapStateToPropsType = ReturnType<typeof mapStateToProps>;
type mapDispatchToPropsType = ReturnType<typeof mapDispatchToProps>;

export {
  mapStateToProps,
  mapDispatchToProps,
  mapStateToPropsType,
  mapDispatchToPropsType,
};
