import { access, cp, mkdir, readFile, rm } from 'node:fs/promises';

const publicFiles = [
  'index.html',
  'styles.css',
  'app.js',
  'data/pool.json',
  'data/results.json',
];

const privatePatterns = [
  /api[_-]?key/i,
  /password/i,
  /bearer\s+[a-z0-9._-]+/i,
  /C:\\Users\\/i,
  /OneDrive/i,
  /Downloads/i,
  /OPENAI/i
];

for (const file of publicFiles) {
  await access(new URL(`../${file}`, import.meta.url));
}

const textFiles = ['index.html', 'styles.css', 'app.js', 'data/pool.json', 'data/results.json'];
for (const file of textFiles) {
  const text = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
  const hit = privatePatterns.find((pattern) => pattern.test(text));
  if (hit) throw new Error(`Private/deployment-unsafe text matched in ${file}: ${hit}`);
}

const pool = JSON.parse(await readFile(new URL('../data/pool.json', import.meta.url), 'utf8'));
const results = JSON.parse(await readFile(new URL('../data/results.json', import.meta.url), 'utf8'));

if (!Array.isArray(pool.players) || pool.players.length === 0) throw new Error('Pool players are missing.');
if (!Array.isArray(pool.leaderboard) || pool.leaderboard.length === 0) throw new Error('Leaderboard is missing.');
if (!Array.isArray(pool.roundOf32Picks) || pool.roundOf32Picks.length === 0) throw new Error('Round of 32 picks are missing.');
if (!Array.isArray(results.matches) || results.matches.length === 0) throw new Error('Results matches are missing.');

const dist = new URL('../dist/', import.meta.url);
await rm(dist, { recursive: true, force: true });
await mkdir(new URL('./data/', dist), { recursive: true });

await cp(new URL('../index.html', import.meta.url), new URL('./index.html', dist));
await cp(new URL('../styles.css', import.meta.url), new URL('./styles.css', dist));
await cp(new URL('../app.js', import.meta.url), new URL('./app.js', dist));
await cp(new URL('../data/pool.json', import.meta.url), new URL('./data/pool.json', dist));
await cp(new URL('../data/results.json', import.meta.url), new URL('./data/results.json', dist));

console.log('Static Vercel build passed. Output written to dist/.');
