const escapeHtml = (value = '') => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const normalizeTextLines = (text = '') => String(text)
  .split(/\n+/)
  .map((line) => line.replace(/^[•\-\u2022]+\s*/, '').trim())
  .filter(Boolean);

const toParagraphs = (text = '') => {
  const lines = normalizeTextLines(text);
  if (!lines.length) return '<p class="muted">Not provided.</p>';
  return lines.map((line) => `<p>${escapeHtml(line)}</p>`).join('');
};

const toBulletList = (text = '') => {
  const lines = normalizeTextLines(text);
  if (!lines.length) return '<p class="muted">Details unavailable.</p>';
  return `<ul class="bullet-list">${lines.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>`;
};

const renderContactRow = ({ email, phone, location, links = [] } = {}) => {
  const items = [];

  if (email) {
    const safeEmail = escapeHtml(email);
    items.push(`<a href="mailto:${safeEmail}">${safeEmail}</a>`);
  }

  if (phone) {
    const safePhone = escapeHtml(phone);
    const phoneHref = escapeHtml(`tel:${String(phone).replace(/[^+\d]/g, '') || phone}`);
    items.push(`<a href="${phoneHref}">${safePhone}</a>`);
  }

  if (location) {
    items.push(`<span>${escapeHtml(location)}</span>`);
  }

  const normalizedLinks = Array.isArray(links)
    ? links.map((link) => (typeof link === 'string' ? link.trim() : '')).filter(Boolean)
    : [];

  normalizedLinks.slice(0, 2).forEach((link) => {
    const href = /^https?:\/\//i.test(link) ? link : `https://${link}`;
    items.push(`<a href="${escapeHtml(href)}">${escapeHtml(link)}</a>`);
  });

  if (!items.length) {
    return '<p class="meta-line muted">Contact information unavailable.</p>';
  }

  return `<div class="meta-line">${items.join('<span class="meta-sep"></span>')}</div>`;
};

const renderSkillChips = (skills = []) => {
  const validSkills = Array.isArray(skills)
    ? skills.map((skill) => (typeof skill === 'string' ? skill.trim() : '')).filter(Boolean)
    : [];

  if (!validSkills.length) {
    return '<p class="muted">Skills available upon request.</p>';
  }

  return `<div class="chip-grid">${validSkills.map((skill) => `<span class="chip">${escapeHtml(skill)}</span>`).join('')}</div>`;
};

const renderLanguages = (languages = []) => {
  if (!Array.isArray(languages) || !languages.length) {
    return '<p class="muted">Languages not specified.</p>';
  }

  const rows = languages
    .map((entry) => {
      if (typeof entry === 'string') {
        return `<li>${escapeHtml(entry)}</li>`;
      }
      const name = escapeHtml(entry.name || '');
      const fluency = escapeHtml(entry.fluency || entry.proficiency || '');
      if (!name && !fluency) return '';
      return `<li><span>${name || 'Language'}</span>${fluency ? `<strong>${fluency}</strong>` : ''}</li>`;
    })
    .filter(Boolean);

  if (!rows.length) {
    return '<p class="muted">Languages not specified.</p>';
  }

  return `<ul class="compact-list">${rows.join('')}</ul>`;
};

const renderEducation = (education = []) => {
  if (!Array.isArray(education) || !education.length) {
    return '<p class="muted">Education summary unavailable.</p>';
  }

  return education.map((entry) => {
    const institution = escapeHtml(entry.institution || 'Institution');
    const credential = escapeHtml(entry.credential || '');
    const years = escapeHtml(entry.years || '');
    const details = entry.details ? `<p class="item-notes">${escapeHtml(entry.details)}</p>` : '';

    return `
      <article class="timeline-item compact">
        <div class="timeline-rail">
          <span class="timeline-dot"></span>
        </div>
        <div class="timeline-content">
          <div class="item-topline">
            <h3>${institution}</h3>
            ${years ? `<span class="item-years">${years}</span>` : ''}
          </div>
          ${credential ? `<p class="item-subtitle">${credential}</p>` : ''}
          ${details}
        </div>
      </article>
    `;
  }).join('');
};

