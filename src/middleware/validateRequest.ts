import { AnyZodObject, ZodError } from "zod";
import { Request, Response, NextFunction } from "express";
import { formatZodError } from "../utils/formatZodError";

export const validateRequest =
  (schema: AnyZodObject) =>
  (req: Request, res: Response, next: NextFunction) => {
    console.log(req.body);
    
    try {
      schema.parse({
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
