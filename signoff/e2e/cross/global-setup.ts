import { request } from '@playwright/test';

const AGENT_URL = process.env.AGENT_URL ?? 'http://localhost:8000';
const STUB_URL = process.env.STUB_URL ?? 'http://localhost:4010';

export default async function globalSetup(): Promise<void> {
  const ctx = await request.newContext();
  try {
    const targets: ReadonlyArray<readonly [string, string]> = [
      [`${AGENT_URL}/readyz`, 'agent'],
      [`${STUB_URL}/health`, 'stub'],
    ];
    for (const [url, name] of targets) {
      const res = await ctx.get(url, { timeout: 2000 }).catch(() => null);
      if (!res || !res.ok()) {
        throw new Error(`${name} is not ready at ${url}. Start the stack with "make e2e-stack".`);
      }
    }
  } finally {
    await ctx.dispose();
  }
}
