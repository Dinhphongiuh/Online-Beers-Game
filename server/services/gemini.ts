/** Gemini client (server-side only). `ai` stays null without GEMINI_API_KEY → offline fallbacks. */
import { GoogleGenAI } from '@google/genai';

// Initialize Gemini Client server-side
const apiKey = process.env.GEMINI_API_KEY;
export const geminiConfigured = Boolean(apiKey);
export let ai: GoogleGenAI | null = null;
if (apiKey) {
  ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}
