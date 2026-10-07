import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import openapiTS, { astToString } from 'openapi-typescript';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageRoot = path.resolve(__dirname, '..');
const openApiPath = path.resolve(packageRoot, 'openapi.json');
const outputPath = path.resolve(packageRoot, 'src', 'generated', 'schema.ts');

if (!fs.existsSync(openApiPath)) {
  console.error(
    `Error: openapi.json not found at ${openApiPath}.\n` +
      `Please run 'make api-types' first to export the schema from FastAPI.`
  );
  process.exit(1);
}

try {
  const ast = await openapiTS(new URL(`file://${path.resolve(openApiPath).replace(/\\/g, '/')}`));
  const contents = astToString(ast);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, contents, 'utf-8');
  console.log(`Successfully generated TypeScript types: ${outputPath}`);
} catch (err) {
  console.error('Error generating TypeScript types from openapi.json:', err);
  process.exit(1);
}
