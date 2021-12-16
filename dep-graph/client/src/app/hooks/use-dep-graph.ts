import { useContext } from 'react';
import { GlobalStateContext } from '../state.provider';

export function useDepGraphService() {
  const globalState = useContext(GlobalStateContext);

  return globalState;
}
