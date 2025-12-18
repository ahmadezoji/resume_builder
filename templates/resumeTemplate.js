const escapeHtml = (value = '') => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const toParagraphs = (text = '') => {
  const safeText = escapeHtml(text);
  return safeText
    .split(/\n+/)
    .filter(Boolean)
    .map((line) => `<p>${line}</p>`)
    .join('');
};

const toBulletList = (text = '') => {
  const lines = String(text)
    .split(/\n+/)
    .map((line) => line.replace(/^[•\-\u2022]+\s*/, '').trim())
    .filter(Boolean);

  if (!lines.length) {
    return '';
  }

  return `<ul class="bullet-list">${lines.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>`;
};

const deriveMonogram = (name = '') => {
  const segments = String(name)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  if (!segments.length) return 'CV';
  return segments.map((part) => part[0]?.toUpperCase() || '').join('');
};

const renderContactDetails = ({ email, phone, location, links = [] } = {}) => {
  const rows = [];

  if (phone) {
    const safePhone = escapeHtml(phone);
    const phoneHref = escapeHtml(`tel:${String(phone).replace(/[^+\d]/g, '') || phone}`);
    rows.push(`<li><span class="contact-label">Phone</span><a href="${phoneHref}">${safePhone}</a></li>`);
  }

  if (email) {
    const safeEmail = escapeHtml(email);
    const mailHref = escapeHtml(`mailto:${encodeURIComponent(email)}`);
    rows.push(`<li><span class="contact-label">Email</span><a href="${mailHref}">${safeEmail}</a></li>`);
  }

  if (location) {
    rows.push(`<li><span class="contact-label">Location</span><span>${escapeHtml(location)}</span></li>`);
  }

  const normalizedLinks = Array.isArray(links)
    ? links.map((link) => (typeof link === 'string' ? link.trim() : '')).filter(Boolean)
    : [];

  if (normalizedLinks.length) {
    const link = normalizedLinks[0];
    const href = /^https?:\/\//i.test(link) ? link : `https://${link}`;
    rows.push(`<li><span class="contact-label">Website</span><a href="${escapeHtml(href)}">${escapeHtml(link)}</a></li>`);
  }

  if (!rows.length) {
    return '<p class="muted">Contact information unavailable.</p>';
  }

  return `<ul class="contact-list">${rows.join('')}</ul>`;
};

const renderSkills = (skills = []) => {
  const validSkills = Array.isArray(skills)
    ? skills.map((skill) => (typeof skill === 'string' ? skill.trim() : '')).filter(Boolean)
    : [];

  if (!validSkills.length) {
    return '<p class="muted">Skills available upon request.</p>';
  }

  return `<ul class="dot-list">${validSkills.map((skill) => `<li>${escapeHtml(skill)}</li>`).join('')}</ul>`;
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
      return `<li>${name}${fluency ? ` — ${fluency}` : ''}</li>`;
    })
    .filter(Boolean);

  if (!rows.length) {
    return '<p class="muted">Languages not specified.</p>';
  }

  return `<ul class="dot-list">${rows.join('')}</ul>`;
};

