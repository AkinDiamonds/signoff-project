import { chromium } from 'playwright';
import http from 'node:http';
import https from 'node:https';
import { X509Certificate, createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

// Real HTTPS is required for CHIPS verification. The old fulfillment transport
// remains opt-in only to reproduce the diagnostic artifact, never as a passing
// substitute for the native cookie/storage assertion.
const native = process.env.SIGNOFF_BROWSER_TRANSPORT !== 'route-fulfill';
const merchant = `https://merchant.signoff.test${native ? ':8443' : ''}`;
const api = `https://api.signoff-api.test${native ? ':8443' : ''}`;
// Fail before a launch attempt if this fresh workspace has no matching browser.
// Install it explicitly with `npx playwright install chromium` before resuming.
await fs.access(chromium.executablePath());
const report = { transport: native ? 'native-https' : 'route-fulfill', localOnly: true, headers: [], steps: [] };
function observeHeaders(path, headers) {
  if (path === '/api/auth/login') {
    for (const header of headers['set-cookie'] ?? []) {
      report.headers.push({ httpOnly: /;\s*HttpOnly(?:;|$)/i.test(header), secure: /;\s*Secure(?:;|$)/i.test(header), partitioned: /;\s*Partitioned(?:;|$)/i.test(header), sameSiteNone: /;\s*SameSite=None(?:;|$)/i.test(header), hostPrefix: header.startsWith('__Host-'), domainAbsent: !/;\s*Domain=/i.test(header) });
    }
  }
}
let server;
const args = [];
if (native) {
  const cert = await fs.readFile('work/preview-cert.pem');
  const key = await fs.readFile('work/preview-key.pem');
  const spki = new X509Certificate(cert).publicKey.export({ type: 'spki', format: 'der' });
  args.push(`--ignore-certificate-errors-spki-list=${createHash('sha256').update(spki).digest('base64')}`);
  args.push('--host-resolver-rules=MAP merchant.signoff.test 127.0.0.1, MAP api.signoff-api.test 127.0.0.1');
  server = https.createServer({ cert, key }, (request, response) => {
    const port = request.headers.host === 'merchant.signoff.test:8443' ? 5176 : request.headers.host === 'api.signoff-api.test:8443' ? 8042 : null;
    if (!port) { response.writeHead(421).end(); return; }
    const headers = { ...request.headers, host: `127.0.0.1:${port}` };
    delete headers['accept-encoding'];
    const outgoing = http.request({ hostname: '127.0.0.1', port, path: request.url, method: request.method, headers }, incoming => {
      observeHeaders(request.url, incoming.headers);
      response.writeHead(incoming.statusCode, incoming.headers);
      incoming.pipe(response);
    });
    outgoing.on('error', () => { response.writeHead(502).end(); });
    request.pipe(outgoing);
  });
  await new Promise(resolve => server.listen(8443, '127.0.0.1', resolve));
}
const browser = await chromium.launch({
  headless: true, executablePath: chromium.executablePath(), args,
  // The two reserved names resolve only to this local TLS fixture. Preserve the
  // runtime proxy for all other names; never send these local tests to it.
  proxy: native ? { server: process.env.HTTPS_PROXY ?? 'http://proxy:8080', bypass: 'merchant.signoff.test,api.signoff-api.test' } : undefined,
});
report.chromium = browser.version();
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
await context.route('**/*', async route => {
  const request = route.request();
  const url = new URL(request.url());
  const port = url.origin === merchant ? 5176 : url.origin === api ? 8042 : null;
  if (!port) return route.abort();
  if (native) return route.continue();
  const headers = { ...request.headers(), host: `127.0.0.1:${port}` };
  delete headers['accept-encoding'];
  const result = await new Promise((resolve, reject) => {
    const outgoing = http.request({ hostname: '127.0.0.1', port, path: url.pathname + url.search, method: request.method(), headers }, incoming => {
      const chunks = [];
      incoming.on('data', chunk => chunks.push(chunk));
      incoming.on('end', () => resolve({ status: incoming.statusCode, headers: incoming.headers, body: Buffer.concat(chunks) }));
    });
    outgoing.on('error', reject);
    outgoing.end(request.postDataBuffer());
  });
  observeHeaders(url.pathname, result.headers);
  const forwarded = Object.fromEntries(Object.entries(result.headers).filter(([key]) => !['content-length', 'transfer-encoding', 'connection', 'content-encoding'].includes(key)).map(([key, value]) => [key, Array.isArray(value) ? value.join('\n') : String(value)]));
  await route.fulfill({ status: result.status, headers: forwarded, body: result.body });
});
const page = await context.newPage();
try {
  await page.goto(`${merchant}/app/settings`);
  await page.getByLabel('Email', { exact: true }).waitFor();
  report.steps.push('anonymous redirect');
  await page.screenshot({ path: 'work/login-mobile.png', fullPage: true });
  await page.getByLabel('Email', { exact: true }).fill('owner@example.test');
  await page.getByLabel('Password', { exact: true }).fill('fictional-preview-owner-password-123');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByText('Background worker', { exact: true }).waitFor();
  report.steps.push('login and retained session');
  const cookies = await context.cookies(api);
  report.cookies = cookies.map(({ name, domain, path, httpOnly, secure, sameSite, partitionKey }) => ({ name, domain, path, httpOnly, secure, sameSite, partitionKey: partitionKey ?? null }));
  const cdp = await context.newCDPSession(page);
  const raw = await cdp.send('Network.getCookies', { urls: [api] });
  report.cdpCookies = raw.cookies.map(({ name, httpOnly, secure, sameSite, partitionKey }) => ({ name, httpOnly, secure, sameSite, partitionKey: partitionKey ?? null }));
  await fs.writeFile('work/cookie-metadata.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
  const owner = cookies.find(cookie => cookie.name === '__Host-signoff_session');
  assert(owner?.httpOnly && owner.secure && owner.partitionKey, 'Owner cookie must be HttpOnly, Secure and partitioned');
  assert.equal(owner.sameSite, 'None');
  assert.equal(owner.partitionKey, 'https://signoff.test');
  await page.reload();
  await page.getByText('Background worker', { exact: true }).waitFor();
  report.steps.push('authenticated reload');
  const noCsrf = await page.evaluate(async url => (await fetch(`${url}/api/auth/logout`, { method: 'POST', credentials: 'include' })).status, api);
  assert.equal(noCsrf, 403);
  report.steps.push('logout without CSRF denied');
  await page.screenshot({ path: 'work/settings-mobile.png', fullPage: true });
  const logout = page.waitForResponse(response => response.url() === `${api}/api/auth/logout` && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  assert.equal((await logout).status(), 204);
  await page.getByLabel('Email', { exact: true }).waitFor();
  report.steps.push('CSRF-protected UI logout');
  const denied = await page.evaluate(async url => (await fetch(`${url}/api/disputes`, { credentials: 'include' })).status, api);
  assert.equal(denied, 401);
  await page.goto(`${merchant}/app/settings`);
  await page.getByLabel('Email', { exact: true }).waitFor();
  report.steps.push('access denied after logout');
  report.result = 'PASS';
} finally {
  await fs.writeFile('work/cookie-metadata.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ result: report.result ?? 'FAIL', steps: report.steps }));
  await browser.close();
  if (server) await new Promise(resolve => server.close(resolve));
}
