import { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma";
import { CookieUtils } from "../utils/cookie";
import { sendError } from "../utils/apiResponse";

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const sessionToken = 
      CookieUtils.getCookie(req, "better-auth.session_token") || 
      (req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.split(" ")[1] : null);
   

    if (!sessionToken) {
      return sendError(res, {
        message: "Unauthorized: No session token provided",
        statusCode: 401
      });
    }
    
   const token = sessionToken.split(".")[0];
    const sessionData = await prisma.session.findUnique({
      where: {
        token: token,
        expiresAt: { gt: new Date() }
      },
      
      include: { user: true }
    });
    // console.log("session data",sessionData);
    // console.log("token",token);
    

    if (!sessionData || !sessionData.user) {
      return sendError(res, {
        message: "Unauthorized: Invalid or expired session",
        statusCode: 401
      });
    }

    const { user } = sessionData;

    if (user.status === "BANNED" || user.status === "DELETED" || user.isDeleted) {
      return sendError(res, {
        message: `Unauthorized: Account is ${user.status.toLowerCase()}`,
        statusCode: 403
      });
    }

    const now = new Date().getTime();
    const expiresAt = new Date(sessionData.expiresAt).getTime();
    const createdAt = new Date(sessionData.createdAt).getTime();

    const totalLifetime = expiresAt - createdAt;
    const remainingTime = expiresAt - now;
    const percentRemaining = (remainingTime / totalLifetime) * 100;

    if (percentRemaining < 20) {
      res.setHeader('X-Session-Refresh', 'true');
      res.setHeader('X-Session-Expires-At', sessionData.expiresAt.toISOString());
    }

    res.locals.auth = {
      userId: user.id,
      role: user.role,
      email: user.email
    };

    return next();
  } catch (error) {
    console.error("Auth Middleware Error:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error during authentication"
    });
  }
}

export function roleMiddleware(allowedRoles: ("DOCTOR" | "PATIENT" | "ADMIN" | "SUPER_ADMIN")[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const auth = res.locals.auth;

    if (!auth || !allowedRoles.includes(auth.role)) {
      return res.status(403).json({ 
        success: false,
        error: "Forbidden: You do not have permission to perform this action" 
      });
    }

    next();
  };
}