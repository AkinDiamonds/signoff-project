import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import openapiTS, { astToString } from 'openapi-typescript';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const packageRoot = path.join(repoRoot, 'signoff/packages/api-client');
const spec = new URL(`file://${path.join(packageRoot, 'openapi.json').replaceAll('\\', '/')}`);
const expected = astToString(await openapiTS(spec));
const actual = await fs.readFile(path.join(packageRoot, 'src/generated/schema.ts'), 'utf8');
if (actual !== expected) {
  console.error('API client is stale. Run make api-types and review the generated changes.');
  process.exitCode = 1;
} else {
  console.log('API client matches OpenAPI (checked without rewriting tracked files).');
}