const renderExperience = (experiences = []) => {
  if (!Array.isArray(experiences) || !experiences.length) {
    return '<p class="muted">No work experiences were generated.</p>';
  }

  return experiences.map((entry) => {
    const company = escapeHtml(entry.company || 'Company');
    const role = escapeHtml(entry.role || 'Role');
    const years = escapeHtml(entry.years || '');

    return `
      <article class="timeline-item">
        <div class="timeline-rail">
          <span class="timeline-dot"></span>
        </div>
        <div class="timeline-content">
          <div class="item-topline">
            <div>
              <h3>${role}</h3>
              <p class="item-subtitle">${company}</p>
            </div>
            ${years ? `<span class="item-years">${years}</span>` : ''}
          </div>
          ${toBulletList(entry.summary || '')}
        </div>
      </article>
    `;
  }).join('');
};

const renderSection = (label, body, options = {}) => `
  <section class="section ${options.compact ? 'section-compact' : ''}">
    <div class="section-title">${escapeHtml(label)}</div>
    <div class="section-body">
      ${body}
    </div>
  </section>
`;

function renderResumeHtml({
  personalInfo = {},
  aboutMe = '',
  skills = [],
  experiences = [],
  education = [],
  languages = [],
} = {}) {
  const name = escapeHtml(personalInfo.name || 'Candidate Name');
  const roleLine = escapeHtml(
    personalInfo.title
      || experiences[0]?.role
      || 'Professional Resume'
  );
  const summaryMarkup = toParagraphs(aboutMe || 'No tailored summary generated.');
  const contactMarkup = renderContactRow(personalInfo);
  const skillsMarkup = renderSkillChips(skills);
  const educationMarkup = renderEducation(education);
  const languagesMarkup = renderLanguages(languages);
  const experienceMarkup = renderExperience(experiences);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${name} - Resume</title>
    <style>
      @page {
        size: A4;
        margin: 12mm;
      }
      * {
        box-sizing: border-box;
      }
      html {
        background: #eef1eb;
      }
      body {
        margin: 0;
        background:
          radial-gradient(circle at top left, rgba(151, 179, 132, 0.18), transparent 28%),
          linear-gradient(180deg, #f4f7f1 0%, #eef1eb 100%);
        color: #1f2937;
        font-family: "Aptos", "Segoe UI", sans-serif;
        font-size: 12px;
        line-height: 1.45;
      }
      .sheet {
        width: 100%;
        background: #ffffff;
        border: 1px solid #d8dfd2;
        border-radius: 22px;
        overflow: hidden;
        box-shadow: 0 24px 60px rgba(31, 41, 55, 0.10);
      }
      .hero {
        padding: 22px 28px 16px;
        background:
          linear-gradient(135deg, #203a2a 0%, #335341 58%, #6c8a65 100%);
        color: #f8faf8;
      }
      .hero-top {
        display: flex;
        justify-content: flex-start;
        gap: 16px;
        align-items: flex-start;
      }
      .hero h1 {
        margin: 0;
        font-size: 26px;
        line-height: 1.05;
        letter-spacing: 0.02em;
      }
      .hero-role {
        margin: 6px 0 0;
        color: rgba(248, 250, 248, 0.84);
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.18em;
      }
      .meta-line {
        margin-top: 14px;
        display: flex;
        flex-wrap: wrap;
        gap: 8px 0;
        color: rgba(248, 250, 248, 0.92);
        font-size: 11px;
      }
      .meta-line a,
      .meta-line span {
        color: inherit;
        text-decoration: none;
      }
      .meta-sep {
        width: 5px;
        height: 5px;
        margin: 0 10px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.55);
        align-self: center;
      }
      .content {
        padding: 20px 24px 22px;
      }
      .section {
        margin-bottom: 16px;
      }
      .section:last-child {
        margin-bottom: 0;
      }
      .section-title {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 10px;
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.2em;
        text-transform: uppercase;
        color: #335341;
      }
      .section-title::before {
        content: "";
        width: 28px;
        height: 1px;
        background: #88a07c;
      }
      .section-body p {
        margin: 0 0 7px;
      }
      .section-body p:last-child {
        margin-bottom: 0;
      }
      .chip-grid {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .chip {
        padding: 6px 10px;
        border-radius: 999px;
        background: #eff4ec;
        border: 1px solid #dbe6d5;
        color: #294130;
        font-size: 11px;
        line-height: 1.2;
      }
      .two-column {
        display: grid;
        grid-template-columns: minmax(0, 1.6fr) minmax(220px, 0.9fr);
        gap: 18px;
        align-items: start;
      }
      .rail-card {
        border: 1px solid #e4ebe0;
        border-radius: 16px;
        background: #fbfcfa;
        padding: 14px 14px 12px;
      }
      .timeline-item {
        display: grid;
        grid-template-columns: 18px minmax(0, 1fr);
        gap: 12px;
        break-inside: avoid;
        page-break-inside: avoid;
        margin-bottom: 14px;
      }
      .timeline-item:last-child {
        margin-bottom: 0;
      }
      .timeline-item.compact {
        margin-bottom: 12px;
      }
      .timeline-rail {
        position: relative;
        min-height: 100%;
      }
      .timeline-rail::after {
        content: "";
        position: absolute;
        top: 10px;
        bottom: -18px;
        left: 7px;
        width: 1px;
        background: #d4decf;
      }
      .timeline-item:last-child .timeline-rail::after {
        display: none;
      }
      .timeline-dot {
        position: absolute;
        top: 4px;
        left: 1px;
        width: 13px;
        height: 13px;
        border-radius: 50%;
        background: linear-gradient(135deg, #31503d, #88a07c);
        box-shadow: 0 0 0 3px #edf3e9;
      }
      .timeline-content {
        padding: 14px 15px 12px;
        border: 1px solid #e6ece2;
        border-radius: 16px;
        background: #ffffff;
      }
      .item-topline {
        display: flex;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 16px;
        align-items: flex-start;
        margin-bottom: 8px;
      }
      .item-topline > div,
      .item-topline > h3 {
        min-width: 0;
      }
      .item-topline h3 {
        margin: 0;
        font-size: 15px;
        line-height: 1.2;
        color: #1c2b22;
      }
      .item-subtitle {
        margin: 3px 0 0;
        color: #55635a;
        font-size: 11px;
      }
      .item-years {
        flex-shrink: 0;
        padding: 5px 9px;
        border-radius: 999px;
        background: #edf3e9;
        color: #294130;
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        line-height: 1.3;
        max-width: 100%;
        white-space: normal;
        overflow-wrap: anywhere;
        text-align: center;
      }
      .item-notes {
        color: #5f6d64;
        font-size: 11px;
      }
      .bullet-list {
        margin: 0;
        padding-left: 16px;
      }
      .bullet-list li {
        margin-bottom: 5px;
      }
      .bullet-list li:last-child {
        margin-bottom: 0;
      }
      .compact-list {
        list-style: none;
        padding: 0;
        margin: 0;
      }
      .compact-list li {
        display: flex;
        justify-content: space-between;
        gap: 10px;
        padding: 8px 0;
        border-bottom: 1px solid #e5ece1;
      }
      .compact-list li:first-child {
        padding-top: 0;
      }
      .compact-list li:last-child {
        border-bottom: none;
        padding-bottom: 0;
      }
      .compact-list strong {
        color: #294130;
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }
      .muted {
        color: #7b8a80;
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
      <header class="hero">
        <div class="hero-top">
          <div>
            <h1>${name}</h1>
            <p class="hero-role">${roleLine}</p>
          </div>
        </div>
        ${contactMarkup}
      </header>
      <main class="content">
        ${renderSection('Professional Summary', summaryMarkup)}
        ${renderSection('Core Skills', skillsMarkup)}
        <div class="two-column">
          <div>
            ${renderSection('Experience', experienceMarkup)}
          </div>
          <div>
            <div class="rail-card">
              ${renderSection('Education', educationMarkup, { compact: true })}
              ${renderSection('Languages', languagesMarkup, { compact: true })}
            </div>
          </div>
        </div>
      </main>
    </article>
  </body>
</html>`;
}

module.exports = {
  renderResumeHtml,
};
