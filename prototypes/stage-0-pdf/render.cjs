const { resolve } = require('node:path');
const { pathToFileURL } = require('node:url');

const packageDirectory = process.env.PLAYWRIGHT_NODE_MODULES;
const outputPath = process.argv[2];

if (!packageDirectory || !outputPath) {
  throw new Error('Set PLAYWRIGHT_NODE_MODULES and provide an absolute output PDF path.');
}

const { chromium } = require(require.resolve('playwright', { paths: [packageDirectory] }));

async function renderPdf() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(pathToFileURL(resolve(__dirname, 'spike.html')).href, {
    waitUntil: 'networkidle',
  });
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({
    path: resolve(outputPath),
    preferCSSPageSize: true,
    printBackground: true,
  });

  await browser.close();
}

renderPdf();
