import { z } from 'zod';

export const extractOrderSchema = z.object({
  message: z.string().trim().min(1),
  phone: z.string().trim().optional()
});
