import { z } from "zod";

const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
});

export const assistantChatSchema = z.object({
  messages: z.array(chatMessageSchema).min(1).max(20),
});

export type AssistantChatInput = z.infer<typeof assistantChatSchema>;
