const http = require('http');
const fs = require('fs');
const path = require('path');
const formidable = require('formidable');
const pdfParse = require('pdf-parse');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const { renderResumeHtml } = require('./templates/resumeTemplate');
const { generatePdfFromHtml } = require('./utils/pdfGenerator');

const PORT = process.env.PORT || 5500;
const PUBLIC_DIR = path.join(__dirname, 'public');
const ENV_PATH = path.join(__dirname, '.env');

if (fs.existsSync(ENV_PATH)) {
  const envContent = fs.readFileSync(ENV_PATH, 'utf8');
  envContent.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) return;
    const [rawKey, ...rest] = trimmed.split('=');
    const key = rawKey.trim();
    const value = rest.join('=').trim();
    if (key && !process.env[key]) {
      process.env[key] = value;
    }
  });
}

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.warn('Warning: OPENAI_API_KEY is not set. Requests to /api/tailor will fail.');
}

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

function toNameSlug(value = '') {
  if (!value) return 'candidate';
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .join('_') || 'candidate';
}

function getTimestampStamp(date = new Date()) {
  return String(date.getTime());
}

function buildExportFileName(prefix, candidateName, extension) {
  const safePrefix = prefix || 'resume';
  const slug = toNameSlug(candidateName);
  const stamp = getTimestampStamp();
  const safeExtension = (extension || 'pdf').replace(/^\.+/, '');
  return `${safePrefix}_${slug}_${stamp}.${safeExtension}`;
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

async function callOpenAi(messages, { temperature = 0.7, responseFormat = { type: 'json_object' } } = {}) {
  if (!OPENAI_API_KEY) {
    const error = new Error('Server is missing the OpenAI API key.');
    error.statusCode = 500;
    throw error;
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages,
      temperature,
      response_format: responseFormat,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    const error = new Error('OpenAI request failed');
    error.statusCode = response.status;
    error.details = errorText;
    throw error;
  }

  const data = await response.json();
  return data?.choices?.[0]?.message?.content || '';
}

function parseJson(content, fallback = {}) {
  try {
    return JSON.parse(content);
  } catch {
    return fallback;
  }
}

function parseMultipartForm(req) {
  return new Promise((resolve, reject) => {
    const { IncomingForm } = formidable; // Correctly access IncomingForm
    const form = new IncomingForm({
      allowEmptyFiles: false,
      maxFileSize: 15 * 1024 * 1024,
      multiples: false,
    });

    form.parse(req, (err, fields, files) => {
      if (err) {
        reject(err);
        return;
      }
      resolve({ fields, files });
    });
  });
}

function getFirstField(fieldValue) {
  if (fieldValue === undefined || fieldValue === null) return '';
  if (Array.isArray(fieldValue)) return fieldValue[0];
  return fieldValue;
}

function getSingleFile(fileValue) {
  if (!fileValue) return null;
  return Array.isArray(fileValue) ? fileValue[0] : fileValue;
}

async function extractResumeText(fileSource) {
  const buffer = Buffer.isBuffer(fileSource) ? fileSource : await fs.promises.readFile(fileSource);
  const parsed = await pdfParse(buffer);
  const text = parsed.text?.trim();
  if (!text) {
    throw new Error('Unable to extract text from the uploaded PDF.');
  }
  return text;
}

function normalizeExperiences(rawExperiences) {
  if (!Array.isArray(rawExperiences)) return [];
  return rawExperiences.map((item = {}) => {
    const company = typeof item.company === 'string' ? item.company.trim() : '';
    const role = typeof item.role === 'string' ? item.role.trim() : '';
    const years = typeof item.years === 'string' ? item.years.trim() : '';
    const summary = typeof item.summary === 'string'
      ? item.summary.trim()
      : typeof item.details === 'string'
        ? item.details.trim()
        : '';
    return {
      company: company || 'Company not specified',
      role: role || 'Role not specified',
      years: years || 'Dates not specified',
      summary,
    };
  });
}

function formatExperienceForDisplay(entry) {
  const header = `${entry.company} — ${entry.role} (${entry.years})`.replace(/\s+/g, ' ').trim();
  return entry.summary ? `${header}\n${entry.summary}` : header;
}

function wrapLines(text, font, fontSize, maxWidth) {
  if (!text) return [''];
  const words = text.split(/\s+/);
  const lines = [];
  let currentLine = '';

  words.forEach((word) => {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;
    if (font.widthOfTextAtSize(nextLine, fontSize) <= maxWidth) {
      currentLine = nextLine;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  });

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.length ? lines : [''];
}

async function appendTailoredResumeToPdf(originalBuffer, { personalInfo = {}, aboutMe = '', skills = [], experiences = [] }) {
  if (!originalBuffer) {
    throw new Error('Original PDF buffer is required to preserve formatting.');
  }

  const pdfDoc = await PDFDocument.load(originalBuffer);
  let page = pdfDoc.addPage();
  let { width, height } = page.getSize();
  const margin = 50;
  let cursorY = height - margin;

  const bodyFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const headingFontSize = 16;
  const bodyFontSize = 11;
  const headingColor = rgb(0.05, 0.25, 0.55);
  const contentWidth = width - margin * 2;

  const ensureSpace = (needed) => {
    if (cursorY - needed <= margin) {
      page = pdfDoc.addPage();
      ({ width, height } = page.getSize());
      cursorY = height - margin;
    }
  };

  const drawHeading = (text) => {
    ensureSpace(headingFontSize + 8);
    cursorY -= headingFontSize;
    page.drawText(text, {
      x: margin,
      y: cursorY,
      size: headingFontSize,
      font: boldFont,
      color: headingColor,
    });
    cursorY -= 8;
  };

  const drawParagraph = (text) => {
    const lines = wrapLines(text, bodyFont, bodyFontSize, contentWidth);
    lines.forEach((line) => {
      ensureSpace(bodyFontSize + 4);
      cursorY -= bodyFontSize;
      page.drawText(line, {
        x: margin,
        y: cursorY,
        size: bodyFontSize,
        font: bodyFont,
      });
      cursorY -= 4;
    });
    cursorY -= 4;
  };

  drawHeading('Tailored Summary');
  drawParagraph(aboutMe || 'No summary generated.');

  drawHeading('Highlighted Skills');
  drawParagraph(skills.length ? skills.join(', ') : 'No skills detected.');

  drawHeading('Optimized Experience');
  if (experiences.length) {
    experiences.forEach((entry) => {
      const header = `${entry.company} — ${entry.role} (${entry.years})`;
      ensureSpace(bodyFontSize * 2);
      cursorY -= bodyFontSize;
      page.drawText(header, {
        x: margin,
        y: cursorY,
        size: bodyFontSize,
        font: boldFont,
      });
      cursorY -= 6;
      if (entry.summary) {
        const lines = wrapLines(entry.summary, bodyFont, bodyFontSize, contentWidth);
        lines.forEach((line) => {
          ensureSpace(bodyFontSize + 3);
          cursorY -= bodyFontSize;
          page.drawText(line, {
            x: margin + 12,
            y: cursorY,
            size: bodyFontSize,
            font: bodyFont,
          });
          cursorY -= 3;
        });
        cursorY -= 4;
      } else {
        cursorY -= 4;
      }
    });
  } else {
    drawParagraph('No experience entries detected.');
  }

  drawHeading('Contact snapshot');
  const contactParts = [
    personalInfo.name,
    personalInfo.email,
    personalInfo.phone,
    personalInfo.location,
  ].filter(Boolean);
  drawParagraph(contactParts.length ? contactParts.join(' | ') : 'No personal info detected.');

  const updatedBytes = await pdfDoc.save();
  return Buffer.from(updatedBytes);
}

function serveStatic(req, res) {
  const safePath = path.normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^\/+/, '');
  const requestedPath = safePath || 'index.html';
  const filePath = path.join(PUBLIC_DIR, requestedPath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404);
        res.end('Not found');
      } else {
        res.writeHead(500);
        res.end('Server error');
      }
      return;
    }

    const ext = path.extname(filePath);
    const contentType = contentTypes[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

async function handleTailorRequest(req, res) {
  try {
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const body = Buffer.concat(chunks).toString();
    const payload = JSON.parse(body || '{}');

    const { jobTitle, jobDescription, aboutMe, experiences } = payload;
    if (!jobTitle || !jobDescription || !aboutMe || !experiences) {
      sendJson(res, 400, { error: 'Missing required fields.' });
      return;
    }

    const systemPrompt = `You are a resume tailoring assistant. Given a target job and a resume, you:\n- Rewrite the candidate's "About me" to align with the job title and description while staying truthful.\n- Reorder experiences so that the most relevant items appear first.\n- Lightly edit experience text to highlight skills the job requires without inventing facts.\n- Ensure every experience snippet mentions the employer/company and the date range (e.g., 2019-2023 or 2021-Present).\n- Write a concise, friendly cover letter that sounds human, references the job title, and mentions specific requirements or concepts from the description the candidate has addressed.\nReturn a compact JSON object with an "aboutMe" string, an ordered "experiences" array of strings, and a "coverLetter" string. Do not include explanations.`;

    const userPrompt = {
      jobTitle,
      jobDescription,
      currentAboutMe: aboutMe,
      experiences,
      guidance: 'Keep details honest but emphasize overlap with the target role. You may adjust phrasing, reorder entries, trim irrelevant details, and create a personable cover letter that nods to the company needs.'
    };

    const messageContent = await callOpenAi([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: JSON.stringify(userPrompt) },
    ]);
    const parsed = parseJson(messageContent);

    sendJson(res, 200, {
      aboutMe: parsed.aboutMe || aboutMe,
      experiences: Array.isArray(parsed.experiences) ? parsed.experiences : experiences.split(/\n{2,}/).map((item) => item.trim()).filter(Boolean),
      coverLetter: parsed.coverLetter || ''
    });
  } catch (error) {
    console.error('Tailor request failed', error);
    const status = error.statusCode || 500;
    const response = { error: error.message || 'Unexpected server error.' };
    if (error.details) {
      response.details = error.details;
    }
    sendJson(res, status, response);
  }
}

