import {
  AppDispatch,
  RootState,
  expandTargetActions,
  getExpandedTargets,
  getSelectedTargetGroup,
  selectTargetGroupActions,
} from '@nx/graph/state';

const mapStateToProps = (state: RootState) => {
  return {
    expandTargets: getExpandedTargets(state),
    selectedTargetGroup: getSelectedTargetGroup(state),
  };
};

const mapDispatchToProps = (dispatch: AppDispatch) => {
  return {
    setExpandTargets(targets: string[]) {
      dispatch(expandTargetActions.setExpandTargets(targets));
    },
    selectTargetGroup(targetGroup: string) {
      dispatch(selectTargetGroupActions.selectTargetGroup(targetGroup));
    },
    collapseAllTargets() {
      dispatch(expandTargetActions.collapseAllTargets());
    },
    clearTargetGroup() {
      dispatch(selectTargetGroupActions.clearTargetGroup());
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
