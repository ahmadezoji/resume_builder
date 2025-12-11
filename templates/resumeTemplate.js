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

const renderExperienceSection = (experiences = []) => {
  if (!experiences.length) {
    return '<p class="muted">No experience entries were generated.</p>';
  }

  return experiences.map((entry, index) => {
    const company = escapeHtml(entry.company || 'Company');
    const role = escapeHtml(entry.role || 'Role');
    const years = escapeHtml(entry.years || '');
    const summary = toParagraphs(entry.summary || 'Summary unavailable.');
    const isLast = index === experiences.length - 1;

    return `
      <article class="experience-card">
        <div class="timeline">
          <span class="dot"></span>
          ${isLast ? '' : '<span class="line"></span>'}
        </div>
        <div class="experience-content">
          <div class="experience-meta">
            <div>
              <h3>${company}</h3>
              <p class="role">${role}</p>
            </div>
            <span class="years">${years}</span>
          </div>
          <div class="experience-body">
            ${summary}
          </div>
        </div>
      </article>
    `;
  }).join('\n');
};

const renderSkillPills = (skills = []) => {
  if (!skills.length) {
    return '<p class="muted">Skills available upon request.</p>';
  }

  return `<ul class="skill-list">${skills
    .map((skill) => `<li>${escapeHtml(skill || '')}</li>`)
    .join('')}</ul>`;
};

