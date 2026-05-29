const {
  normalizeOptionalText,
  normalizeTextLines,
} = require('../utils/contentSanitizer');

const escapeHtml = (value = '') => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const toParagraphs = (text = '') => {
  const lines = normalizeTextLines(text);
  if (!lines.length) return '';
  return lines.map((line) => `<p>${escapeHtml(line)}</p>`).join('');
};

const toBulletList = (text = '') => {
  const lines = normalizeTextLines(text);
  if (!lines.length) return '';
  return `<ul class="exp-bullets">${lines.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>`;
};

const renderContactRow = ({ email, phone, location, links = [] } = {}) => {
  const items = [];
  const safeEmailValue = normalizeOptionalText(email);
  const safePhoneValue = normalizeOptionalText(phone);
  const safeLocationValue = normalizeOptionalText(location);

  if (safeEmailValue) {
    const safeEmail = escapeHtml(safeEmailValue);
    items.push(`<a href="mailto:${safeEmail}">${safeEmail}</a>`);
  }

  if (safePhoneValue) {
    const safePhone = escapeHtml(safePhoneValue);
    const phoneHref = escapeHtml(`tel:${String(safePhoneValue).replace(/[^+\d]/g, '') || safePhoneValue}`);
    items.push(`<a href="${phoneHref}">${safePhone}</a>`);
  }

  if (safeLocationValue) {
    items.push(`<span>${escapeHtml(safeLocationValue)}</span>`);
  }

  const normalizedLinks = Array.isArray(links)
    ? links.map(normalizeOptionalText).filter(Boolean)
    : [];

  normalizedLinks.slice(0, 2).forEach((link) => {
    const href = /^https?:\/\//i.test(link) ? link : `https://${link}`;
    items.push(`<a href="${escapeHtml(href)}">${escapeHtml(link)}</a>`);
  });

  if (!items.length) return '';

  const sep = '<span class="contact-sep">·</span>';
  return `<div class="contact-line">${items.join(sep)}</div>`;
};

const renderSkillChips = (skills = []) => {
  const validSkills = Array.isArray(skills)
    ? skills.map(normalizeOptionalText).filter(Boolean)
    : [];

  if (!validSkills.length) return '';

  return `<div class="skill-grid">${validSkills.map((skill) => `<span class="skill-tag">${escapeHtml(skill)}</span>`).join('')}</div>`;
};

const renderLanguages = (languages = []) => {
  if (!Array.isArray(languages) || !languages.length) return '';

  const items = languages
    .map((entry) => {
      if (typeof entry === 'string') {
        const language = normalizeOptionalText(entry);
        return language ? `<span class="lang-item">${escapeHtml(language)}</span>` : '';
      }

      const name = normalizeOptionalText(entry.name);
      const fluency = normalizeOptionalText(entry.fluency || entry.proficiency);
      if (!name && !fluency) return '';

      return `<span class="lang-item">${name ? escapeHtml(name) : ''}${fluency ? `<span class="lang-level">${escapeHtml(fluency)}</span>` : ''}</span>`;
    })
    .filter(Boolean);

  if (!items.length) return '';

  return `<div class="lang-grid">${items.join('')}</div>`;
};

const renderEducation = (education = []) => {
  if (!Array.isArray(education) || !education.length) return '';

  const cards = education
    .map((entry) => {
      const institution = normalizeOptionalText(entry.institution);
      const credential = normalizeOptionalText(entry.credential);
      const years = normalizeOptionalText(entry.years);
      const details = normalizeOptionalText(entry.details);

      if (!institution && !credential && !years && !details) return '';

      return `
        <article class="edu-entry">
          <div class="edu-head">
            ${institution ? `<h3 class="edu-institution">${escapeHtml(institution)}</h3>` : '<div></div>'}
            ${years ? `<span class="edu-years">${escapeHtml(years)}</span>` : ''}
          </div>
          ${credential ? `<p class="edu-credential">${escapeHtml(credential)}</p>` : ''}
          ${details ? `<p class="edu-note">${escapeHtml(details)}</p>` : ''}
        </article>
      `;
    })
    .filter(Boolean);

  if (!cards.length) return '';

  return `<div class="edu-stack">${cards.join('')}</div>`;
};

