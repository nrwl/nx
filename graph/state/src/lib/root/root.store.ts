import { configureStore } from '@reduxjs/toolkit';
import { initialRootState } from './root-state.initial';
import { rootReducer } from './root.reducer';

declare const process: any;

export const rootStore = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) => {
    const defaultMiddleware = getDefaultMiddleware({
      serializableCheck: false,
    });
    return defaultMiddleware;
  },
  devTools: process.env.NODE_ENV === 'development',
  preloadedState: initialRootState,
});

export type AppDispatch = typeof rootStore.dispatch;
