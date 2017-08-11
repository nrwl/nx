import {cleanup, runCLI, runSchematic} from './utils';

describe('addNgRxToModule', () => {
  beforeEach(cleanup);

  it('should add ngrx to module', () => {
    runCLI('new proj --skip-install ');
    runSchematic('@nrwl/ext:addNgRxToModule', {cwd: 'proj'});

    expect(1).toEqual(2);
  }, 50000);
});
