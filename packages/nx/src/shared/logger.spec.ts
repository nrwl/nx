import { logger } from './logger';

describe('Logger', () => {
  it('should color the NX prefix', () => {
    let logObject;
    jest.spyOn(console, 'info').mockImplementation((message) => {
      logObject = message;
    });

    logger.info('NX some Nx message!');

    expect(logObject).toMatchSnapshot();
  });

  it('should log the full stack trace when an object is being passed', () => {
    let logObject;
    jest.spyOn(console, 'error').mockImplementation((message) => {
      logObject = message;
    });

    const err = new Error(
      'TypeError: Cannot read property target of undefined'
    );
    err.stack = `TypeError: Cannot read property 'target' of undefined
      at /someuser/node_modules/@storybook/angular/dist/ts3.9/server/angular-devkit-build-webpack.js:145:49
      at step (/someuser/node_modules/@storybook/angular/dist/ts3.9/server/angular-devkit-build-webpack.js:69:23)
      at Object.next (/someuser/node_modules/@storybook/angular/dist/ts3.9/server/angular-devkit-build-webpack.js:50:53)
      at fulfilled (/someuser/node_modules/@storybook/angular/dist/ts3.9/server/angular-devkit-build-webpack.js:41:58)`;

    logger.error(err);

    expect(logObject).toMatchSnapshot();
  });
});