const renderExperience = (experiences = []) => {
  if (!Array.isArray(experiences) || !experiences.length) return '';

  const cards = experiences
    .map((entry) => {
      const company = normalizeOptionalText(entry.company);
      const role = normalizeOptionalText(entry.role);
      const years = normalizeOptionalText(entry.years);
      const bullets = toBulletList(entry.summary || '');

      if (!company && !role && !years && !bullets) return '';

      return `
        <article class="exp-entry">
          <div class="exp-head">
            ${role || company ? `
              <div class="exp-title-group">
                ${role ? `<h3 class="exp-title">${escapeHtml(role)}</h3>` : ''}
                ${company ? `<p class="exp-company">${escapeHtml(company)}</p>` : ''}
              </div>
            ` : '<div></div>'}
            ${years ? `<span class="exp-years">${escapeHtml(years)}</span>` : ''}
          </div>
          ${bullets}
        </article>
      `;
    })
    .filter(Boolean);

  if (!cards.length) return '';

  return `<div class="exp-stack">${cards.join('')}</div>`;
};

const renderSection = (label, body) => {
  if (!body) return '';

  return `
    <section class="resume-section">
      <div class="section-heading">${escapeHtml(label)}</div>
      <div class="section-body">
        ${body}
      </div>
    </section>
  `;
};

