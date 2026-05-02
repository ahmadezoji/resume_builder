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
  return `<div class="bullet-list">${lines.map((line) => `<p class="bullet-line">${escapeHtml(line)}</p>`).join('')}</div>`;
};

const renderContactRow = ({ email, phone, location, links = [] } = {}) => {
  const items = [];
  const safeEmailValue = normalizeOptionalText(email);
  const safePhoneValue = normalizeOptionalText(phone);
  const safeLocationValue = normalizeOptionalText(location);

  if (safeEmailValue) {
    const safeEmail = escapeHtml(safeEmailValue);
    items.push(`<a class="contact-chip" href="mailto:${safeEmail}">${safeEmail}</a>`);
  }

  if (safePhoneValue) {
    const safePhone = escapeHtml(safePhoneValue);
    const phoneHref = escapeHtml(`tel:${String(safePhoneValue).replace(/[^+\d]/g, '') || safePhoneValue}`);
    items.push(`<a class="contact-chip" href="${phoneHref}">${safePhone}</a>`);
  }

  if (safeLocationValue) {
    items.push(`<span class="contact-chip">${escapeHtml(safeLocationValue)}</span>`);
  }

  const normalizedLinks = Array.isArray(links)
    ? links.map(normalizeOptionalText).filter(Boolean)
    : [];

  normalizedLinks.slice(0, 2).forEach((link) => {
    const href = /^https?:\/\//i.test(link) ? link : `https://${link}`;
    items.push(`<a class="contact-chip" href="${escapeHtml(href)}">${escapeHtml(link)}</a>`);
  });

  if (!items.length) {
    return '';
  }

  return `<div class="contact-list">${items.join('')}</div>`;
};

const renderSkillChips = (skills = []) => {
  const validSkills = Array.isArray(skills)
    ? skills.map(normalizeOptionalText).filter(Boolean)
    : [];

  if (!validSkills.length) {
    return '';
  }

  return `<div class="skill-cloud">${validSkills.map((skill) => `<span class="skill-pill">${escapeHtml(skill)}</span>`).join('')}</div>`;
};

const renderLanguages = (languages = []) => {
  if (!Array.isArray(languages) || !languages.length) {
    return '';
  }

  const rows = languages
    .map((entry) => {
      if (typeof entry === 'string') {
        const language = normalizeOptionalText(entry);
        return language ? `<li><span>${escapeHtml(language)}</span></li>` : '';
      }

      const name = normalizeOptionalText(entry.name);
      const fluency = normalizeOptionalText(entry.fluency || entry.proficiency);
      if (!name && !fluency) return '';

      return `
        <li>
          ${name ? `<span>${escapeHtml(name)}</span>` : ''}
          ${fluency ? `<strong>${escapeHtml(fluency)}</strong>` : ''}
        </li>
      `;
    })
    .filter(Boolean);

  if (!rows.length) {
    return '';
  }

  return `<ul class="detail-list">${rows.join('')}</ul>`;
};

const renderEducation = (education = []) => {
  if (!Array.isArray(education) || !education.length) {
    return '';
  }

  const cards = education
    .map((entry) => {
      const institution = normalizeOptionalText(entry.institution);
      const credential = normalizeOptionalText(entry.credential);
      const years = normalizeOptionalText(entry.years);
      const details = normalizeOptionalText(entry.details);

      if (!institution && !credential && !years && !details) {
        return '';
      }

      return `
        <article class="mini-entry">
          ${institution ? `<h3>${escapeHtml(institution)}</h3>` : ''}
          ${credential || years ? `
            <div class="mini-meta">
              ${credential ? `<span>${escapeHtml(credential)}</span>` : ''}
              ${years ? `<strong>${escapeHtml(years)}</strong>` : ''}
            </div>
          ` : ''}
          ${details ? `<p class="entry-note">${escapeHtml(details)}</p>` : ''}
        </article>
      `;
    })
    .filter(Boolean);

  if (!cards.length) {
    return '';
  }

  return `<div class="mini-stack">${cards.join('')}</div>`;
};

