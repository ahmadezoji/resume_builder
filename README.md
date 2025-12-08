# resume_builder

AI-powered resume assistant that rewrites your summary, reorders your experience, drafts a cover letter, and exports a polished PDF so you can ship a tailored résumé without manual editing.

## Purpose

- Automate CV tailoring for job-specific submissions.
- Keep the visual layout of your original resume while inserting role-aligned content.
- Provide ready-to-copy sections (About Me, experiences, cover letter) plus downloadable PDF/TXT files you can share on platforms like Gumroad or Ko-fi.

## Features

- Upload any PDF resume: the server extracts the text and feeds it to OpenAI along with the target job description.
- Generates aligned About Me, skills, reordered experiences, and a friendly cover letter.
- Creates a refreshed résumé PDF via an HTML template rendered with Puppeteer, preserving a professional format.
- Exposes `/api/tailor` for quick prompt-based tailoring (no file upload) and `/api/upload-resume` for the full PDF workflow.

## Run locally

1. **Install dependencies**
   ```bash
   npm install
   ```
2. **Add your OpenAI key**
   - Create a `.env` file in the project root.
   - Add `OPENAI_API_KEY=sk-your-key`.
3. **Start the server**
   ```bash
   npm start
   ```
4. **Open the UI**
   - Navigate to [http://localhost:5500](http://localhost:5500).
   - Paste the job title + description, then either paste your resume summary for quick tailoring or upload your PDF for the full automation flow.

## Usage tips

- Keep your resume facts honest; the assistant only polishes wording and reorders entries.
- After processing, copy the rewritten text blocks or download the optimized PDF and cover_letter.txt for sharing.
- Because PDFs are generated server-side, you can host this project and sell access to automated, role-specific resume tailoring on marketplaces (Gumroad, Ko-fi, etc.). Provide your users with their own OpenAI key or proxy the requests through yours with appropriate usage controls.
