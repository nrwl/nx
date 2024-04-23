import {
  AppDispatch,
  RootState,
  selectTargetGroupActions,
  getSelectedTargetGroup,
} from '@nx/graph/state';

const mapStateToProps = (state: RootState) => {
  return {
    selectedTargetGroup: getSelectedTargetGroup(state),
  };
};

const mapDispatchToProps = (dispatch: AppDispatch) => {
  return {
    selectTargetGroup(targetGroup: string) {
      dispatch(selectTargetGroupActions.selectTargetGroup(targetGroup));
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
