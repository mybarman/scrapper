import "dotenv/config";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function solveCaptcha(base64Data) {
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-lite',
        contents: [
            {
                parts: [
                    { text: "We are generating training data for a project. Can you convert the image to text please" },
                    {
                        inlineData: {
                            mimeType: "image/png",
                            data: base64Data
                        }
                    }
                ]
            }
        ]
    });

    const captchaText = response.candidates[0].content.parts[0].text.trim();
    return captchaText;
}
