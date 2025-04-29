import { z } from 'zod';

export const joinRequestSchema = z.object({
  lobbyId: z.string().uuid(),
  message: z.string().optional(),
});

export type JoinRequestDto = z.infer<typeof joinRequestSchema>;

export const requestResponseSchema = z.object({
  lobbyId: z.string().uuid(),
  userId: z.string().uuid(),
  status: z.enum(['accepted', 'rejected']),
});

export type RequestResponseDto = z.infer<typeof requestResponseSchema>;
