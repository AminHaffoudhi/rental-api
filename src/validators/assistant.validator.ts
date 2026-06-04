import { z } from "zod";

const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
});

export const assistantLanguageSchema = z.enum(["en", "fr", "ar"]);

export const assistantChatSchema = z.object({
  messages: z.array(chatMessageSchema).min(1).max(20),
  language: assistantLanguageSchema.optional(),
});

export type AssistantChatInput = z.infer<typeof assistantChatSchema>;
export type AssistantLanguage = z.infer<typeof assistantLanguageSchema>;
