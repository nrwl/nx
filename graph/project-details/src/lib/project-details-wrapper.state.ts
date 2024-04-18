import {
  AppDispatch,
  RootState,
  expandTargetActions,
  getExpandedTargets,
  getSelectedTarget,
  selectTargetActions,
} from '@nx/graph/state';

const mapStateToProps = (state: RootState) => {
  return {
    expandTargets: getExpandedTargets(state),
    getSelectedTarget: getSelectedTarget(state),
  };
};

const mapDispatchToProps = (dispatch: AppDispatch) => {
  return {
    setExpandTargets(targets: string[]) {
      dispatch(expandTargetActions.setExpandTargets(targets));
    },
    selectTarget(targetGroup: string) {
      dispatch(selectTargetActions.selectTarget(targetGroup));
    },
    collapseAllTargets() {
      dispatch(expandTargetActions.collapseAllTargets());
    },
    clearTargetGroup() {
      dispatch(selectTargetActions.clearSelectedTarget());
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
