const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1720, height: 1024 } });
  const page = await context.newPage();
  await page.goto('http://localhost:3000/pin?next=%2F', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'screenshots/pin-desktop.png', fullPage: true });
  await browser.close();
})();
