import { NextFunction, Request, Response } from 'express';
import { ZodSchema, ZodError } from 'zod'; // Change AnyZodObject to ZodSchema
import { formatZodError } from '../utils/formatZodError';

export const validateRequest = (schema: ZodSchema) => // Use ZodSchema here
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync({
        body: req.body,
        params: req.params,
        query: req.query,
      });
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: formatZodError(error),
        });
      }
      next(error);
    }
  };
