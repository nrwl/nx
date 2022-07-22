import { addPrefixToLines } from './add-command-prefix';
const stripAnsi = require('strip-ansi');

describe('addPrefixToLines', () => {
  it('should add project name as a prefix', () => {
    const prefixed = addPrefixToLines('myproj', ['one', 'two', 'three']);
    expect(prefixed.map(stripAnsi)).toEqual([
      '[myproj         ] one',
      '[myproj         ] two',
      '[myproj         ] three',
    ]);
  });

  it('should handle project names which length = 15', () => {
    const prefixed = addPrefixToLines('123456789012345', [
      'one',
      'two',
      'three',
    ]);
    expect(prefixed.map(stripAnsi)).toEqual([
      '[123456789012345] one',
      '[123456789012345] two',
      '[123456789012345] three',
    ]);
  });

  it('should handle long project names', () => {
    const prefixed = addPrefixToLines('12345678901234567890', [
      'one',
      'two',
      'three',
    ]);
    expect(prefixed.map(stripAnsi)).toEqual([
      '[...901234567890] one',
      '[...901234567890] two',
      '[...901234567890] three',
    ]);
  });

  it('should not prefix last empty line', () => {
    const prefixed = addPrefixToLines('myproj', ['one', 'two', '']);
    expect(prefixed.map(stripAnsi)).toEqual([
      '[myproj         ] one',
      '[myproj         ] two',
      '',
    ]);
  });
});
