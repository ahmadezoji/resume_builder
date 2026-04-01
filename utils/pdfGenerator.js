const puppeteer = require('puppeteer');
const fs = require('fs');

let browserPromise;

function resolveChromeExecutablePath() {
  const candidates = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ].filter(Boolean);

  return candidates.find((candidate) => fs.existsSync(candidate));
}

async function getBrowser() {
  if (!browserPromise) {
    const executablePath = resolveChromeExecutablePath();
    browserPromise = puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      ...(executablePath ? { executablePath } : {}),
    });
  }
  return browserPromise;
}

async function generatePdfFromHtml(html) {
  if (!html) {
    throw new Error('HTML content is required to render a PDF.');
  }

  const browser = await getBrowser();
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  await page.emulateMediaType('print');
  await page.evaluate(async () => {
    if (document.fonts?.ready) {
      await document.fonts.ready;
    }
  });
  const pdfBuffer = await page.pdf({
    format: 'A4',
    printBackground: true,
    preferCSSPageSize: true,
    margin: {
      top: '0',
      right: '0',
      bottom: '0',
      left: '0',
    },
  });
  await page.close();
  return pdfBuffer;
}

process.on('exit', () => {
  if (browserPromise) {
    browserPromise
      .then((browser) => browser.close())
      .catch(() => {});
  }
});

module.exports = {
  generatePdfFromHtml,
};
