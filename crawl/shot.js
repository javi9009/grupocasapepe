const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--no-sandbox'] });
  for (const [f,out] of [['vp.html','vp.png'],['vp2.html','vp2.png']]) {
    const p = await b.newPage({ viewport:{width:860,height:1200}, deviceScaleFactor:2 });
    await p.goto('file:///tmp/gcp/crawl/'+f, {waitUntil:'load'});
    await p.waitForTimeout(800);
    const hoja = await p.$('.cxhoja');
    if(!hoja){ console.log(f,'sin modal'); continue; }
    await p.addStyleTag({content:'.cxvelo{position:static !important;padding:0 !important;background:#fff}.cxhoja{max-height:none !important;box-shadow:none}'});
    await p.waitForTimeout(300);
    console.log(f,'huecos:', await p.$$eval('.vp .huecos li', n=>n.map(x=>x.textContent)));
    await hoja.screenshot({ path:out });
    await p.close();
  }
  await b.close();
})();
