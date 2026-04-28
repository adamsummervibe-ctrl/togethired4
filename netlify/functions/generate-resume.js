// Netlify Function: generate-resume
// Calls Anthropic API server-side so the API key stays hidden

exports.handler = async (event) => {
  // Only accept POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

  if (!ANTHROPIC_API_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'API key not configured' })
    };
  }

  try {
    const body = JSON.parse(event.body);
    const userData = body.userData;

    if (!userData) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing user data' })
      };
    }

    // Build the prompt
    const expText = userData.exps.map(e =>
      `${e.title} at ${e.company} (${e.start} – ${e.end}): ${e.desc}`
    ).join('\n');

    const prompt = `You are an expert resume writer. Generate a complete, ATS-optimized resume in JSON format for a ${userData.targetJob} role.

Candidate info:
Name: ${userData.fname} ${userData.lname}
Email: ${userData.email}
Phone: ${userData.phone}
Location: ${userData.location}
LinkedIn: ${userData.linkedin || 'N/A'}

Work Experience:
${expText}

Education: ${userData.degree} from ${userData.school} (${userData.gradYear})${userData.gpa ? ' GPA: ' + userData.gpa : ''}

Skills: ${userData.techSkills}${userData.softSkills ? ', ' + userData.softSkills : ''}

Job description/keywords: ${userData.jobDesc || 'General ' + userData.targetJob + ' role'}

Return ONLY valid JSON with this structure (no markdown, no extra text):
{
  "summary": "3-4 sentence professional summary",
  "experiences": [
    {
      "title": "Job Title",
      "company": "Company Name",
      "start": "Month Year",
      "end": "Month Year or Present",
      "bullets": ["bullet 1 starting with strong action verb and including a metric", "bullet 2", "bullet 3"]
    }
  ],
  "skills": ["skill1","skill2","skill3","skill4","skill5","skill6","skill7","skill8"],
  "ats_score": 92,
  "ats_grade": "Excellent",
  "ats_message": "one sentence ATS assessment"
}`;

    // Call Anthropic API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: 'AI service error', details: errorText })
      };
    }

    const data = await response.json();
    const text = data.content[0].text;
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(parsed)
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Server error', message: error.message })
    };
  }
};
