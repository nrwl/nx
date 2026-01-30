/** #33337: Nest + webpack + Swagger plugin + shared lib DTO + rootDir: "src" → build succeeds */
import {
  cleanupProject,
  newProject,
  packageInstall,
  readFile,
  runCLI,
  runCLIAsync,
  updateFile,
  updateJson,
} from '@nx/e2e-utils';

describe('Node Nest Swagger rootDir repro (issue #33337)', () => {
  const nestApp = 'backend';
  const sharedLib = 'shared-lib';

  beforeAll(() =>
    newProject({
      packages: ['@nx/node', '@nx/nest', '@nx/webpack', '@nx/js'],
    })
  );
  afterAll(() => cleanupProject());

  it('builds successfully when Nest app with Swagger plugin imports DTO from shared lib and rootDir is src (fix for #33337)', async () => {
    runCLI(
      `generate @nx/node:lib libs/${sharedLib} --linter=eslint --unitTestRunner=jest --buildable=false --no-interactive`
    );
    runCLI(
      `generate @nx/node:app apps/${nestApp} --framework=nest --bundler=webpack --no-interactive --linter=eslint --unitTestRunner=jest`
    );
    packageInstall('@nestjs/swagger');

    // Shared lib: DTO and service (as in issue)
    updateFile(
      `libs/${sharedLib}/src/lib/mail-manager.dto.ts`,
      `export class TwoFaEmail {
  userID: string;
  token: string;
}
`
    );
    updateFile(
      `libs/${sharedLib}/src/lib/mail-manager.service.ts`,
      `import { TwoFaEmail } from './mail-manager.dto';

export class MailManagerService {
  async sendEmail2fa(params: TwoFaEmail): Promise<void> {}
}
`
    );
    updateFile(
      `libs/${sharedLib}/src/index.ts`,
      `export * from './lib/mail-manager.dto';
export * from './lib/mail-manager.service';
`
    );

    // Backend: controller that imports DTO from shared lib
    updateFile(
      `apps/${nestApp}/src/app/auth.controller.ts`,
      `import { Controller, Post } from '@nestjs/common';
import { MailManagerService } from '@proj/${sharedLib}';
import { TwoFaEmail } from '@proj/${sharedLib}';

@Controller('auth')
export class AuthController {
  constructor(private mailManager: MailManagerService) {}

  @Post('2fa/send-email')
  email2FA() {
    const params: TwoFaEmail = { userID: 'u', token: 't' };
    return this.mailManager.sendEmail2fa(params);
  }
}
`
    );
    updateFile(
      `apps/${nestApp}/src/app/app.module.ts`,
      `import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';

@Module({
  controllers: [AuthController],
})
export class AppModule {}
`
    );

    // Ensure tsconfig.app.json has rootDir: "src" (triggers the issue)
    updateJson(`apps/${nestApp}/tsconfig.app.json`, (c: any) => {
      c.compilerOptions = c.compilerOptions || {};
      c.compilerOptions.rootDir = 'src';
      return c;
    });

    // Add @nestjs/swagger/plugin to webpack (triggers the issue)
    const webpackPath = `apps/${nestApp}/webpack.config.js`;
    const existingWebpack = readFile(webpackPath);
    const withSwagger = existingWebpack.replace(
      /new NxAppWebpackPlugin\(\{/,
      `new NxAppWebpackPlugin({
      transformers: [
        {
          name: '@nestjs/swagger/plugin',
          options: {
            classValidatorShim: true,
            introspectComments: true,
            controllerFileNameSuffix: ['.controller.ts', '.gateway.ts'],
            dtoFileNameSuffix: ['.dto.ts', '.entity.ts', '.interface.ts'],
          },
        },
      ],
      `
    );
    updateFile(webpackPath, withSwagger);

    const result = await runCLIAsync(`build ${nestApp}`, {
      silenceError: true,
    });

    const output = result.combinedOutput ?? result.stdout + result.stderr;
    const hasTs6059 =
      output.includes('TS6059') || output.includes("is not under 'rootDir'");
    const hasTs6307 =
      output.includes('TS6307') ||
      output.includes('is not listed within the file list');

    expect(result.exitCode).toBe(0);
    expect(hasTs6059).toBe(false);
    expect(hasTs6307).toBe(false);
  }, 300_000);
});
