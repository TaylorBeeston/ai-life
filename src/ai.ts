import { GoogleGenerativeAI } from "@google/generative-ai";

export const genAI = new GoogleGenerativeAI(process.env.GEMINI_TOKEN);

export const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

/* const result = await model.generateContent(
    "What are the main chemical incentivizers in the human brain?",
);

console.log(result.response.text()); */