const renderLinkList = (links = []) => {
  const normalized = Array.isArray(links)
    ? links.map((link) => (typeof link === 'string' ? link.trim() : ''))
      .filter(Boolean)
    : [];

  if (!normalized.length) {
    return '';
  }

  return `<ul class="link-list">${normalized.map((link) => {
    const display = escapeHtml(link);
    const prefixed = /^https?:\/\//i.test(link)
      ? link
      : `https://${link.replace(/^https?:\/\//i, '')}`;
    return `<li><a href="${escapeHtml(prefixed)}">${display}</a></li>`;
  }).join('')}</ul>`;
};

const renderContactDetails = ({ email, phone, location }) => {
  const rows = [];

  if (email) {
    const safeEmail = escapeHtml(email);
    const mailHref = escapeHtml(`mailto:${encodeURIComponent(email)}`);
    rows.push(`<li><span>Email</span><a href="${mailHref}">${safeEmail}</a></li>`);
  }

  if (phone) {
    const safePhone = escapeHtml(phone);
    const digits = String(phone).replace(/[^+\d]/g, '') || phone;
    const phoneHref = escapeHtml(`tel:${digits}`);
    rows.push(`<li><span>Phone</span><a href="${phoneHref}">${safePhone}</a></li>`);
  }

  if (location) {
    rows.push(`<li><span>Location</span><span>${escapeHtml(location)}</span></li>`);
  }

  if (!rows.length) {
    return '<p class="muted">No contact details detected.</p>';
  }

  return `<ul class="contact-list">${rows.join('')}</ul>`;
};

function renderResumeHtml({
  personalInfo = {},
  aboutMe = '',
  skills = [],
  experiences = [],
} = {}) {
  const name = escapeHtml(personalInfo.name || 'Name unavailable');
  const email = personalInfo.email || '';
  const phone = personalInfo.phone || '';
  const location = personalInfo.location || '';
  const links = Array.isArray(personalInfo.links) ? personalInfo.links.filter(Boolean) : [];
  const safeAbout = toParagraphs(aboutMe || 'No tailored summary generated.');
  const skillsMarkup = renderSkillPills(skills);
  const contactMarkup = renderContactDetails({ email, phone, location });
  const linksMarkup = renderLinkList(links);
  const contactsLine = [email, phone, location].filter(Boolean).map(escapeHtml).join(' • ');

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
        font-family: "Inter", "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
        color: #0f172a;
        background: #e2e8f0;
      }
      .page {
        max-width: 940px;
        margin: 0 auto;
      }
      .resume-shell {
        background: #ffffff;
        border-radius: 28px;
        overflow: hidden;
        box-shadow: 0 25px 60px rgba(15, 23, 42, 0.18);
      }
      .hero {
        background: linear-gradient(130deg, #0ea5e9, #4338ca);
        color: #f8fafc;
        padding: 40px;
      }
      .hero h1 {
        margin: 0;
        font-size: 38px;
        letter-spacing: 0.02em;
      }
      .hero p {
        margin: 6px 0 0;
        font-size: 16px;
        color: rgba(248, 250, 252, 0.85);
      }
      .layout {
        display: grid;
        grid-template-columns: minmax(220px, 280px) 1fr;
        min-height: 100%;
      }
      .sidebar {
        background: #f8fafc;
        padding: 32px;
        border-right: 1px solid #e2e8f0;
      }
      .main-column {
        padding: 32px 40px 40px;
      }
      .panel {
        margin-bottom: 28px;
      }
      .panel-title,
      .section-title {
        margin: 0 0 12px;
        text-transform: uppercase;
        letter-spacing: 0.18em;
        font-size: 13px;
        color: #475569;
      }
      .contact-list,
      .link-list,
      .skill-list {
        list-style: none;
        padding: 0;
        margin: 0;
      }
      .contact-list li {
        display: flex;
        flex-direction: column;
        margin-bottom: 16px;
        font-size: 14px;
      }
      .contact-list span:first-child {
        text-transform: uppercase;
        font-size: 11px;
        letter-spacing: 0.18em;
        color: #94a3b8;
        margin-bottom: 4px;
      }
      .contact-list a,
      .link-list a {
        color: #0f172a;
        text-decoration: none;
      }
      .link-list li {
        margin-bottom: 10px;
        font-size: 14px;
      }
      .skill-list {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .skill-list li {
        padding: 6px 12px;
        border-radius: 999px;
        background: #dbeafe;
        color: #1d4ed8;
        font-size: 13px;
        font-weight: 600;
      }
      .section {
        margin-bottom: 32px;
      }
      .section p {
        margin: 0 0 10px;
        line-height: 1.6;
      }
      .muted {
        color: #94a3b8;
      }
      .experience-card {
        display: flex;
        gap: 16px;
        padding-bottom: 24px;
      }
      .experience-card:last-of-type {
        padding-bottom: 0;
      }
      .timeline {
        position: relative;
        width: 24px;
        display: flex;
        flex-direction: column;
        align-items: center;
      }
      .timeline .dot {
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: #0ea5e9;
        border: 3px solid #e0f2fe;
        box-shadow: 0 0 0 4px rgba(14, 165, 233, 0.15);
      }
      .timeline .line {
        flex: 1;
        width: 2px;
        background: #e2e8f0;
        margin-top: 6px;
      }
      .experience-content {
        flex: 1;
        padding-bottom: 16px;
        border-bottom: 1px solid #e2e8f0;
      }
      .experience-card:last-of-type .experience-content {
        border-bottom: none;
        padding-bottom: 0;
      }
      .experience-meta {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        flex-wrap: wrap;
        align-items: baseline;
      }
      .experience-meta h3 {
        margin: 0;
        font-size: 20px;
        letter-spacing: 0.02em;
      }
      .experience-meta .role {
        margin: 6px 0 0;
        color: #475569;
      }
      .years {
        font-weight: 600;
        color: #0f172a;
        font-size: 14px;
      }
      .experience-body p {
        margin: 10px 0 0;
        line-height: 1.6;
      }
      @media print {
        body {
          background: #ffffff;
          padding: 0;
        }
        .page {
          max-width: none;
        }
        .resume-shell {
          border-radius: 0;
          box-shadow: none;
        }
      }
    </style>
  </head>
  <body>
    <div class="page">
      <main class="resume-shell">
        <header class="hero">
          <h1>${name}</h1>
          ${contactsLine ? `<p>${contactsLine}</p>` : ''}
        </header>
        <div class="layout">
          <aside class="sidebar">
            <section class="panel">
              <h2 class="panel-title">Contact</h2>
              ${contactMarkup}
            </section>
            <section class="panel">
              <h2 class="panel-title">Skills</h2>
              ${skillsMarkup}
            </section>
            ${linksMarkup ? `<section class="panel"><h2 class="panel-title">Links</h2>${linksMarkup}</section>` : ''}
          </aside>
          <section class="main-column">
            <section class="section">
              <h2 class="section-title">Summary</h2>
              ${safeAbout}
            </section>
            <section class="section">
              <h2 class="section-title">Experience</h2>
              ${renderExperienceSection(experiences)}
            </section>
          </section>
        </div>
      </main>
    </div>
  </body>
</html>`;
}

module.exports = {
  renderResumeHtml,
};
