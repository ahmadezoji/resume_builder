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

  return experiences.map((entry) => {
    const company = escapeHtml(entry.company || 'Company');
    const role = escapeHtml(entry.role || 'Role');
    const years = escapeHtml(entry.years || '');
    const summary = toParagraphs(entry.summary || 'Summary unavailable.');

    return `
      <div class="experience">
        <div class="experience-header">
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
    `;
  }).join('\n');
};

function renderResumeHtml({
  personalInfo = {},
  aboutMe = '',
  skills = [],
  experiences = [],
} = {}) {
  const name = escapeHtml(personalInfo.name || 'Name unavailable');
  const email = escapeHtml(personalInfo.email || '');
  const phone = escapeHtml(personalInfo.phone || '');
  const location = escapeHtml(personalInfo.location || '');
  const links = Array.isArray(personalInfo.links) ? personalInfo.links.filter(Boolean) : [];
  const safeAbout = toParagraphs(aboutMe || 'No tailored summary generated.');
  const safeSkills = skills.length
    ? escapeHtml(skills.join(' • '))
    : 'Skills available upon request.';

  const contacts = [email, phone, location].filter(Boolean).join(' • ');
  const renderedLinks = links.length
    ? `<p class="links">${links.map((link) => escapeHtml(link)).join(' • ')}</p>`
    : '';

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
        padding: 0;
        font-family: "Inter", Arial, sans-serif;
        color: #0f172a;
        background: #f8fafc;
      }
      main {
        max-width: 800px;
        margin: 0 auto;
        padding: 32px 48px;
        background: #ffffff;
        min-height: 100vh;
      }
      header h1 {
        margin: 0;
        font-size: 32px;
        letter-spacing: 0.02em;
      }
      header p {
        margin: 4px 0;
        color: #475569;
        font-size: 14px;
      }
      section {
        margin-top: 28px;
      }
      section h2 {
        margin: 0 0 12px;
        font-size: 16px;
        color: #0ea5e9;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }
      section p {
        margin: 0 0 8px;
        line-height: 1.6;
      }
      .muted {
        color: #94a3b8;
      }
      .experience {
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        padding: 16px 20px;
        margin-bottom: 16px;
      }
      .experience-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
      }
      .experience-header h3 {
        margin: 0;
        font-size: 18px;
      }
      .experience-header .role {
        margin: 4px 0 0;
        color: #475569;
      }
      .experience-body p {
        margin: 8px 0 0;
        line-height: 1.5;
      }
      .years {
        font-weight: 600;
        color: #0f172a;
      }
      .skills {
        display: inline-block;
        padding: 10px 14px;
        border-radius: 999px;
        background: #e0f2fe;
        color: #075985;
        font-weight: 600;
      }
      .links {
        margin-top: 12px;
        color: #0369a1;
      }
    </style>
  </head>
  <body>
    <main>
      <header>
        <h1>${name}</h1>
        ${contacts ? `<p>${contacts}</p>` : ''}
        ${renderedLinks}
      </header>
      <section>
        <h2>Summary</h2>
        ${safeAbout}
      </section>
      <section>
        <h2>Skills</h2>
        <p class="skills">${safeSkills}</p>
      </section>
      <section>
        <h2>Experience</h2>
        ${renderExperienceSection(experiences)}
      </section>
    </main>
  </body>
</html>`;
}

module.exports = {
  renderResumeHtml,
};
