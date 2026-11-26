import { z } from 'zod';

// passthrough keeps fields the tools do not read, so tool output stays unchanged.
const sessionTime = z
  .object({ busy: z.number().optional(), idle: z.number().optional() })
  .passthrough();

const session = z
  .object({ id: z.string().optional(), time: sessionTime.optional() })
  .passthrough();

const message = z.object({ type: z.string().optional() }).passthrough();

const fileDiff = z
  .object({
    file: z.string().optional(),
    status: z.string().optional(),
    additions: z.number().optional(),
  })
  .passthrough();

export const sessionResponseSchema = z.object({ data: session }).passthrough();
export const sessionListResponseSchema = z
  .object({ data: z.array(session) })
  .passthrough();
export const messageListResponseSchema = z
  .object({ data: z.array(message) })
  .passthrough();
export const diffListResponseSchema = z
  .object({ data: z.array(fileDiff) })
  .passthrough();
export const actionResponseSchema = z.object({}).passthrough().optional();

export type Session = z.infer<typeof session>;
export type SessionResponse = z.infer<typeof sessionResponseSchema>;
export type SessionListResponse = z.infer<typeof sessionListResponseSchema>;
export type Message = z.infer<typeof message>;
export type MessageListResponse = z.infer<typeof messageListResponseSchema>;
export type DiffListResponse = z.infer<typeof diffListResponseSchema>;
export type ActionResponse = z.infer<typeof actionResponseSchema>;
