import { cp } from 'node:fs/promises';
const source = process.argv[2];
if (!source) throw new Error('Pass the notary platform/web/src/platform-api/generated directory');
await cp(source, new URL('../src/tools/platform-api/generated', import.meta.url), {recursive: true});