const renderEducation = (education = []) => {
  if (!Array.isArray(education) || !education.length) {
    return '<p class="muted">Education summary unavailable.</p>';
  }

  return education.map((entry) => {
    const institution = escapeHtml(entry.institution || 'Institution');
    const credential = escapeHtml(entry.credential || '');
    const years = escapeHtml(entry.years || '');
    const details = entry.details ? `<p class="edu-notes">${escapeHtml(entry.details)}</p>` : '';

    return `
      <article class="edu-item">
        <div class="edu-years">${years}</div>
        <div class="edu-body">
          <h4>${institution}</h4>
          ${credential ? `<p class="edu-credential">${credential}</p>` : ''}
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
    const bullets = toBulletList(entry.summary || '');
    const summary = bullets || toParagraphs(entry.summary || '');

    return `
      <article class="experience-card">
        <div class="experience-header">
          <div>
            <h4>${company}</h4>
            <p class="role">${role}</p>
          </div>
          <span class="years">${years}</span>
        </div>
        <div class="experience-body">
          ${summary || '<p class="muted">Details unavailable.</p>'}
        </div>
      </article>
    `;
  }).join('');
};

const renderBadgeHeading = (label, letter) => `
  <div class="section-heading">
    <span class="section-icon">${letter}</span>
    <span>${escapeHtml(label)}</span>
  </div>
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
  const roleLine = escapeHtml(personalInfo.title || 'Software Developer');
  const monogram = deriveMonogram(personalInfo.name);
  const summaryMarkup = toParagraphs(aboutMe || 'No tailored summary generated.');
  const contactMarkup = renderContactDetails(personalInfo);
  const skillsMarkup = renderSkills(skills);
  const educationMarkup = renderEducation(education);
  const languagesMarkup = renderLanguages(languages);
  const experienceMarkup = renderExperience(experiences);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${name} — Resume</title>
    <style>
      * {
        box-sizing: border-box;
      }
      body {
        margin: 0;
        padding: 32px;
        background: #f4f4f6;
        font-family: "Libre Baskerville", "Times New Roman", serif;
        color: #1f2933;
        font-size: 13px;
      }
      .page {
        max-width: 920px;
        margin: 0 auto;
      }
      .sheet {
        background: #ffffff;
        border-radius: 16px;
        box-shadow: 0 25px 60px rgba(15, 23, 42, 0.12);
        overflow: hidden;
      }
      .masthead {
        border-bottom: 2px solid #d6d7da;
        padding: 44px 48px 32px;
        position: relative;
        text-align: center;
      }
      .masthead::after {
        content: "${monogram}";
        position: absolute;
        top: 18px;
        left: 50%;
        transform: translateX(-50%);
        font-size: 110px;
        font-weight: 300;
        color: rgba(15, 23, 42, 0.06);
        letter-spacing: 0.16em;
        pointer-events: none;
      }
      .masthead h1 {
        margin: 0;
        font-size: 40px;
        letter-spacing: 0.32em;
      }
      .masthead p {
        margin: 10px 0 0;
        font-size: 13px;
        letter-spacing: 0.32em;
        text-transform: uppercase;
        color: #545b67;
      }
      .layout {
        display: grid;
        grid-template-columns: 300px 1fr;
        min-height: 100%;
      }
      .sidebar {
        background: #f9f9fb;
        border-right: 1px solid #ececf0;
        padding: 32px;
      }
      .main-column {
        padding: 32px 42px 40px;
      }
      .info-card,
      .main-section {
        margin-bottom: 26px;
      }
      .section-heading {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 14px;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: #6d7381;
        margin-bottom: 14px;
      }
      .section-icon {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        border: 2px solid #b8bcc8;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-weight: 600;
        color: #4b5563;
        background: #fff;
        font-size: 12px;
      }
      .contact-list,
      .dot-list {
        list-style: none;
        padding: 0;
        margin: 0;
      }
      .contact-list li {
        display: flex;
        flex-direction: column;
        margin-bottom: 14px;
        font-size: 13px;
      }
      .contact-label {
        text-transform: uppercase;
        font-size: 10px;
        letter-spacing: 0.22em;
        color: #9aa0ac;
        margin-bottom: 3px;
      }
      .contact-list a {
        color: #1f2933;
        text-decoration: none;
      }
      .dot-list li {
        position: relative;
        padding-left: 14px;
        margin-bottom: 8px;
        font-size: 13px;
      }
      .dot-list li::before {
        content: "";
        width: 4px;
        height: 4px;
        border-radius: 50%;
        background: #4c5762;
        position: absolute;
        left: 0;
        top: 7px;
      }
      .edu-item {
        display: grid;
        grid-template-columns: 74px 1fr;
        gap: 14px;
        padding-bottom: 14px;
        border-bottom: 1px solid #e5e7eb;
        margin-bottom: 14px;
      }
      .edu-item:last-of-type {
        border-bottom: none;
        margin-bottom: 0;
        padding-bottom: 0;
      }
      .edu-years {
        font-weight: 600;
        color: #4c5762;
        font-size: 12px;
      }
      .edu-body h4 {
        margin: 0;
        font-size: 16px;
      }
      .edu-credential {
        margin: 3px 0;
        color: #4b5563;
        font-size: 13px;
      }
      .edu-notes {
        margin: 4px 0 0;
        font-size: 12px;
        color: #6b7280;
      }
      .main-section .section-heading {
        color: #4b4f58;
      }
      .bullet-list {
        margin: 0;
        padding-left: 16px;
      }
      .bullet-list li {
        margin-bottom: 6px;
        line-height: 1.45;
        font-size: 13px;
      }
      .experience-card {
        border: 1px solid #e5e7eb;
        border-radius: 14px;
        padding: 18px 20px;
        margin-bottom: 14px;
        background: #fff;
        box-shadow: 0 10px 25px rgba(15, 23, 42, 0.05);
      }
      .experience-card:last-of-type {
        margin-bottom: 0;
      }
      .experience-header {
        display: flex;
        justify-content: space-between;
        gap: 10px;
        flex-wrap: wrap;
        border-bottom: 1px solid #ececf0;
        padding-bottom: 10px;
        margin-bottom: 10px;
      }
      .experience-header h4 {
        margin: 0;
        font-size: 18px;
        letter-spacing: 0.03em;
      }
      .role {
        margin: 4px 0 0;
        color: #4b5563;
        font-size: 13px;
      }
      .years {
        font-weight: 600;
        color: #374151;
        font-size: 12px;
      }
      .experience-body p {
        margin: 0 0 6px;
        line-height: 1.5;
        font-size: 13px;
      }
      .muted {
        color: #9aa0ac;
        font-size: 12px;
      }
      @media print {
        body {
          padding: 0;
          background: #ffffff;
        }
        .sheet {
          border-radius: 0;
          box-shadow: none;
        }
        .experience-card {
          box-shadow: none;
        }
      }
    </style>
  </head>
  <body>
    <div class="page">
      <article class="sheet">
        <header class="masthead">
          <h1>${name}</h1>
          <p>${roleLine}</p>
        </header>
        <div class="layout">
          <aside class="sidebar">
            <section class="info-card">
              ${renderBadgeHeading('Contact', 'C')}
              ${contactMarkup}
            </section>
            <section class="info-card">
              ${renderBadgeHeading('Education', 'E')}
              ${educationMarkup}
            </section>
            <section class="info-card">
              ${renderBadgeHeading('Skills', 'S')}
              ${skillsMarkup}
            </section>
            <section class="info-card">
              ${renderBadgeHeading('Languages', 'L')}
              ${languagesMarkup}
            </section>
          </aside>
          <section class="main-column">
            <section class="main-section">
              ${renderBadgeHeading('Profile Summary', 'P')}
              ${summaryMarkup}
            </section>
            <section class="main-section">
              ${renderBadgeHeading('Work Experience', 'W')}
              ${experienceMarkup}
            </section>
          </section>
        </div>
      </article>
    </div>
  </body>
</html>`;
}

module.exports = {
  renderResumeHtml,
};
