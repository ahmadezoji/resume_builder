const {
  normalizeOptionalText,
} = require('../utils/contentSanitizer');

const escapeHtml = (value = '') => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

function normalizeParagraphs(text = '') {
  return String(text)
    .split(/\n{2,}/)
    .map((paragraph) => normalizeOptionalText(paragraph.replace(/\n+/g, ' ').trim()))
    .filter(Boolean);
}

function renderContactRow({ email, phone, location, links = [] } = {}) {
  const items = [
    normalizeOptionalText(email),
    normalizeOptionalText(phone),
    normalizeOptionalText(location),
    ...(Array.isArray(links) ? links.map(normalizeOptionalText).filter(Boolean).slice(0, 2) : []),
  ].filter(Boolean);

  if (!items.length) {
    return '';
  }

  return `
    <div class="contact-row">
      ${items.map((item) => `<span>${escapeHtml(item)}</span>`).join('<span class="contact-sep">|</span>')}
    </div>
  `;
}

function renderCoverLetterHtml({
  personalInfo = {},
  jobTitle = '',
  coverLetter = '',
} = {}) {
  const candidateName = normalizeOptionalText(personalInfo.name);
  const title = normalizeOptionalText(jobTitle);
  const contactRow = renderContactRow(personalInfo);
  const paragraphs = normalizeParagraphs(coverLetter || 'Cover letter content was not generated.');
  const bodyMarkup = paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('');
  const documentTitle = escapeHtml(candidateName || title || 'Cover Letter');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${documentTitle}</title>
    <style>
      @page {
        size: A4;
        margin: 18mm 16mm;
      }
      * {
        box-sizing: border-box;
      }
      body {
        margin: 0;
        color: #1f2937;
        background: #ffffff;
        font-family: "Aptos", "Segoe UI", sans-serif;
        font-size: 12px;
        line-height: 1.7;
      }
      .sheet {
        min-height: 100vh;
      }
      .header {
        margin-bottom: 28px;
        padding-bottom: 14px;
        border-bottom: 1px solid #dbe3db;
      }
      h1 {
        margin: 0;
        font-size: 24px;
        line-height: 1.1;
        color: #163126;
      }
      .subtitle {
        margin: 6px 0 0;
        color: #486353;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.16em;
      }
      .contact-row {
        margin-top: 12px;
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        color: #4b5563;
        font-size: 11px;
      }
      .contact-sep {
        color: #9ca3af;
      }
      .body p {
        margin: 0 0 14px;
      }
      .body p:last-child {
        margin-bottom: 0;
      }
    </style>
  </head>
  <body>
    <article class="sheet">
      <header class="header">
        ${candidateName ? `<h1>${escapeHtml(candidateName)}</h1>` : ''}
        <p class="subtitle">${escapeHtml(title || 'Cover Letter')}</p>
        ${contactRow}
      </header>
      <main class="body">
        ${bodyMarkup}
      </main>
    </article>
  </body>
</html>`;
}

module.exports = {
  renderCoverLetterHtml,
};
