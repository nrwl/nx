import { selectsAffectedTasks } from './granularity';

describe('selectsAffectedTasks', () => {
  const original = process.env.NX_LEGACY_AFFECTED;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.NX_LEGACY_AFFECTED;
    } else {
      process.env.NX_LEGACY_AFFECTED = original;
    }
  });

  // The default is the release: task selection stays opt-in until it is
  // flipped on purpose, so an edit that flips it has to fail here.
  it('selects whole projects when the variable is unset', () => {
    delete process.env.NX_LEGACY_AFFECTED;
    expect(selectsAffectedTasks()).toBe(false);
  });

  it('selects whole projects when the variable is true', () => {
    process.env.NX_LEGACY_AFFECTED = 'true';
    expect(selectsAffectedTasks()).toBe(false);
  });

  it('selects tasks only when the variable is false', () => {
    process.env.NX_LEGACY_AFFECTED = 'false';
    expect(selectsAffectedTasks()).toBe(true);
  });
});
