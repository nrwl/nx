import * as fs from 'fs';
import * as path from 'path';

type Migration = { description: string; run(): void };
type MigrationName = { name: string; migration: Migration };

const allMigrations = fs
  .readdirSync(path.join(__dirname, '/../../migrations'))
  .filter(f => f.endsWith('.js') && !f.endsWith('.d.js'))
  .map(file => ({ migration: require(`../../migrations/${file}`).default, name: path.parse(file).name }));

const latestMigration = readLatestMigration();
const migrationsToRun = calculateMigrationsToRun(allMigrations, latestMigration);

if (migrationsToRun.length === 0) {
  console.log('No migrations to run');
  process.exit(0);
}

printMigrationsNames(latestMigration, migrationsToRun);
runMigrations(migrationsToRun);
updateLatestMigration();

console.log('All migrations run successfully');

function readLatestMigration(): string {
  const angularCli = JSON.parse(fs.readFileSync('.angular-cli.json').toString());
  return angularCli.project.latestMigration;
}

function calculateMigrationsToRun(migrations: MigrationName[], latestMigration: string) {
  const startingWith = latestMigration ? migrations.findIndex(item => item.name === latestMigration) + 1 : 0;
  return migrations.slice(startingWith);
}

function printMigrationsNames(latestMigration: string, migrations: MigrationName[]): void {
  console.log(`Nx will run the following migrations (after ${latestMigration}):`);
  migrations.forEach(m => {
    console.log(`- ${m.name}`);
  });
  console.log('---------------------------------------------');
}

function runMigrations(migrations: MigrationName[]): void {
  migrations.forEach(m => {
    try {
      console.log(`Running ${m.name}`);
      console.log(m.migration.description);
      m.migration.run();
      console.log('---------------------------------------------');
    } catch (e) {
      console.error(`Migration ${m.name} failed`);
      console.error(e);
      console.error(`Please run 'git checkout .'`);
      process.exit(1);
    }
  });
}

function updateLatestMigration(): void {
  // we must reread .angular-cli.json because some of the migrations could have modified it
  const angularCliJson = JSON.parse(fs.readFileSync('.angular-cli.json').toString());
  angularCliJson.project.latestMigration = migrationsToRun[migrationsToRun.length - 1].name;
  fs.writeFileSync('.angular-cli.json', JSON.stringify(angularCliJson, null, 2));
}