async function handleResumeUpload(req, res) {
  let tempFilePath = '';
  try {
    const { fields, files } = await parseMultipartForm(req);
    const jobTitle = getFirstField(fields.jobTitle);
    const jobDescription = getFirstField(fields.jobDescription);
    const resumeFile = getSingleFile(files.resume);

    if (!jobTitle || !jobDescription) {
      sendJson(res, 400, { error: 'jobTitle and jobDescription are required.' });
      return;
    }

    if (!resumeFile) {
      sendJson(res, 400, { error: 'Resume PDF is required under the "resume" field.' });
      return;
    }

    if (resumeFile.mimetype && resumeFile.mimetype !== 'application/pdf') {
      sendJson(res, 415, { error: 'Only PDF resumes are supported.' });
      return;
    }

    tempFilePath = resumeFile.filepath || resumeFile.path || '';
    if (!tempFilePath) {
      sendJson(res, 500, { error: 'Unable to access uploaded file.' });
      return;
    }

    const originalPdfBuffer = await fs.promises.readFile(tempFilePath);
    const resumeText = await extractResumeText(originalPdfBuffer);

    const systemPrompt = `You are a resume analyst and writer. Analyze the provided resume text and align it with the target job. Respond ONLY with JSON matching:
{
  "personalInfo": {
    "name": "string",
    "email": "string",
    "phone": "string",
    "location": "string",
    "links": ["string"]
  },
  "skills": ["string"],
  "languages": [
    {
      "name": "string",
      "fluency": "string"
    }
  ],
  "education": [
    {
      "institution": "string",
      "credential": "string",
      "years": "YYYY-YYYY or YYYY-Present",
      "details": "string"
    }
  ],
  "aboutMe": "string",
  "experiences": [
    {
      "company": "string",
      "role": "string",
      "years": "YYYY-YYYY or YYYY-Present",
      "summary": "string"
    }
  ],
  "coverLetter": "string"
}
- Derive personal details, education, and languages from the resume text when possible.
- Always include company and explicit year ranges for every experience entry. Prefer YYYY-YYYY or YYYY-Present formats.
- For each experience.summary, produce 3-5 bullet-style sentences separated by newline characters. The first bullet should explicitly connect the role to the target job requirements, while the remaining bullets must be refined versions of the original resume details (do not delete facts—rewrite for clarity and impact). If the resume offers more than three relevant statements, keep them all by merging overlapping ideas rather than removing content.
- Keep experience summaries concise and impact-focused, highlighting overlap with the job description.
- Ensure the cover letter references the job title and key requirements from the supplied description.`;

    const userPrompt = {
      jobTitle,
      jobDescription,
      resumeText,
      guidance: 'Use only facts present in the resume. You may polish wording, reorder experience items, and infer skills explicitly stated or implied by the resume.'
    };

    const messageContent = await callOpenAi([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: JSON.stringify(userPrompt) },
    ]);

    const parsed = parseJson(messageContent);
    const normalizedExperiences = normalizeExperiences(parsed.experiences);
    const experiencesForDisplay = normalizedExperiences.map(formatExperienceForDisplay);
    const tailored = {
      aboutMe: parsed.aboutMe || '',
      experiences: normalizedExperiences,
      coverLetter: parsed.coverLetter || '',
      personalInfo: parsed.personalInfo || {},
      skills: Array.isArray(parsed.skills) ? parsed.skills : [],
      education: Array.isArray(parsed.education) ? parsed.education : [],
      languages: Array.isArray(parsed.languages) ? parsed.languages : [],
    };

    const resumeFileName = buildExportFileName('resume', tailored.personalInfo?.name, 'pdf');
    const coverLetterFileName = buildExportFileName('cover', tailored.personalInfo?.name, 'txt');

    let pdfBuffer;
    try {
      const resumeHtml = renderResumeHtml({
        personalInfo: tailored.personalInfo,
        aboutMe: tailored.aboutMe,
        skills: tailored.skills,
        experiences: tailored.experiences,
        education: tailored.education,
        languages: tailored.languages,
      });
      pdfBuffer = await generatePdfFromHtml(resumeHtml);
    } catch (htmlError) {
      console.error('Failed to render HTML template, falling back to PDF append workflow.', htmlError);
      try {
        pdfBuffer = await appendTailoredResumeToPdf(originalPdfBuffer, tailored);
      } catch (pdfError) {
        console.error('Failed to append tailored content to PDF, returning original file.', pdfError);
        pdfBuffer = originalPdfBuffer;
      }
    }

    const coverLetterFile = Buffer.from(tailored.coverLetter || 'No cover letter generated.', 'utf8').toString('base64');

    sendJson(res, 200, {
      aboutMe: tailored.aboutMe,
      experiences: experiencesForDisplay,
      coverLetter: tailored.coverLetter,
      personalInfo: tailored.personalInfo,
      skills: tailored.skills,
      education: tailored.education,
      languages: tailored.languages,
      optimizedPdf: pdfBuffer.toString('base64'),
      optimizedFileName: resumeFileName,
      coverLetterFile,
      coverLetterFileName,
      experienceItems: normalizedExperiences,
    });
  } catch (error) {
    console.error('Resume upload failed', error);
    const status = error.statusCode || 500;
    const payload = { error: error.message || 'Unexpected server error.' };
    if (error.details) {
      payload.details = error.details;
    }
    sendJson(res, status, payload);
  } finally {
    if (tempFilePath) {
      fs.promises.unlink(tempFilePath).catch(() => {});
    }
  }
}

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url.startsWith('/api/upload-resume')) {
    return handleResumeUpload(req, res);
  }

  if (req.method === 'POST' && req.url.startsWith('/api/tailor')) {
    return handleTailorRequest(req, res);
  }

  if (req.method === 'GET') {
    return serveStatic(req, res);
  }

  res.writeHead(405, { 'Content-Type': 'text/plain' });
  res.end('Method not allowed');
});

server.listen(PORT, () => {
  console.log(`Resume builder running on http://localhost:${PORT}`);
});