function renderResumeHtml({
  personalInfo = {},
  aboutMe = '',
  skills = [],
  experiences = [],
  education = [],
  languages = [],
} = {}) {
  const name = normalizeOptionalText(personalInfo.name);
  const roleLine = normalizeOptionalText(personalInfo.title) || normalizeOptionalText(experiences[0]?.role);
  const contactMarkup = renderContactRow(personalInfo);

  const headerMarkup = (name || roleLine || contactMarkup) ? `
    <header class="page-header">
      ${name ? `<h1>${escapeHtml(name)}</h1>` : ''}
      ${roleLine ? `<p class="hero-role">${escapeHtml(roleLine)}</p>` : ''}
      ${contactMarkup}
    </header>
  ` : '';

  const contentMarkup = [
    renderSection('Professional Summary', toParagraphs(aboutMe)),
    renderSection('Technical Skills', renderSkillChips(skills)),
    renderSection('Professional Experience', renderExperience(experiences)),
    renderSection('Education', renderEducation(education)),
    renderSection('Languages', renderLanguages(languages)),
  ].filter(Boolean).join('');

  const titleText = escapeHtml(name || roleLine || 'Resume');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${titleText}</title>
    <style>
      @page {
        size: A4;
        margin: 16mm 20mm;
      }
      * {
        box-sizing: border-box;
      }
      html, body {
        background: #ffffff;
        margin: 0;
        padding: 0;
      }
      body {
        font-family: "Calibri", "Gill Sans MT", "Arial", sans-serif;
        font-size: 11px;
        line-height: 1.5;
        color: #1a1a1a;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      /* ── Header ── */
      .page-header {
        text-align: center;
        padding-bottom: 11px;
        margin-bottom: 15px;
        border-bottom: 2px solid #1c3a5e;
      }
      .page-header h1 {
        margin: 0;
        font-family: "Georgia", "Times New Roman", serif;
        font-size: 30px;
        font-weight: 700;
        color: #111111;
        letter-spacing: 0.04em;
        line-height: 1.1;
      }
      .hero-role {
        margin: 6px 0 0;
        font-size: 10px;
        font-weight: 600;
        letter-spacing: 0.24em;
        text-transform: uppercase;
        color: #1c3a5e;
      }
      .contact-line {
        margin-top: 9px;
        display: flex;
        justify-content: center;
        flex-wrap: wrap;
        align-items: center;
        gap: 0;
        font-size: 10px;
        color: #333333;
      }
      .contact-line a {
        color: #1c3a5e;
        text-decoration: none;
      }
      .contact-sep {
        margin: 0 9px;
        color: #bbb;
      }

      /* ── Sections ── */
      .resume-section {
        margin-bottom: 14px;
      }
      .resume-section:last-child {
        margin-bottom: 0;
      }
      .section-heading {
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.22em;
        text-transform: uppercase;
        color: #1c3a5e;
        border-bottom: 1.5px solid #1c3a5e;
        padding-bottom: 3px;
        margin-bottom: 10px;
      }

      /* ── Summary ── */
      .section-body p {
        margin: 0 0 5px;
        font-size: 10.5px;
        color: #2a2a2a;
        line-height: 1.5;
      }
      .section-body p:last-child {
        margin-bottom: 0;
      }

      /* ── Skills ── */
      .skill-grid {
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
      }
      .skill-tag {
        display: inline-block;
        padding: 3px 9px;
        border: 1px solid #c5c5c5;
        border-radius: 3px;
        background: #f6f6f6;
        font-size: 10px;
        font-weight: 500;
        color: #2a2a2a;
        letter-spacing: 0.01em;
      }

      /* ── Experience ── */
      .exp-stack {
        display: grid;
        gap: 13px;
      }
      .exp-entry {
        break-inside: avoid;
        page-break-inside: avoid;
      }
      .exp-head {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 10px;
      }
      .exp-title {
        margin: 0;
        font-size: 12px;
        font-weight: 700;
        color: #111111;
        line-height: 1.2;
      }
      .exp-company {
        margin: 2px 0 5px;
        font-size: 10.5px;
        color: #555555;
        font-style: italic;
      }
      .exp-years {
        flex-shrink: 0;
        font-size: 10px;
        font-weight: 600;
        color: #555555;
        white-space: nowrap;
        padding-top: 2px;
        letter-spacing: 0.03em;
      }
      .exp-bullets {
        margin: 0;
        padding-left: 16px;
      }
      .exp-bullets li {
        margin-bottom: 3px;
        font-size: 10.5px;
        color: #2a2a2a;
        line-height: 1.5;
      }
      .exp-bullets li:last-child {
        margin-bottom: 0;
      }

      /* ── Education ── */
      .edu-stack {
        display: grid;
        gap: 10px;
      }
      .edu-entry {
        break-inside: avoid;
        page-break-inside: avoid;
      }
      .edu-head {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: 10px;
      }
      .edu-institution {
        margin: 0;
        font-size: 11.5px;
        font-weight: 700;
        color: #111111;
      }
      .edu-years {
        flex-shrink: 0;
        font-size: 10px;
        font-weight: 600;
        color: #555555;
        white-space: nowrap;
        letter-spacing: 0.04em;
      }
      .edu-credential {
        margin: 2px 0 0;
        font-size: 10.5px;
        color: #444444;
        font-style: italic;
      }
      .edu-note {
        margin: 3px 0 0;
        font-size: 10px;
        color: #666666;
      }

      /* ── Languages ── */
      .lang-grid {
        display: flex;
        flex-wrap: wrap;
        gap: 22px;
      }
      .lang-item {
        font-size: 10.5px;
        color: #1a1a1a;
      }
      .lang-level {
        margin-left: 6px;
        font-size: 9.5px;
        color: #666666;
        text-transform: uppercase;
        letter-spacing: 0.1em;
      }

      @media print {
        html, body {
          background: #ffffff;
        }
      }
    </style>
  </head>
  <body>
    ${headerMarkup}
    <main>
      ${contentMarkup}
    </main>
  </body>
</html>`;
}

module.exports = {
  renderResumeHtml,
};
