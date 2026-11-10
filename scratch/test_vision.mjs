import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();

const apiKey = process.env.GEMINI_API_KEY || '';
console.log('API Key present:', !!apiKey);

const ai = new GoogleGenAI({ apiKey });

// 1x1 transparent PNG in base64
const testPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

const contentsParts = [
  {
    inlineData: {
      mimeType: 'image/png',
      data: testPngBase64,
    },
  },
  {
    text: 'What is in this image?',
  },
];

async function run() {
  try {
    const res = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: contentsParts,
    });
    console.log('Success! Response:', res.text);
  } catch (err) {
    console.error('Error generating content:', err);
  }
}

run();
