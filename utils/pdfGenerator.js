const puppeteer = require('puppeteer');

let browserPromise;

async function getBrowser() {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
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
  const pdfBuffer = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: {
      top: '0.5in',
      right: '0.5in',
      bottom: '0.5in',
      left: '0.5in',
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
