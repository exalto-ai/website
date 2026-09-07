// Copy audit for the exalto.ai landing site. Enforces the QA checklist from
// the design handoff: banned vocabulary absent, required doctrine strings
// present verbatim, and no em- or en-dashes in
// rendered copy. Runs before every build.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const stripTags = (source) => source.replace(/<[^>]+>/g, '');

const html = read('index.html');
const llms = read('public/llms.txt');
const text = stripTags(html);

const failures = [];

const banned = [
  [/\balice\b/i, 'Alice signer persona (use the server-supplied signer identity)'],
  [/notariz/i, 'notarize/notarization (say seal/sealing)'],
  [/finaliz/i, 'finaliz* (retired vocabulary; say seal)'],
  [/checkpoint/i, 'checkpoint (reserved for the runtime private capture state)'],
  [/only a fingerprint/i, 'only a fingerprint (the notary relays and witnesses ciphertext)'],
  [/any API/i, 'any API (say supported providers)'],
  [/open and audited/i, 'open and audited (no audit claim)'],
  [/tamper-proof/i, 'tamper-proof (say tamper-evident)'],
  [/perfect audit trail/i, 'perfect audit trail'],
  [/\boracle\b/i, 'oracle'],
  [/human-authored/i, 'human-authored (say tracked local contribution)'],
  [/guaranteed compliance/i, 'guaranteed compliance'],
  [/court-ready/i, 'court-ready'],
  [/preserves privilege/i, 'preserves privilege'],
  [/receipts for AI work/i, 'receipts for AI work'],
  [/Was this AI/i, 'Was this AI'],
  [/[—–]/, 'em- or en-dash in rendered copy'],
];

const scanned = [
  ['index.html', html],
  ['llms.txt', llms],
];
for (const [pattern, label] of banned) {
  for (const [name, source] of scanned) {
    if (pattern.test(source)) failures.push(`${name} contains banned copy: ${label}`);
  }
}

const legalFooter =
  'Exalto Seal is not a notary public. Sealing is not a notarial act. A receipt is cryptographic evidence, not a legal instrument. The ENP specification uses "notary" as a technical role term, in the way public-key infrastructure uses "certificate authority."';

const required = [
  legalFooter,
  'A trace proves presence, never absence.',
  "Exalto Seal is just one notary among many to come: seal with ours, with a third party's, or with one you run yourself.",
  'Built on TLSNotary',
  'The session already happens. Everything in blue is what the protocol adds: the witness in its path, the receipt, the portable, verified trace.',
  'Nothing readable ever leaves your machine.',
  'The named notary witnessed them at the stated time.',
];
for (const value of required) {
  if (!text.includes(value)) failures.push(`index.html is missing required copy: ${JSON.stringify(value)}`);
}

const tileOrder = [
  'Proof of Thought',
  'The flagged essay',
  'The audited commit',
  'The certified trace',
  'The agent flight recorder',
  'The certified discovery archive',
  'The published eval',
  'The take-home',
  'Yours to build',
];
const gridStart = html.indexOf('class="app-grid"');
let cursor = gridStart;
for (const title of tileOrder) {
  const next = html.indexOf(`<h3>${title}</h3>`, cursor);
  if (next === -1) {
    failures.push(`applications grid is missing or misorders the tile: ${title}`);
    break;
  }
  cursor = next;
}

if (!/61<span>%<\/span>/.test(html) || !/verified human/i.test(text)) {
  failures.push('The PoT score card must show 61% with the "verified human" claim');
}

if (failures.length) {
  for (const failure of failures) process.stderr.write(`${failure}\n`);
  process.exit(1);
}
process.stdout.write('Landing copy matches the handoff QA checklist.\n');
