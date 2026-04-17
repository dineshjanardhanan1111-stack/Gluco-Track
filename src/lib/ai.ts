import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const aiService = {
  async analyzeMeal(mealName: string, notes?: string): Promise<string> {
    try {
      const prompt = `You are a professional nutritionist. Analyze this meal description for someone tracking their blood sugar. Provide a very brief (2-3 sentences max) insight about its potential glycemic impact and any suggestions.
      Meal: ${mealName}
      Notes: ${notes || 'None'}`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-latest",
        contents: prompt,
      });

      return response.text || "No insights available.";
    } catch (e) {
      console.error("AI Analysis error:", e);
      return "Unable to analyze meal at this time.";
    }
  },

  async generateHealthReport(data: { glucose: any[], meals: any[], medications: any[] }): Promise<string> {
    try {
      const prompt = `As a doctor's assistant, summarize the following health data into a professional report. Focus on trends, average glucose, and relationship between meals and glucose levels. Keep it concise for a quick review.
      Glucose Readings: ${JSON.stringify(data.glucose.slice(0, 10))}
      Recent Meals: ${JSON.stringify(data.meals.slice(0, 5))}
      Medications: ${JSON.stringify(data.medications.slice(0, 5))}`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-latest",
        contents: prompt,
      });

      return response.text || "Report generation failed.";
    } catch (e) {
      console.error("AI Report error:", e);
      return "Unable to generate report at this time.";
    }
  }
};
