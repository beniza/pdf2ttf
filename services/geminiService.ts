import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

/**
 * edits an image using Gemini 2.5 Flash Image based on a text prompt.
 */
export const editImageWithGemini = async (
  base64Image: string, 
  prompt: string
): Promise<string> => {
  try {
    // Remove header if present (data:image/png;base64,)
    const base64Data = base64Image.split(',')[1] || base64Image;
    const mimeType = base64Image.match(/data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+).*,.*/)?.[1] || 'image/png';

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            text: prompt,
          },
          {
            inlineData: {
              data: base64Data,
              mimeType: mimeType,
            },
          },
        ],
      },
    });

    // Iterate through parts to find the image output
    if (response.candidates && response.candidates[0].content.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
          return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
        }
      }
    }

    throw new Error("No image generated in response.");

  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};