# resume_builder

Resume tailoring service that accepts a target job title, a target job description, and a source resume PDF, then returns:

- a tailored resume PDF
- a cover letter PDF
- a cover letter text file
- structured tailored resume data in JSON

## What this service exposes

- `GET /healthz`
  Returns a simple health payload for monitoring and deployment checks.

- `POST /api/v1/tailor-resume`
  Deployment-oriented API endpoint for server-to-server or frontend-to-backend use.
  Accepts multipart form-data with:
  - `jobTitle`
  - `jobDescription`
  - `resume` as a PDF file

- `POST /api/upload-resume`
  Legacy UI endpoint used by the built-in web interface.

- `POST /api/tailor`
  Text-only tailoring endpoint without PDF upload.

## Response format for `POST /api/v1/tailor-resume`

The endpoint returns JSON. The generated files are returned as Base64 strings so both PDF files can be returned in one response body.

Example response shape:

```json
{
  "success": true,
  "jobTitle": "Senior Flutter Engineer",
  "candidateName": "Saam Ezoji",
  "tailored": {
    "aboutMe": "string",
    "coverLetter": "string",
    "personalInfo": {},
    "skills": [],
    "education": [],
    "languages": [],
    "experiences": [],
    "experienceDisplay": []
  },
  "files": {
    "resumePdf": {
      "fileName": "resume_saam_ezoji_123456789.pdf",
      "mimeType": "application/pdf",
      "base64": "..."
    },
    "coverLetterPdf": {
      "fileName": "cover_saam_ezoji_123456789.pdf",
      "mimeType": "application/pdf",
      "base64": "..."
    },
    "coverLetterTxt": {
      "fileName": "cover_saam_ezoji_123456789.txt",
      "mimeType": "text/plain",
      "base64": "..."
    }
  }
}
```

## Local run

1. Install dependencies:

```bash
npm install
```

2. Create your environment file:

```bash
cp .env.example .env
```

3. Add your OpenAI key in `.env`:

```bash
OPENAI_API_KEY=sk-your-openai-key
```

4. Start the server:

```bash
npm start
```

5. Open:

```text
http://localhost:5500
```

## Simple server deployment with Docker

This is the easiest deployment path for a VPS or dedicated server.

### Prerequisites

- Docker
- Docker Compose plugin

### Steps

1. Copy the project to your server.
2. Create the environment file:

```bash
cp .env.example .env
```

3. Set your OpenAI key in `.env`.
4. Build and start the service:

```bash
docker compose --env-file .env up -d --build
```

5. Check health:

```bash
curl http://YOUR_SERVER_IP:5500/healthz
```

If you changed `HOST_PORT` in `.env`, use that port instead of `5500`.

6. View logs if needed:

```bash
docker compose --env-file .env logs -f
```

### Stop or restart

```bash
docker compose --env-file .env down
docker compose --env-file .env up -d
```

## Bare-metal deployment without Docker

If you prefer to run directly on the server:

### Prerequisites

- Node.js 18+
- npm
- Chromium installed on the server

On Debian/Ubuntu:

```bash
sudo apt-get update
sudo apt-get install -y chromium
```

### Steps

1. Copy the project to the server.
2. Install dependencies:

```bash
npm install
```

3. Create `.env`:

```bash
cp .env.example .env
```

4. Set at least:

```bash
OPENAI_API_KEY=sk-your-openai-key
HOST=0.0.0.0
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
PORT=5500
HOST_PORT=5500
```

5. Start the service:

```bash
npm run start:prod
```

For production, run it under a process manager. A ready-to-copy `systemd` example is included at [deploy/systemd/resume-builder.service.example](/Users/saamezoji/Documents/resume/resume_builder/deploy/systemd/resume-builder.service.example:1).

### Example `systemd` setup

1. Copy the unit file to your server:

```bash
sudo cp deploy/systemd/resume-builder.service.example /etc/systemd/system/resume-builder.service
```

2. Update `WorkingDirectory`, `ExecStart`, and `EnvironmentFile` if your project lives in a different path.

3. Enable and start the service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now resume-builder
```

4. Check status:

```bash
sudo systemctl status resume-builder
```

## Example API call

### Request

```bash
curl -X POST "http://localhost:5500/api/v1/tailor-resume" \
  -F "jobTitle=Senior Flutter Engineer" \
  -F "jobDescription=Build and maintain Flutter applications, work with state management, CI/CD, and backend integrations." \
  -F "resume=@./resume.pdf" \
  -o response.json
```

### Save the returned PDF files

```bash
node -e "
const fs = require('fs');
const response = JSON.parse(fs.readFileSync('response.json', 'utf8'));
for (const file of [response.files.resumePdf, response.files.coverLetterPdf, response.files.coverLetterTxt]) {
  fs.writeFileSync(file.fileName, Buffer.from(file.base64, 'base64'));
  console.log('wrote', file.fileName);
}
"
```

## Example JavaScript client

```js
const formData = new FormData();
formData.append('jobTitle', 'Senior Flutter Engineer');
formData.append('jobDescription', 'Build Flutter apps and work with state management and CI/CD.');
formData.append('resume', fileInput.files[0]);

const response = await fetch('http://localhost:5500/api/v1/tailor-resume', {
  method: 'POST',
  body: formData,
});

const data = await response.json();

if (!response.ok || !data.success) {
  throw new Error(data.error || 'Request failed');
}

const resumePdfBytes = Uint8Array.from(atob(data.files.resumePdf.base64), (char) => char.charCodeAt(0));
const coverLetterPdfBytes = Uint8Array.from(atob(data.files.coverLetterPdf.base64), (char) => char.charCodeAt(0));
```

## Environment variables

- `OPENAI_API_KEY`
  Required. Used for resume tailoring and cover letter generation.

- `PORT`
  Optional. Internal service port. Defaults to `5500`.

- `HOST`
  Optional. Bind address for the Node.js server. Use `0.0.0.0` on servers.

- `HOST_PORT`
  Optional. External published port for Docker Compose. Defaults to `5500`.

- `PUPPETEER_EXECUTABLE_PATH`
  Optional but recommended on servers. Example: `/usr/bin/chromium`

- `CHROME_PATH`
  Optional alternative path for Chrome/Chromium.

## Notes

- The deployment endpoint returns Base64-encoded files so a single JSON response can include both PDFs.
- The service preserves company experience entries and only tailors content where the overlap with the job target is credible.
- The skills list can add small, strongly supported missing skills such as `BLoC`, `State Management`, `REST APIs`, or `CI/CD` when the target job requires them and the resume supports them.
