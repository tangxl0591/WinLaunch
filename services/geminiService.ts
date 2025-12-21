
import { GoogleGenAI, Type } from "@google/genai";

export const suggestAppDetails = async (appName: string) => {
  // Initialize right before making an API call to ensure it always uses the most up-to-date API key
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Provide metadata for a Windows application named "${appName}". Suggest a professional description, a relevant category, and a brand color hex code.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            description: { type: Type.STRING },
            category: { type: Type.STRING },
            color: { type: Type.STRING },
            iconSearchTerm: { type: Type.STRING }
          },
          required: ["description", "category", "color"]
        }
      }
    });

    // Directly access the text property as a string (property access, not a method)
    const jsonStr = response.text?.trim();
    if (!jsonStr) {
      throw new Error("Empty response text from Gemini");
    }
    
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error("Gemini Error:", error);
    return null;
  }
};
