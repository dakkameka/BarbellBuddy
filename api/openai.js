import OpenAI from 'openai';

export async function createOpenAIResponse({ model, messages, apiKey }) {
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set. Add it to your environment or repo-root .env file.');
  }

  const client = new OpenAI({ apiKey });
  const response = await client.chat.completions.create({
    model: model || 'gpt-4o-mini',
    messages,
    max_tokens: 700,
    temperature: 0.7,
  });

  return {
    output: response.choices[0].message.content.trim(),
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST allowed' });
  }

  try {
    const { model, messages } = req.body;
    const payload = await createOpenAIResponse({
      model,
      messages,
      apiKey: process.env.OPENAI_API_KEY,
    });
    return res.status(200).json(payload);
  } catch (err) {
    return res.status(500).json({
      error: err.message || 'Server error',
    });
  }
}
