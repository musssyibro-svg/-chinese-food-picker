import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const consoleErrors = [];
page.on('pageerror', error => consoleErrors.push(error.message));
page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });

try {
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
  await page.waitForSelector('#language-toggle');

  // PWA manifest must be valid JSON and the app must register its service worker.
  const manifestResponse = await page.request.get('http://127.0.0.1:4173/manifest.webmanifest');
  if (!manifestResponse.ok()) throw new Error('PWA manifest is missing');
  const manifest = await manifestResponse.json();
  if (manifest.name !== 'Chinese Food Picker — 今晚吃什么？' || manifest.start_url !== './') throw new Error('PWA manifest content is invalid');
  await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) throw new Error('Service workers are unsupported in this browser');
    const registration = await navigator.serviceWorker.ready;
    if (!registration.active) throw new Error('Service worker did not activate');
  });

  // First visit should use Simplified Chinese.
  const firstLanguage = await page.locator('html').getAttribute('lang');
  if (firstLanguage !== 'zh-CN') throw new Error(`Expected Chinese first-visit language; got ${firstLanguage}`);

  // Language toggle must switch in both directions and persist.
  await page.locator('#language-toggle').click();
  if (await page.locator('html').getAttribute('lang') !== 'en') throw new Error('Language toggle did not switch to English');
  await page.locator('#language-toggle').click();
  if (await page.locator('html').getAttribute('lang') !== 'zh-CN') throw new Error('Language toggle did not switch back to Chinese');

  // Test the choices that were reported broken.
  await page.locator('#meal-options [data-meal="lunch"]').click();
  if (!await page.locator('#meal-options [data-meal="lunch"]').evaluate(el => el.classList.contains('selected'))) throw new Error('Lunch selection did not update');
  await page.locator('#meal-options [data-meal="dinner"]').click();
  if (!await page.locator('#meal-options [data-meal="dinner"]').evaluate(el => el.classList.contains('selected'))) throw new Error('Dinner selection did not update');
  await page.locator('#plan-options [data-plan="restaurant"]').click();
  if (!await page.locator('#plan-options [data-plan="restaurant"]').evaluate(el => el.classList.contains('selected'))) throw new Error('Restaurant plan selection did not update');
  await page.locator('#mode-options [data-mode="together"]').click();
  if (!await page.locator('#mode-options [data-mode="together"]').evaluate(el => el.classList.contains('selected'))) throw new Error('Two-person mode selection did not update');
  await page.locator('#mode-options [data-mode="solo"]').click();

  // Food filter inputs must remain interactive.
  await page.locator('#diet-checks input[value="vegetarian"]').check();
  if (!await page.locator('#diet-checks input[value="vegetarian"]').isChecked()) throw new Error('Diet filter checkbox did not check');
  await page.locator('#diet-checks input[value="vegetarian"]').uncheck();

  // Every local food-photo category must exist and return a real JPEG.
  const categories = ['chinese-feast','dumpling','drink','egg','soup','noodles','rice','skewer','street','stirfry','tofu','fish','greens','dessert'];
  for (const category of categories) {
    const response = await page.request.get(`http://127.0.0.1:4173/food-images/${category}.jpg`);
    if (!response.ok()) throw new Error(`Photo missing: ${category}.jpg (${response.status()})`);
    const bytes = await response.body();
    if (bytes.length < 1000 || bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error(`Photo is not a valid JPEG: ${category}.jpg`);
  }

  // Requested additions must exist in the app's real food database.
  const foods = await page.evaluate(() => window.FOOD_DATABASE.map(food => food.cn));
  for (const name of ['火鸡面','螺蛳粉','烤冷面','盖浇饭','炒河粉','咖喱饭']) {
    if (!foods.includes(name)) throw new Error('Requested food is missing: ' + name);
  }

  // Main flow: mood -> roulette -> result -> favourite -> reroll.
  await page.locator('#to-mood').click();
  if (!await page.locator('#screen-mood').evaluate(el => el.classList.contains('active'))) throw new Error('Next button did not open mood screen');
  await page.locator('#mood-options [data-mood="comfort"]').click();
  await page.locator('#to-spin').click();
  if (!await page.locator('#screen-spin').evaluate(el => el.classList.contains('active'))) throw new Error('Play button did not open roulette screen');
  await page.locator('#spin-button').click();
  // Roulette must not reveal its default/previous dish before the suspense reveal.
  if (await page.locator('#spin-image').getAttribute('src')) throw new Error('Roulette previews a dish before the user spins');
  await page.locator('#result-detail.visible').waitFor({ timeout: 15000 });
  await page.waitForFunction(() => {
    const img = document.querySelector('#spin-image');
    return img && img.complete && img.naturalWidth > 0;
  }, { timeout: 10000 });
  if (await page.locator('#spin-image').evaluate(img => img.naturalWidth) < 100) throw new Error('Selected food photograph did not render');
  await page.locator('#save-favorite').click();
  await page.locator('#open-favorites').click();
  if (!await page.locator('#favorites-dialog').evaluate(el => el.open || el.hasAttribute('open'))) throw new Error('Favourites dialog did not open');
  await page.locator('#close-favorites').click();
  await page.locator('#reroll-button').click();
  await page.locator('#result-detail.visible').waitFor({ timeout: 15000 });

  if (consoleErrors.length) throw new Error('Browser errors: ' + consoleErrors.join(' | '));
  console.log('PASS: language toggle, meal/plan/mode selections, filters, roulette, reroll, favorites and all photo files.');
} finally {
  await browser.close();
}
