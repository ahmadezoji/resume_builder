const http = require('http');
const fs = require('fs');
const path = require('path');
const formidable = require('formidable');
const pdfParse = require('pdf-parse');
const { renderCoverLetterHtml } = require('./templates/coverLetterTemplate');
const { renderResumeHtml } = require('./templates/resumeTemplate');
const { normalizeOptionalText, normalizeTextLines } = require('./utils/contentSanitizer');
const { generatePdfFromHtml } = require('./utils/pdfGenerator');

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

const HOST = process.env.HOST || '0.0.0.0';
const PORT = process.env.PORT || 5500;
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

const HUMAN_WRITING_RULES = [
  '- Write in formal, polished, human-sounding language.',
  '- Avoid generic AI phrasing, exaggerated claims, buzzwords, and repetitive references to the target role.',
  '- Keep wording specific, credible, and grounded in the source resume.',
].join('\n');

const EXPERIENCE_ALIGNMENT_RULES = [
  '- Preserve every distinct work experience/company from the source resume. Do not drop, merge, or omit roles; only reorder them by relevance.',
  '- Preserve company names, role titles, and date ranges when present.',
  '- Keep each responsibility, achievement, and technology with the correct company. Never move bullets or accomplishments from one company to another.',
  '- If a target job requirement is not credibly related to a specific company role, leave that company description close to the source and only optimize wording.',
  '- Do not rewrite a role into a different discipline. Backend work must remain backend; mobile must remain mobile; frontend must remain frontend unless the source clearly shows both.',
  '- You may tailor wording toward adjacent technologies or patterns only when the connection is credible and supported by the original experience or the candidate\'s skills.',
  '- For adjacent technologies in the same domain, you may highlight transferable relevance without falsely claiming direct production use for that company.',
  '- Example allowed: Django/Python backend experience reframed as relevant Python web backend experience for a Flask-oriented role.',
  '- Example allowed: Flutter mobile development presented as strong cross-platform mobile experience relevant to React Native roles, especially when React Native also appears elsewhere in the candidate profile.',
  '- Example not allowed: backend engineering rewritten as frontend engineering, or unsupported tools being presented as direct production experience.',
  '- Do not claim direct use of a technology inside a specific company role unless the resume text or skills evidence supports that claim.',
  '- Keep each experience substantial. Preserve the main responsibilities, tools, and outcomes instead of shrinking the entry into generic bullets.',
].join('\n');

function buildTailorSystemPrompt() {
  return `You are a resume tailoring assistant.
- Rewrite the candidate's "About me" to align with the job title and description while staying truthful.
- Reorder the experience entries by relevance, but preserve every input experience entry.
- Lightly edit experience text to highlight relevant overlap without inventing facts.
${EXPERIENCE_ALIGNMENT_RULES}
- Return the same number of experience entries as the input. Do not return fewer entries.
- Write a concise, formal cover letter that sounds human and references the job title and key requirements naturally.
${HUMAN_WRITING_RULES}
Return a compact JSON object with an "aboutMe" string, an ordered "experiences" array of strings, and a "coverLetter" string. Do not include explanations.`;
}

