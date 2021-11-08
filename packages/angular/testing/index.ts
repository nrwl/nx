import {
  cold as rxjsMarblesCold,
  hot as rxjsMarblesHot,
  getTestScheduler as rxjsMarblesTestScheduler,
  time as rxjsMarblesTime,
} from 'jasmine-marbles';

/**
 * @deprecated Import from 'jasmine-marbles' instead
 */
export const cold = rxjsMarblesCold;
/**
 * @deprecated Import from 'jasmine-marbles' instead
 */
export const hot = rxjsMarblesHot;
/**
 * @deprecated Import from 'jasmine-marbles' instead
 */
export const getTestScheduler = rxjsMarblesTestScheduler;
/**
 * @deprecated Import from 'jasmine-marbles' instead
 */
export const time = rxjsMarblesTime;

export { readAll, readFirst } from './src/testing-utils';
