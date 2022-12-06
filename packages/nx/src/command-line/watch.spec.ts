import { buildCommands } from './watch';

describe('watch command', () => {
  describe('building commands', () => {
    it('should build commands to replace for a single project (&1)', () => {
      const commands = buildCommands('echo &1', [], ['proj1']);
      expect(commands).toMatchInlineSnapshot(`
        Array [
          "echo proj1",
        ]
      `);
    });
    it('should build commands to replace multiple projects (&1)', () => {
      const commands = buildCommands('echo &1', [], ['proj1', 'proj2']);
      expect(commands).toMatchInlineSnapshot(`
        Array [
          "echo proj1",
          "echo proj2",
        ]
      `);
    });

    it('should build commands to replace for a single file (&2)', () => {
      const commands = buildCommands(
        'echo &2',
        [{ path: 'file1', type: 'create' }],
        []
      );
      expect(commands).toMatchInlineSnapshot(`
        Array [
          "echo file1",
        ]
      `);
    });

    it('should build commands to replace for multiple files (&2)', () => {
      const commands = buildCommands(
        'echo &2',
        [
          { path: 'file1', type: 'create' },
          { path: 'file2', type: 'create' },
          { path: 'file3', type: 'create' },
        ],
        []
      );
      expect(commands).toMatchInlineSnapshot(`
        Array [
          "echo file1",
          "echo file2",
          "echo file3",
        ]
      `);
    });

    it('should build commands for multiple projects and files (&1, &2)', () => {
      const commands = buildCommands(
        'echo &1 &2',
        [
          { path: 'file1', type: 'create' },
          { path: 'file2', type: 'create' },
          { path: 'file3', type: 'create' },
        ],
        ['proj1', 'proj2']
      );
      expect(commands).toMatchInlineSnapshot(`
        Array [
          "echo proj1 file1",
          "echo proj2 file1",
          "echo proj1 file2",
          "echo proj2 file2",
          "echo proj1 file3",
          "echo proj2 file3",
        ]
      `);
    });
  });
});
