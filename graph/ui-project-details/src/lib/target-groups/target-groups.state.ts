import {
  AppDispatch,
  RootState,
  selectTargetActions,
  getSelectedTarget,
} from '@nx/graph/state';

const mapStateToProps = (state: RootState) => {
  return {
    selectedTargetGroup: getSelectedTarget(state),
  };
};

const mapDispatchToProps = (dispatch: AppDispatch) => {
  return {
    selectTargetGroup(targetGroup: string) {
      dispatch(selectTargetActions.selectTarget(targetGroup));
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
