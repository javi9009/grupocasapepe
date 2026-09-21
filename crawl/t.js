const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args:['--no-sandbox','--disable-blink-features=AutomationControlled'] });
  const ctx = await b.newContext({ locale:'es-MX', timezoneId:'America/Mexico_City',
    userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
    viewport:{width:1366,height:900} });
  const p = await ctx.newPage();
  const r = await p.goto('https://www.viator.com/es-MX/tours/Mexico-City/x/d628-35437P1', { waitUntil:'domcontentloaded', timeout:45000 });
  console.log('status', r && r.status());
  await p.waitForTimeout(3000);
  const has = await p.evaluate(() => !!(window.__PRELOADED_DATA__ && window.__PRELOADED_DATA__.pageModel && window.__PRELOADED_DATA__.pageModel.product));
  const title = await p.title();
  console.log('preloaded', has, '| title', title.slice(0,70));
  await b.close();
})().catch(e => { console.log('ERR', e.message.slice(0,200)); process.exit(1); });
