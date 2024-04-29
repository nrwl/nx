import {
  AppDispatch,
  RootState,
  expandTargetActions,
  getExpandedTargets,
} from '@nx/graph/state';

const mapStateToProps = (state: RootState) => {
  return {
    expandTargets: getExpandedTargets(state),
  };
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
