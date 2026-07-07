/**
 * One-off probe of Pylon's body_html sanitizer. Creates an unpublished,
 * unlisted article exercising the HTML constructs our converter emits,
 * reads it back, reports what survived, then deletes it.
 *
 * Also prints the authed user id (candidate for NX_AUTHOR_USER_ID) and the
 * KB's collections, both needed to configure the pilot migration.
 *
 * Usage:
 *   PYLON_API_TOKEN=$(op read "op://Private/Pylon API Key/password") \
 *     pnpm tsx scripts/pylon/probe-sanitizer.ts
 */
import { NX_AUTHOR_USER_ID } from './config';
import {
  createArticle,
  deleteArticle,
  getArticle,
  getMe,
  listCollections,
} from './pylon-api';

const PROBE_HTML = [
  '<h2>Heading two</h2>',
  '<p class="test-class">Paragraph with <strong>bold</strong>, <em>italic</em>, <code>inline code</code>.</p>',
  '<blockquote><p><strong>ℹ️ Note</strong></p><p>Aside-style blockquote.</p></blockquote>',
  '<pre><code class="language-shell">npx nx@latest init\n</code></pre>',
  '<details><summary><strong>Collapsible prompt</strong></summary><p>Details content.</p></details>',
  '<iframe src="https://www.youtube.com/embed/zJmhW1iIxpc" title="Probe video" width="560" height="315"></iframe>',
  '<table><thead><tr><th>Col A</th><th>Col B</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table>',
  '<div><h3>Tab label</h3><p>Tab content as sequential section.</p></div>',
  '<ul><li>outer<ul><li>nested list item</li></ul></li></ul>',
  '<img src="https://nx.dev/images/nx-media.jpg" alt="External image">',
  '<p><a href="https://nx.dev/docs">Absolute link</a> and <a href="#heading-two">anchor link</a>.</p>',
].join('\n');

const CHECKS: Array<[string, RegExp]> = [
  ['h2 heading', /<h2/],
  ['class attribute', /class="?test-class/],
  ['blockquote', /<blockquote/],
  ['pre/code block', /<pre/],
  ['code language class', /language-shell/],
  ['details/summary', /<details/],
  ['iframe (youtube embed)', /<iframe/],
  ['table', /<table/],
  ['nested list', /<ul>.*<ul>|<ul[\s\S]*?<ul/],
  ['img', /<img/],
  ['anchor href (#)', /href="?#heading-two/],
  ['emoji', /ℹ️/],
];

async function main(): Promise<void> {
  const me = await getMe();
  console.log(
    `Authed user id (candidate NX_AUTHOR_USER_ID): ${me.id} (${me.email ?? 'no email'})`
  );

  const collections = await listCollections();
  console.log('\nCollections in KB:');
  for (const c of collections) {
    console.log(`  ${c.id}  ${c.title}`);
  }

  console.log('\nCreating probe article (unpublished, unlisted)…');
  const created = await createArticle({
    title: 'ZZZ Sanitizer Probe (safe to delete)',
    author_user_id: NX_AUTHOR_USER_ID,
    body_html: PROBE_HTML,
    is_published: false,
    is_unlisted: true,
  });
  console.log(`Created ${created.id} (${created.url ?? 'no url yet'})`);

  const fetched = await getArticle(created.id);
  const roundTripped =
    fetched.current_draft_content_html ??
    fetched.current_published_content_html ??
    '';

  console.log('\nSanitizer results:');
  for (const [label, pattern] of CHECKS) {
    console.log(
      `  ${pattern.test(roundTripped) ? '✅ kept   ' : '❌ removed'} ${label}`
    );
  }
  console.log('\n--- Round-tripped HTML ---');
  console.log(roundTripped);
  console.log('--- end ---\n');

  await deleteArticle(created.id);
  console.log(`Deleted probe article ${created.id}.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
