import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cloneFromUpstream } from './git-utils';

function runGit(args: string[], cwd: string) {
  execFileSync('git', args, { cwd, stdio: 'ignore', windowsHide: true });
}

describe('GitRepository', () => {
  // The payload exercises POSIX shell expansion. Windows requires a cmd-specific payload.
  (process.platform === 'win32' ? it.skip : it)(
    'does not execute a hostile remote branch name during import preparation',
    async () => {
      const tempDirectory = mkdtempSync(join(tmpdir(), 'nx-import-git-utils-'));
      const marker = join(tempDirectory, 'nx-import-pwn');
      const maliciousRef = `$(touch\${IFS}${marker})`;
      const sourceRepository = join(tempDirectory, 'source');
      const clonedRepository = join(tempDirectory, 'cloned');

      try {
        mkdirSync(sourceRepository);
        runGit(['init'], sourceRepository);
        runGit(['config', 'user.email', 'test@example.com'], sourceRepository);
        runGit(['config', 'user.name', 'Test User'], sourceRepository);
        writeFileSync(join(sourceRepository, 'source.txt'), 'source');
        runGit(['add', 'source.txt'], sourceRepository);
        runGit(['commit', '-m', 'initial commit'], sourceRepository);
        runGit(['checkout', '-b', maliciousRef], sourceRepository);

        const git = await cloneFromUpstream(
          sourceRepository,
          clonedRepository,
          { originName: '__tmp_nx_import__' }
        );
        const ref = (await git.listBranches()).find(
          (branch) => branch === maliciousRef
        );
        expect(ref).toBe(maliciousRef);

        await git.addFetchRemote('__tmp_nx_import__', ref!);
        await git.fetch('__tmp_nx_import__', ref!);
        await git.checkout(`__nx_tmp_import__/${ref!}`, {
          new: true,
          base: `__tmp_nx_import__/${ref!}`,
        });
        await git.mergeUnrelatedHistories(
          `__tmp_nx_import__/${ref!}`,
          `feat(repo): merge ${ref!}`
        );

        expect(
          readFileSync(join(clonedRepository, 'source.txt'), 'utf-8')
        ).toBe('source');
        expect(existsSync(marker)).toBe(false);
      } finally {
        rmSync(tempDirectory, { recursive: true, force: true });
      }
    }
  );
});
