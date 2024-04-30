import {
  AppDispatch,
  RootState,
  expandTargetActions,
  getExpandedTargets,
} from '@nx/graph/state';

const mapStateToProps = (state: RootState) => {
  return {
    expandedTargets: getExpandedTargets(state),
  };
};

const mapDispatchToProps = (dispatch: AppDispatch) => {
  return {
    expandTarget(target: string) {
      dispatch(expandTargetActions.expandTarget(target));
    },
    collapseTarget(target: string) {
      dispatch(expandTargetActions.collapseTarget(target));
    },
    toggleExpandTarget(target: string) {
      dispatch(expandTargetActions.toggleExpandTarget(target));
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
