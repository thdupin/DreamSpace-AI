
import { GoogleGenAI, Type } from "@google/genai";

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const generateDesign = async (base64Image: string, stylePrompt: string): Promise<string> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: 'image/png',
            data: base64Image,
          },
        },
        {
          text: `You are an expert interior designer. Please ${stylePrompt}. Maintain the basic structure and layout of the original room but transform all furniture, textures, and lighting to match the requested style.`,
        },
      ],
    },
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  throw new Error("Failed to generate image");
};

export const editDesign = async (currentImageBase64: string, instruction: string): Promise<string> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: 'image/png',
            data: currentImageBase64.includes(',') ? currentImageBase64.split(',')[1] : currentImageBase64,
          },
        },
        {
          text: `Modify this interior design based on the following instruction: "${instruction}". Keep the rest of the room exactly as it is but implement the requested change seamlessly.`,
        },
      ],
    },
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  throw new Error("Failed to edit image");
};

export const chatWithDesigner = async (message: string, history: { role: 'user' | 'model', text: string }[]) => {
  const ai = getAI();
  
  // We use a JSON schema to ensure we get a structured response indicating if an image update is needed.
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: [
      ...history.map(h => ({ role: h.role, parts: [{ text: h.text }] })),
      { role: 'user', parts: [{ text: message }] }
    ],
    config: {
      systemInstruction: `You are DreamSpace AI, a professional interior design consultant. 
      You help users refine their room designs. 
      IMPORTANT: You must determine if the user is asking for a visual change to the image (e.g. "add a plant", "change the rug to blue", "remove the chair").
      If they are asking for a visual change, set shouldUpdateImage to true.
      If they are just asking for advice or links, set shouldUpdateImage to false.
      Provide concise, helpful design advice in your text response. If you suggested links, they will be handled by search grounding.`,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          text: { type: Type.STRING, description: "Your conversational response to the user." },
          shouldUpdateImage: { type: Type.BOOLEAN, description: "Whether the user's request requires modifying the current room image." }
        },
        required: ["text", "shouldUpdateImage"]
      },
      tools: [{ googleSearch: {} }]
    }
  });

  const parsed = JSON.parse(response.text);
  return {
    text: parsed.text || "I'm sorry, I couldn't process that.",
    shouldUpdateImage: !!parsed.shouldUpdateImage,
    grounding: response.candidates?.[0]?.groundingMetadata?.groundingChunks || []
  };
};
