import React from 'react';
import { Provider } from 'react-redux';
import { rootStore } from './root/root.store';

export const StoreDecorator = (story: any) => {
  return <Provider store={rootStore}>{story()}</Provider>;
};
