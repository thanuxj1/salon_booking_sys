import dotenv from 'dotenv';
dotenv.config();

async function test() {
  const apiKey = process.env.GEMINI_API_KEY;
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

  try {
    const response = await fetch(url);
    console.log('STATUS:', response.status);
    const data = await response.json();
    if (data.models) {
      console.log('MODELS FOUND:', data.models.map(m => m.name).join(', '));
    } else {
      console.log('DATA:', JSON.stringify(data, null, 2));
    }
  } catch (err) {
    console.error('ERROR:', err);
  }
}

test();
