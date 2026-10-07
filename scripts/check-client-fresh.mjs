import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

console.log('Running API client generation check...');
try {
  // Step 1: Run generator
  execSync('node signoff/packages/api-client/scripts/generate.mjs', {
    cwd: repoRoot,
    stdio: 'inherit',
  });

  // Step 2: Check git diff
  execSync(
    'git diff --exit-code signoff/packages/api-client/src/generated/schema.ts',
    {
      cwd: repoRoot,
      encoding: 'utf-8',
    }
  );

  console.log('[OK] Generated API client is fresh and matches openapi.json.');
} catch {
  console.error('\n[FAIL] FAILURE: Generated API client is stale or has uncommitted modifications.');
  console.error(
    'Run `npm run generate` or `make api-types` and do not manually edit files in `src/generated/`.\n'
  );
  process.exit(1);
}