function buildResumeUploadSystemPrompt() {
  return `You are a resume analyst and writer. Analyze the provided resume text and align it with the target job. Respond ONLY with JSON matching:
{
  "personalInfo": {
    "name": "string",
    "title": "string",
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
      "years": "string",
      "details": "string"
    }
  ],
  "aboutMe": "string",
  "experiences": [
    {
      "company": "string",
      "role": "string",
      "years": "string",
      "summary": "string"
    }
  ],
  "coverLetter": "string"
}
- Derive personal details, role title, education, and languages from the resume text when possible.
- Extract every distinct work experience/company from the resume. Do not merge or omit roles even if some are less relevant to the target job.
- Only include company, role, education dates, and experience dates when they are supported by the resume text.
- If a year or any other field is missing, return an empty string or empty array instead of placeholders such as YYYY, None, N/A, Unknown, or "not specified".
${EXPERIENCE_ALIGNMENT_RULES}
- For each experience.summary, produce 4-6 bullet-style sentences separated by newline characters when the source supports it.
- Preserve the main responsibility scope, important tools, and outcomes for each role. Refine and reorder details, but do not flatten the experience into generic target-role statements.
- Use the candidate's extracted skills as supporting evidence when emphasizing truthful, adjacent technical overlap.
- The skills list may add a small number of highly probable, job-relevant skills that are strongly implied by the resume and experience, even if they were omitted explicitly.
- Only add inferred skills when the resume provides clear support. Example allowed: add BLoC for a Flutter-heavy profile when the target job explicitly asks for Flutter state management experience.
- Do not add skills that are speculative, unrelated to the target role, or unsupported by the candidate's background.
- Ensure the "aboutMe" and "coverLetter" are formal, natural, and specific to the target job without sounding machine-generated.
${HUMAN_WRITING_RULES}`;
}

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

