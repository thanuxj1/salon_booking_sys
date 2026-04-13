import OpenAI from 'openai';
import dotenv from 'dotenv';
dotenv.config();

const openai = new OpenAI({ 
  apiKey: process.env.GEMINI_API_KEY,
  baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/v1"
});

async function test() {
  try {
    const completion = await openai.chat.completions.create({
      model: 'gemini-1.5-flash',
      messages: [{ role: 'user', content: 'Say hello' }],
    });
    console.log('SUCCESS:', completion.choices[0].message.content);
  } catch (err) {
    console.error('FAILED:', err.status, err.message);
    if (err.response) {
      console.error('Data:', await err.response.text());
    }
  }
}

test();
