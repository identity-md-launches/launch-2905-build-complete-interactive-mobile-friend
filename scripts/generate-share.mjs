// Regenerates the local OG image from the original mascot and bundled font.
import { readFile, mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const modulePath = process.argv.find(a => a.startsWith('--playwright-module='))?.split('=').slice(1).join('=');
const { chromium } = await import(modulePath ? pathToFileURL(modulePath).href : 'playwright');
const browser = await chromium.launch({ headless: true });
try {
  const font = (await readFile('src/assets/silkscreen-latin-400-normal.woff2')).toString('base64');
  const mouse = (await readFile('public/assets/mouse.svg')).toString('base64');
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.setContent(`<!doctype html><html lang="en"><head><style>
    @font-face{font-family:Pixel;src:url(data:font/woff2;base64,${font})}
    *{box-sizing:border-box}body{margin:0;background:#0c0e12;color:#f0f2ed;font-family:Arial,sans-serif}
    main{position:relative;width:1200px;height:630px;padding:64px 72px;background-image:radial-gradient(#34333f 1px,transparent 1px);background-size:24px 24px}
    .name{font-family:Pixel;font-size:24px;color:#b4f77c}h1{font-family:Pixel;font-size:54px;line-height:1.2;font-weight:400;margin:60px 0 24px;letter-spacing:-2px}h1 span{color:#b4f77c}p{font-size:23px;line-height:1.5;color:#a2abb7;margin:0}.play{display:inline-block;background:#b4f77c;color:#18220f;padding:16px 28px;margin-top:32px;font-size:20px;font-weight:600;border-radius:4px}
    img{position:absolute;right:48px;top:130px;width:400px;height:400px;image-rendering:pixelated}.footer{position:absolute;bottom:44px;left:72px;font-size:18px;color:#a2abb7}.corner{position:absolute;width:32px;height:32px;border-color:#b4f77c;border-style:solid}.one{top:24px;left:24px;border-width:2px 0 0 2px}.two{bottom:24px;right:24px;border-width:0 2px 2px 0}
    </style></head><body><main><i class="corner one"></i><i class="corner two"></i><div class="name">Squeek Clicker</div><h1>Small mouse.<br><span>Big scores.</span></h1><p>Your next 60-second obsession.<br>Tap. Build a combo. Beat your best.</p><div class="play">Start Game →</div><img src="data:image/svg+xml;base64,${mouse}" alt=""/><div class="footer">Built for the Squeekchain Community</div></main></body></html>`);
  await page.evaluate(() => document.fonts.ready);
  await mkdir('public/assets', { recursive: true });
  await page.screenshot({ path: 'public/assets/share.png' });
  process.stdout.write('Generated public/assets/share.png (1200 × 630)\n');
} finally { await browser.close(); }
