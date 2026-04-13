// Using native fetch in Node.js 22
import dotenv from 'dotenv';
dotenv.config();

async function test() {
  const apiKey = process.env.GEMINI_API_KEY;
  const url = `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gemini-flash-latest',
        messages: [{ role: 'user', content: 'Say hello' }]
      })
    });

    console.log('STATUS:', response.status);
    const data = await response.json();
    console.log('DATA:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('ERROR:', err);
  }
}

test();
