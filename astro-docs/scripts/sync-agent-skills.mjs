#!/usr/bin/env node
/**
 * Generates the Agent Skills Discovery index (RFC v0.2.0) that nx.dev serves at
 * /.well-known/agent-skills/, from the skills published in
 * nrwl/nx-ai-agents-config.
 *
 * The output is build-time only and gitignored. Vendoring the skills into this
 * repo meant every upstream edit landed here as a large diff, three of them
 * binary archives, and the copy went stale between syncs.
 *
 * Runs only on Netlify, so CI, local builds, and the dev server neither reach
 * for GitHub nor produce the directory. Set NETLIFY=1 to generate it locally.
 */
import { createHash } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const REPO = 'nrwl/nx-ai-agents-config';
const SOURCE_DIR = 'artifacts/skills';
const SCHEMA = 'https://schemas.agentskills.io/discovery/0.2.0/schema.json';
const PUBLIC_PATH = '/.well-known/agent-skills';

if (!process.env.NETLIFY) {
  console.log(
    'Not a Netlify build, skipping the agent skills index. Set NETLIFY=1 to generate it locally.'
  );
  process.exit(0);
}

const scriptDir = dirname(fileURLToPath(import.meta.url));
const outDir = join(scriptDir, '..', 'public', '.well-known', 'agent-skills');

async function githubJson(url) {
  const headers = { accept: 'application/vnd.github+json' };
  if (process.env.GITHUB_TOKEN) {
    headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`GET ${url} failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`GET ${url} failed: ${res.status} ${res.statusText}`);
  }
  return res.text();
}

function sha256(content) {
  return `sha256:${createHash('sha256').update(content).digest('hex')}`;
}

/** Escape a description for a double-quoted YAML scalar. */
function yamlString(value) {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/**
 * The repo stores the body and its metadata separately; agents expect one
 * SKILL.md whose frontmatter carries name and description.
 */
function withFrontmatter(meta, body) {
  return [
    '---',
    `name: ${meta.name}`,
    `description: ${yamlString(meta.description)}`,
    '---',
    '',
    body.trimStart(),
  ].join('\n');
}

const BLOCK = 512;

/** Octal field, NUL-terminated, as ustar specifies. */
function octal(value, width) {
  return value.toString(8).padStart(width - 1, '0') + '\0';
}

/** Serializes one ustar header. Ownership and timestamps are zeroed. */
function tarHeader(name, size) {
  if (Buffer.byteLength(name) > 100) {
    throw new Error(`Path too long for a ustar header: ${name}`);
  }
  const header = Buffer.alloc(BLOCK);
  header.write(name, 0, 100);
  header.write(octal(0o644, 8), 100, 8); // mode
  header.write(octal(0, 8), 108, 8); // uid
  header.write(octal(0, 8), 116, 8); // gid
  header.write(octal(size, 12), 124, 12);
  header.write(octal(0, 12), 136, 12); // mtime
  header.write('        ', 148, 8); // checksum placeholder: spaces
  header.write('0', 156, 1); // typeflag: regular file
  header.write('ustar\0', 257, 6);
  header.write('00', 263, 2);

  let checksum = 0;
  for (const byte of header) checksum += byte;
  header.write(checksum.toString(8).padStart(6, '0') + '\0 ', 148, 8);
  return header;
}

/** .tar.gz of `files`, contents at the archive root per the RFC. */
function tarGz(files) {
  const blocks = [];
  for (const { name, content } of [...files].sort((a, b) =>
    a.name.localeCompare(b.name)
  )) {
    const body = Buffer.from(content);
    blocks.push(tarHeader(name, body.length), body);
    const padding = (BLOCK - (body.length % BLOCK)) % BLOCK;
    if (padding) blocks.push(Buffer.alloc(padding));
  }
  // Two zero blocks end the archive; pad to the conventional 20-block record.
  blocks.push(Buffer.alloc(BLOCK * 2));
  const tar = Buffer.concat(blocks);
  const record = BLOCK * 20;
  const tail = (record - (tar.length % record)) % record;
  return gzipSync(Buffer.concat([tar, Buffer.alloc(tail)]), { level: 9 });
}

const commit = await githubJson(
  `https://api.github.com/repos/${REPO}/commits/main`
);
const tree = await githubJson(
  `https://api.github.com/repos/${REPO}/git/trees/${commit.sha}?recursive=1`
);

const blobs = tree.tree.filter(
  (node) => node.type === 'blob' && node.path.startsWith(`${SOURCE_DIR}/`)
);
if (blobs.length === 0) {
  throw new Error(`No files found under ${SOURCE_DIR} in ${REPO}`);
}

const rawBase = `https://raw.githubusercontent.com/${REPO}/${commit.sha}`;
const contents = new Map(
  await Promise.all(
    blobs.map(async (node) => [
      node.path,
      await fetchText(`${rawBase}/${node.path}`),
    ])
  )
);

/** Group the fetched blobs by skill, keyed by their path inside the skill. */
const bySkill = new Map();
for (const [path, content] of contents) {
  const rest = path.slice(SOURCE_DIR.length + 1);
  const slash = rest.indexOf('/');
  const skillName = rest.slice(0, slash);
  if (!bySkill.has(skillName)) bySkill.set(skillName, new Map());
  bySkill.get(skillName).set(rest.slice(slash + 1), content);
}

const written = new Map();
const skills = [];

for (const [skillName, skillFiles] of bySkill) {
  const metaRaw = skillFiles.get('SKILL.md.meta.json');
  const body = skillFiles.get('SKILL.md');
  if (!metaRaw || !body) {
    throw new Error(`${skillName} is missing SKILL.md or SKILL.md.meta.json`);
  }
  const meta = JSON.parse(metaRaw);

  const payload = [
    { name: 'SKILL.md', content: withFrontmatter(meta, body) },
    ...[...skillFiles]
      .filter(([name]) => name !== 'SKILL.md' && name !== 'SKILL.md.meta.json')
      .map(([name, content]) => ({ name, content })),
  ];

  for (const file of payload) {
    written.set(`${skillName}/${file.name}`, file.content);
  }

  // A skill whose SKILL.md links to references/ or scripts/ has to ship as an
  // archive; skill-md is defined as a single-file artifact, so a conforming
  // client would never fetch the supporting files.
  const isMultiFile = payload.length > 1;
  const artifact = isMultiFile
    ? { path: `${skillName}.tar.gz`, content: tarGz(payload) }
    : { path: `${skillName}/SKILL.md`, content: payload[0].content };

  if (isMultiFile) {
    written.set(artifact.path, artifact.content);
  }

  skills.push({
    name: meta.name,
    type: isMultiFile ? 'archive' : 'skill-md',
    description: meta.description,
    url: `${PUBLIC_PATH}/${artifact.path}`,
    digest: sha256(artifact.content),
  });
}

skills.sort((a, b) => a.name.localeCompare(b.name));
written.set(
  'index.json',
  JSON.stringify({ $schema: SCHEMA, skills }, null, 2) + '\n'
);

await rm(outDir, { recursive: true, force: true });
for (const [file, content] of written) {
  const target = join(outDir, file);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content);
}

console.log(
  `Generated ${skills.length} agent skills from ${REPO}@${commit.sha.slice(0, 7)}`
);
