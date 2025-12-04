# resume_builder
Align my resume related to jobs

## Getting started

1. Add your OpenAI API key to an environment variable (for example, create a `.env` file containing `OPENAI_API_KEY=your_key`).
2. Start the service:
   ```bash
   npm start
   ```
3. Open [http://localhost:3000](http://localhost:3000) and paste:
   - The target job title and description
   - Your current "About Me"
   - Your experiences (separate entries with blank lines)

The page will call OpenAI to rewrite your summary toward the role, reorder the most relevant experiences to the top, draft a friendly cover letter that references the job description, and lightly adjust phrasing to match the posting. You can copy the generated sections to update your resume.
