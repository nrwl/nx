import {
  cold as rxjsMarblesCold,
  hot as rxjsMarblesHot,
  getTestScheduler as rxjsMarblesTestScheduler,
  time as rxjsMarblesTime,
} from 'jasmine-marbles';

/**
 * @deprecated Import from 'jasmine-marbles' instead. Will be removed in Nx v15.
 */
export const cold = rxjsMarblesCold;
/**
 * @deprecated Import from 'jasmine-marbles' instead. Will be removed in Nx v15.
 */
export const hot = rxjsMarblesHot;
/**
 * @deprecated Import from 'jasmine-marbles' instead. Will be removed in Nx v15.
 */
export const getTestScheduler = rxjsMarblesTestScheduler;
/**
 * @deprecated Import from 'jasmine-marbles' instead. Will be removed in Nx v15.
 */
export const time = rxjsMarblesTime;

export { readAll, readFirst } from './src/testing-utils';
