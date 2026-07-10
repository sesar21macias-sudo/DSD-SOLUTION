import OpenAI from "openai";
import type { Message } from "./db";
import { SYSTEM_PROMPT } from "./system-prompt";

function getClient() {
  return new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: "https://openrouter.ai/api/v1",
  });
}

function getModel() {
  return process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini";
}

/**
 * Los mensajes 'human' (enviados desde el dashboard) se mapean a 'assistant'
 * para el LLM: desde la perspectiva del modelo, son respuestas previas suyas.
 */
export async function generateReply(history: Message[]): Promise<string> {
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history.map((m): OpenAI.Chat.ChatCompletionMessageParam => ({
      role: m.role === "user" ? "user" : "assistant",
      content: m.content,
    })),
  ];

  const client = getClient();
  const completion = await client.chat.completions.create({
    model: getModel(),
    messages,
    max_tokens: 400,
    temperature: 0.6,
  });

  return completion.choices[0]?.message?.content?.trim() || "Disculpa, no entendí. ¿Puedes repetirlo?";
}