function buildFilePayload(buffer, fileName, mimeType) {
  return {
    fileName,
    mimeType,
    base64: buffer.toString('base64'),
  };
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

function isPdfUpload(file = {}) {
  const mimeType = normalizeOptionalText(file.mimetype).toLowerCase();
  const originalFilename = normalizeOptionalText(file.originalFilename || file.newFilename || '');
  return mimeType === 'application/pdf'
    || mimeType === 'application/octet-stream'
    || path.extname(originalFilename).toLowerCase() === '.pdf';
}

async function parseResumeTailorPayload(req) {
  const { fields, files } = await parseMultipartForm(req);
  const jobTitle = normalizeOptionalText(getFirstField(fields.jobTitle));
  const jobDescription = normalizeOptionalText(getFirstField(fields.jobDescription));
  const resumeFile = getSingleFile(files.resume);

  if (!jobTitle || !jobDescription) {
    const error = new Error('jobTitle and jobDescription are required.');
    error.statusCode = 400;
    throw error;
  }

  if (!resumeFile) {
    const error = new Error('Resume PDF is required under the "resume" field.');
    error.statusCode = 400;
    throw error;
  }

  if (!isPdfUpload(resumeFile)) {
    const error = new Error('Only PDF resumes are supported.');
    error.statusCode = 415;
    throw error;
  }

  const tempFilePath = resumeFile.filepath || resumeFile.path || '';
  if (!tempFilePath) {
    const error = new Error('Unable to access uploaded file.');
    error.statusCode = 500;
    throw error;
  }

  return {
    jobTitle,
    jobDescription,
    tempFilePath,
  };
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
  return rawExperiences
    .map((item = {}) => {
      const company = normalizeOptionalText(item.company);
      const role = normalizeOptionalText(item.role);
      const years = normalizeOptionalText(item.years);
      const summary = normalizeTextLines(item.summary || item.details).join('\n');

      if (!company && !role && !years && !summary) {
        return null;
      }

      return {
        company,
        role,
        years,
        summary,
      };
    })
    .filter(Boolean);
}

function formatExperienceForDisplay(entry) {
  const titleParts = [entry.company, entry.role].filter(Boolean);
  const header = titleParts.length
    ? `${titleParts.join(' — ')}${entry.years ? ` (${entry.years})` : ''}`
    : entry.years;

  if (header && entry.summary) {
    return `${header}\n${entry.summary}`;
  }

  return header || entry.summary || '';
}

function normalizeStringArray(values) {
  if (!Array.isArray(values)) return [];
  const seen = new Set();

  return values
    .map(normalizeOptionalText)
    .filter(Boolean)
    .filter((value) => {
      const key = value.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function containsPattern(text, patterns = []) {
  return patterns.some((pattern) => pattern.test(text));
}

function inferRelatedSkills(jobDescription, existingSkills = [], experiences = []) {
  const normalizedSkills = normalizeStringArray(existingSkills);
  const skillsText = normalizedSkills.join(' ');
  const experienceText = Array.isArray(experiences)
    ? experiences.map((entry) => [entry.role, entry.company, entry.summary].filter(Boolean).join(' ')).join(' ')
    : '';
  const supportText = `${skillsText} ${experienceText}`.toLowerCase();
  const jobText = String(jobDescription || '').toLowerCase();

  const inferredRules = [
    {
      skill: 'BLoC',
      jobPatterns: [/\bbloc\b/i, /\bflutter\b/i, /\bstate management\b/i],
      supportPatterns: [/\bflutter\b/i, /\bdart\b/i, /\bstate management\b/i],
      shouldAdd: () => !/\bbloc\b/i.test(skillsText),
    },
    {
      skill: 'State Management',
      jobPatterns: [/\bstate management\b/i],
      supportPatterns: [/\bflutter\b/i, /\breact native\b/i, /\bmobile\b/i, /\bbloc\b/i],
      shouldAdd: () => !/\bstate management\b/i.test(skillsText),
    },
    {
      skill: 'REST APIs',
      jobPatterns: [/\brest\b/i, /\bapi\b/i],
      supportPatterns: [/\bflask\b/i, /\bdjango\b/i, /\bspring boot\b/i, /\bapi\b/i],
      shouldAdd: () => !/\brest api\b/i.test(skillsText) && !/\brest apis\b/i.test(skillsText),
    },
    {
      skill: 'CI/CD',
      jobPatterns: [/\bci\/cd\b/i, /\bcontinuous integration\b/i, /\bcontinuous delivery\b/i],
      supportPatterns: [/\bcircleci\b/i, /\bcodemagic\b/i, /\bdocker\b/i, /\bdeployment\b/i],
      shouldAdd: () => !/\bci\/cd\b/i.test(skillsText),
    },
  ];

  const inferredSkills = inferredRules
    .filter((rule) => containsPattern(jobText, rule.jobPatterns))
    .filter((rule) => containsPattern(supportText, rule.supportPatterns))
    .filter((rule) => rule.shouldAdd())
    .map((rule) => rule.skill);

  return normalizeStringArray([...normalizedSkills, ...inferredSkills]);
}

function normalizePersonalInfo(personalInfo = {}) {
  return {
    name: normalizeOptionalText(personalInfo.name),
    title: normalizeOptionalText(personalInfo.title),
    email: normalizeOptionalText(personalInfo.email),
    phone: normalizeOptionalText(personalInfo.phone),
    location: normalizeOptionalText(personalInfo.location),
    links: normalizeStringArray(personalInfo.links),
  };
}

function normalizeEducation(rawEducation) {
  if (!Array.isArray(rawEducation)) return [];

  return rawEducation
    .map((entry = {}) => {
      const institution = normalizeOptionalText(entry.institution);
      const credential = normalizeOptionalText(entry.credential);
      const years = normalizeOptionalText(entry.years);
      const details = normalizeOptionalText(entry.details);

      if (!institution && !credential && !years && !details) {
        return null;
      }

      return {
        institution,
        credential,
        years,
        details,
      };
    })
    .filter(Boolean);
}

function normalizeLanguages(rawLanguages) {
  if (!Array.isArray(rawLanguages)) return [];

  return rawLanguages
    .map((entry) => {
      if (typeof entry === 'string') {
        return normalizeOptionalText(entry);
      }

      const name = normalizeOptionalText(entry?.name);
      const fluency = normalizeOptionalText(entry?.fluency || entry?.proficiency);

      if (!name && !fluency) {
        return null;
      }

      return {
        name,
        fluency,
      };
    })
    .filter(Boolean);
}

async function buildTailoredResumePackage({ jobTitle, jobDescription, resumeSource }) {
  const originalPdfBuffer = Buffer.isBuffer(resumeSource)
    ? resumeSource
    : await fs.promises.readFile(resumeSource);
  const resumeText = await extractResumeText(originalPdfBuffer);

  const systemPrompt = buildResumeUploadSystemPrompt();
  const userPrompt = {
    jobTitle,
    jobDescription,
    resumeText,
    guidance: 'Use only facts present in the resume. Preserve every company and role, keep each responsibility under the correct company, tailor only credible technical overlap, use the extracted skill set as evidence, add only strongly supported missing skills that the candidate likely forgot to list, and keep the result formal, natural, and not overly AI-sounding.'
  };

  const messageContent = await callOpenAi([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: JSON.stringify(userPrompt) },
  ]);

  const parsed = parseJson(messageContent);
  const normalizedExperiences = normalizeExperiences(parsed.experiences);
  const experiencesForDisplay = normalizedExperiences.map(formatExperienceForDisplay).filter(Boolean);
  const tailored = {
    aboutMe: normalizeOptionalText(parsed.aboutMe),
    experiences: normalizedExperiences,
    coverLetter: normalizeOptionalText(parsed.coverLetter),
    personalInfo: normalizePersonalInfo(parsed.personalInfo),
    skills: inferRelatedSkills(jobDescription, normalizeStringArray(parsed.skills), normalizedExperiences),
    education: normalizeEducation(parsed.education),
    languages: normalizeLanguages(parsed.languages),
  };

  const resumeFileName = buildExportFileName('resume', tailored.personalInfo?.name, 'pdf');
  const coverLetterText = tailored.coverLetter || 'Cover letter content was not generated.';
  const coverLetterTextFileName = buildExportFileName('cover', tailored.personalInfo?.name, 'txt');
  const coverLetterPdfFileName = buildExportFileName('cover', tailored.personalInfo?.name, 'pdf');

  const resumeHtml = renderResumeHtml({
    personalInfo: tailored.personalInfo,
    aboutMe: tailored.aboutMe,
    skills: tailored.skills,
    experiences: tailored.experiences,
    education: tailored.education,
    languages: tailored.languages,
  });
  const resumePdfBuffer = await generatePdfFromHtml(resumeHtml);

  const coverLetterHtml = renderCoverLetterHtml({
    personalInfo: tailored.personalInfo,
    jobTitle,
    coverLetter: coverLetterText,
  });
  const coverLetterPdfBuffer = await generatePdfFromHtml(coverLetterHtml);

  return {
    jobTitle,
    tailored,
    experiencesForDisplay,
    resumeFileName,
    resumePdfBuffer,
    coverLetterText,
    coverLetterTextFileName,
    coverLetterPdfFileName,
    coverLetterPdfBuffer,
  };
}

function buildLegacyUploadResponse(pkg) {
  return {
    aboutMe: pkg.tailored.aboutMe,
    experiences: pkg.experiencesForDisplay,
    coverLetter: pkg.tailored.coverLetter,
    personalInfo: pkg.tailored.personalInfo,
    skills: pkg.tailored.skills,
    education: pkg.tailored.education,
    languages: pkg.tailored.languages,
    optimizedPdf: pkg.resumePdfBuffer.toString('base64'),
    optimizedFileName: pkg.resumeFileName,
    coverLetterFile: Buffer.from(pkg.coverLetterText, 'utf8').toString('base64'),
    coverLetterFileName: pkg.coverLetterTextFileName,
    coverLetterPdf: pkg.coverLetterPdfBuffer.toString('base64'),
    coverLetterPdfFileName: pkg.coverLetterPdfFileName,
    experienceItems: pkg.tailored.experiences,
  };
}

function buildApiResumeResponse(pkg) {
  return {
    success: true,
    jobTitle: pkg.jobTitle,
    candidateName: pkg.tailored.personalInfo?.name || '',
    tailored: {
      aboutMe: pkg.tailored.aboutMe,
      coverLetter: pkg.tailored.coverLetter,
      personalInfo: pkg.tailored.personalInfo,
      skills: pkg.tailored.skills,
      education: pkg.tailored.education,
      languages: pkg.tailored.languages,
      experiences: pkg.tailored.experiences,
      experienceDisplay: pkg.experiencesForDisplay,
    },
    files: {
      resumePdf: buildFilePayload(pkg.resumePdfBuffer, pkg.resumeFileName, 'application/pdf'),
      coverLetterPdf: buildFilePayload(pkg.coverLetterPdfBuffer, pkg.coverLetterPdfFileName, 'application/pdf'),
      coverLetterTxt: buildFilePayload(Buffer.from(pkg.coverLetterText, 'utf8'), pkg.coverLetterTextFileName, 'text/plain'),
    },
  };
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

    const inputExperiences = String(experiences)
      .split(/\n{2,}/)
      .map(normalizeOptionalText)
      .filter(Boolean);

    const systemPrompt = buildTailorSystemPrompt();

    const userPrompt = {
      jobTitle,
      jobDescription,
      currentAboutMe: aboutMe,
      experiences: inputExperiences,
      inputExperienceCount: inputExperiences.length,
      guidance: 'Keep every experience entry. Reorder by relevance if needed, but do not remove companies or collapse multiple roles into fewer entries. Keep each description attached to the correct company. Tailor only credible technical overlap, and when frameworks are adjacent, present them as transferable relevance rather than unsupported direct production claims. Keep the tone formal and human.'
    };

    const messageContent = await callOpenAi([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: JSON.stringify(userPrompt) },
    ]);
    const parsed = parseJson(messageContent);
    const parsedExperiences = Array.isArray(parsed.experiences)
      ? parsed.experiences.map(normalizeOptionalText).filter(Boolean)
      : [];

    sendJson(res, 200, {
      aboutMe: normalizeOptionalText(parsed.aboutMe) || normalizeOptionalText(aboutMe),
      experiences: parsedExperiences.length === inputExperiences.length
        ? parsedExperiences
        : inputExperiences,
      coverLetter: normalizeOptionalText(parsed.coverLetter)
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
    const payload = await parseResumeTailorPayload(req);
    tempFilePath = payload.tempFilePath;

    const resumePackage = await buildTailoredResumePackage({
      jobTitle: payload.jobTitle,
      jobDescription: payload.jobDescription,
      resumeSource: tempFilePath,
    });

    sendJson(res, 200, buildLegacyUploadResponse(resumePackage));
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

async function handleTailorResumeApi(req, res) {
  let tempFilePath = '';
  try {
    const payload = await parseResumeTailorPayload(req);
    tempFilePath = payload.tempFilePath;

    const resumePackage = await buildTailoredResumePackage({
      jobTitle: payload.jobTitle,
      jobDescription: payload.jobDescription,
      resumeSource: tempFilePath,
    });

    sendJson(res, 200, buildApiResumeResponse(resumePackage));
  } catch (error) {
    console.error('Tailor resume API failed', error);
    const status = error.statusCode || 500;
    const payload = { success: false, error: error.message || 'Unexpected server error.' };
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
  const requestUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = requestUrl.pathname;

  if (req.method === 'GET' && pathname === '/healthz') {
    return sendJson(res, 200, {
      status: 'ok',
      service: 'resume-builder',
      timestamp: new Date().toISOString(),
    });
  }

  if (req.method === 'POST' && pathname === '/api/v1/tailor-resume') {
    return handleTailorResumeApi(req, res);
  }

  if (req.method === 'POST' && pathname === '/api/upload-resume') {
    return handleResumeUpload(req, res);
  }

  if (req.method === 'POST' && pathname === '/api/tailor') {
    return handleTailorRequest(req, res);
  }

  if (req.method === 'GET') {
    return serveStatic(req, res);
  }

  res.writeHead(405, { 'Content-Type': 'text/plain' });
  res.end('Method not allowed');
});

server.listen(PORT, HOST, () => {
  console.log(`Resume builder running on http://${HOST}:${PORT}`);
});