const renderExperience = (experiences = []) => {
  if (!Array.isArray(experiences) || !experiences.length) {
    return '';
  }

  const cards = experiences
    .map((entry) => {
      const company = normalizeOptionalText(entry.company);
      const role = normalizeOptionalText(entry.role);
      const years = normalizeOptionalText(entry.years);
      const summary = toBulletList(entry.summary || '');

      if (!company && !role && !years && !summary) {
        return '';
      }

      return `
        <article class="experience-card">
          ${role || company || years ? `
            <div class="experience-head">
              ${role || company ? `
                <div class="experience-title-group">
                  ${role ? `<h3>${escapeHtml(role)}</h3>` : ''}
                  ${company ? `<p class="experience-company">${escapeHtml(company)}</p>` : ''}
                </div>
              ` : '<div></div>'}
              ${years ? `<span class="item-years">${escapeHtml(years)}</span>` : ''}
            </div>
          ` : ''}
          ${summary}
        </article>
      `;
    })
    .filter(Boolean);

  if (!cards.length) {
    return '';
  }

  return `<div class="experience-stack">${cards.join('')}</div>`;
};

const renderSection = (label, body, options = {}) => {
  if (!body) {
    return '';
  }

  const tone = options.tone || 'main';

  return `
    <section class="section section-${tone}">
      <div class="section-label">${escapeHtml(label)}</div>
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
  const summarySection = renderSection('Professional Summary', toParagraphs(aboutMe), { tone: 'main' });
  const contactMarkup = renderContactRow(personalInfo);
  const skillsSection = renderSection('Technical Skills', renderSkillChips(skills), { tone: 'aside' });
  const experienceSection = renderSection('Professional Experience', renderExperience(experiences), { tone: 'main' });
  const educationSection = renderSection('Education', renderEducation(education), { tone: 'aside' });
  const languagesSection = renderSection('Languages', renderLanguages(languages), { tone: 'aside' });
  const heroIdentity = [
    name ? `<h1>${escapeHtml(name)}</h1>` : '',
    roleLine ? `<p class="hero-role">${escapeHtml(roleLine)}</p>` : '',
    contactMarkup,
  ].filter(Boolean).join('');
  const headerMarkup = heroIdentity
    ? `
      <header class="hero">
        <div class="hero-identity">${heroIdentity}</div>
      </header>
    `
    : '';

  const contentMarkup = [
    summarySection,
    skillsSection,
    experienceSection,
    educationSection,
    languagesSection,
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
        margin: 9mm;
      }
      * {
        box-sizing: border-box;
      }
      html {
        background: #f1ede7;
      }
      body {
        margin: 0;
        background: #f1ede7;
        color: #1f2937;
        font-family: "Aptos", "Segoe UI", sans-serif;
        font-size: 12px;
        line-height: 1.5;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .sheet {
        width: 100%;
        overflow: hidden;
        border: 1px solid #ddd5ca;
        border-radius: 22px;
        background: #fffdfa;
        box-shadow: 0 14px 32px rgba(24, 35, 29, 0.08);
      }
      .hero {
        padding: 24px 28px 18px;
        background: linear-gradient(135deg, #143126 0%, #1e4438 62%, #7a5b35 100%);
        color: #fbf7f1;
      }
      .hero h1 {
        margin: 0;
        color: #ffffff;
        font-family: "Georgia", "Times New Roman", serif;
        font-size: 31px;
        line-height: 0.98;
        letter-spacing: 0.03em;
      }
      .hero-role {
        margin: 8px 0 0;
        color: rgba(251, 247, 241, 0.88);
        font-size: 11.5px;
        font-weight: 600;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }
      .contact-list {
        margin-top: 12px;
        display: flex;
        flex-wrap: wrap;
        gap: 7px;
      }
      .contact-chip {
        display: inline-flex;
        align-items: center;
        min-height: 26px;
        padding: 5px 10px;
        border-radius: 999px;
        border: 1px solid rgba(255, 255, 255, 0.18);
        background: rgba(255, 255, 255, 0.12);
        color: inherit;
        text-decoration: none;
        font-size: 10.5px;
      }
      .content {
        padding: 16px 20px 20px;
      }
      .section {
        margin-bottom: 12px;
      }
      .section:last-child {
        margin-bottom: 0;
      }
      .section-main {
        break-inside: auto;
        page-break-inside: auto;
      }
      .section-aside {
        break-inside: avoid;
        page-break-inside: avoid;
      }
      .section-label {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 8px;
        color: #173328;
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.2em;
        text-transform: uppercase;
      }
      .section-main .section-label::before {
        content: "";
        width: 38px;
        height: 2px;
        border-radius: 999px;
        background: linear-gradient(90deg, #1e4c3d, #ab8452);
      }
      .section-aside {
        padding: 12px 13px 13px;
        border: 1px solid #e8dece;
        border-radius: 16px;
        background: #fffdfa;
      }
      .section-aside .section-label {
        margin-bottom: 8px;
      }
      .section-aside .section-label::before {
        content: "";
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: linear-gradient(135deg, #1f4b3d, #ab8452);
      }
      .skill-cloud {
        display: flex;
        flex-wrap: wrap;
        gap: 7px;
      }
      .skill-pill {
        display: inline-flex;
        align-items: center;
        padding: 6px 9px;
        border-radius: 10px;
        border: 1px solid #ddd1bf;
        background: #f2ece2;
        color: #1f3e33;
        font-size: 10.5px;
        font-weight: 600;
        line-height: 1.25;
      }
      .experience-stack {
        display: grid;
        gap: 10px;
      }
      .experience-card {
        padding: 12px 14px 12px;
        border: 1px solid #e7dccb;
        border-left: 4px solid #1e4c3d;
        border-radius: 16px;
        background: #ffffff;
        break-inside: avoid;
        page-break-inside: avoid;
      }
      .experience-head {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        align-items: flex-start;
        flex-wrap: wrap;
        margin-bottom: 6px;
      }
      .experience-title-group {
        min-width: 0;
      }
      .experience-title-group h3 {
        margin: 0;
        color: #132a22;
        font-size: 15px;
        line-height: 1.18;
      }
      .experience-company {
        margin: 3px 0 0;
        color: #687368;
        font-size: 10.5px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }
      .item-years {
        flex-shrink: 0;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 24px;
        max-width: 100%;
        padding: 4px 9px;
        border-radius: 999px;
        background: #efe5d7;
        color: #6a4a26;
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        text-align: center;
        overflow-wrap: anywhere;
      }
      .bullet-list {
        margin: 0;
      }
      .bullet-line {
        position: relative;
        margin: 0 0 5px;
        padding-left: 15px;
        color: #26352d;
      }
      .bullet-line:last-child {
        margin-bottom: 0;
      }
      .bullet-line::before {
        content: "";
        position: absolute;
        top: 0.58em;
        left: 0;
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #244f41;
        box-shadow: 0 0 0 3px rgba(36, 79, 65, 0.10);
      }
      .mini-stack {
        display: grid;
        gap: 10px;
      }
      .mini-entry {
        padding: 10px 11px 10px;
        border: 1px solid #eadfcd;
        border-radius: 14px;
        background: #fcfaf6;
        break-inside: avoid;
        page-break-inside: avoid;
      }
      .mini-entry h3 {
        margin: 0;
        color: #163126;
        font-size: 13px;
        line-height: 1.25;
      }
      .mini-meta {
        display: flex;
        justify-content: space-between;
        gap: 10px;
        margin-top: 6px;
        color: #5b675e;
        font-size: 10.5px;
      }
      .mini-meta strong {
        color: #7b5a30;
        font-size: 10px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .entry-note {
        margin: 8px 0 0;
        color: #606960;
        font-size: 10.5px;
      }
      .detail-list {
        display: grid;
        gap: 8px;
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .detail-list li {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        align-items: flex-start;
        padding-bottom: 10px;
        border-bottom: 1px solid #ede3d5;
      }
      .detail-list li:last-child {
        padding-bottom: 0;
        border-bottom: none;
      }
      .detail-list span {
        color: #26352d;
      }
      .detail-list strong {
        color: #7b5a30;
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        text-align: right;
      }
      @media print {
        html,
        body {
          background: #ffffff;
        }
        .sheet {
          border: none;
          border-radius: 0;
          box-shadow: none;
        }
      }
    </style>
  </head>
  <body>
    <article class="sheet">
      ${headerMarkup}
      <main class="content">
        ${contentMarkup}
      </main>
    </article>
  </body>
</html>`;
}

module.exports = {
  renderResumeHtml,
};
