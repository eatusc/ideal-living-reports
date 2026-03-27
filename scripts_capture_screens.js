const { chromium, devices } = require('playwright');

const base = 'http://localhost:3000';
const pages = [
  { slug: 'home', path: '/' },
  { slug: 'aceteam', path: '/aceteam' },
  { slug: 'elevate', path: '/elevate' },
  { slug: 'lustroware', path: '/lustroware' },
  { slug: 'somarsh', path: '/somarsh' },
  { slug: 'rpd-walmart', path: '/rpd-walmart' },
  { slug: 'rpd-hd', path: '/rpd-hd' },
  { slug: 'pin', path: '/pin' },
];

async function capture(page, slug, path, kind) {
  const url = base + path;
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `screenshots/${slug}-${kind}.png`, fullPage: true });
    return { ok: true, slug, kind };
  } catch (err) {
    await page.screenshot({ path: `screenshots/${slug}-${kind}-error.png`, fullPage: true }).catch(() => {});
    return { ok: false, slug, kind, error: String(err?.message || err) };
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true });

  const desktopContext = await browser.newContext({ viewport: { width: 1720, height: 1024 } });
  await desktopContext.addCookies([{ name: 'pin_auth', value: '1', domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax' }]);
  const desktopPage = await desktopContext.newPage();

  const mobileContext = await browser.newContext({ ...devices['iPhone 13'] });
  await mobileContext.addCookies([{ name: 'pin_auth', value: '1', domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax' }]);
  const mobilePage = await mobileContext.newPage();

  const results = [];
  for (const p of pages) {
    results.push(await capture(desktopPage, p.slug, p.path, 'desktop'));
    results.push(await capture(mobilePage, p.slug, p.path, 'mobile'));
  }

  console.log(JSON.stringify(results, null, 2));

  await desktopContext.close();
  await mobileContext.close();
  await browser.close();
})();
