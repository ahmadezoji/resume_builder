const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 4000;
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
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing required fields.' }));
      return;
    }

    if (!OPENAI_API_KEY) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Server is missing the OpenAI API key.' }));
      return;
    }

    const systemPrompt = `You are a resume tailoring assistant. Given a target job and a resume, you:\n- Rewrite the candidate's "About me" to align with the job title and description while staying truthful.\n- Reorder experiences so that the most relevant items appear first.\n- Lightly edit experience text to highlight skills the job requires without inventing facts.\n- Write a concise, friendly cover letter that sounds human, references the job title, and mentions specific requirements or concepts from the description the candidate has addressed.\nReturn a compact JSON object with an "aboutMe" string, an ordered "experiences" array of strings, and a "coverLetter" string. Do not include explanations.`;

    const userPrompt = {
      jobTitle,
      jobDescription,
      currentAboutMe: aboutMe,
      experiences,
      guidance: 'Keep details honest but emphasize overlap with the target role. You may adjust phrasing, reorder entries, trim irrelevant details, and create a personable cover letter that nods to the company needs.'
    };

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: JSON.stringify(userPrompt) },
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      res.writeHead(response.status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'OpenAI request failed', details: errorText }));
      return;
    }

    const result = await response.json();
    const messageContent = result?.choices?.[0]?.message?.content;
    const parsed = JSON.parse(messageContent || '{}');

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      aboutMe: parsed.aboutMe || aboutMe,
      experiences: Array.isArray(parsed.experiences) ? parsed.experiences : experiences.split(/\n{2,}/).map((item) => item.trim()).filter(Boolean),
      coverLetter: parsed.coverLetter || ''
    }));
  } catch (error) {
    console.error('Tailor request failed', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Unexpected server error.' }));
  }
}

const server = http.createServer((req, res) => {
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
