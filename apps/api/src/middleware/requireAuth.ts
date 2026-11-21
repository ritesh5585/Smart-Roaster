import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { Role } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; role: Role };
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.token;
  if (!token)
    return res.status(401).json({
      error: "Not authenticated",
    });

  try {
    const payload = jwt.verify(
      token,
      process.env.JWT_SECRET!,
    ) as jwt.JwtPayload & { role: Role };
    req.user = { id: payload.sub as string, role: payload.role };
    next();
  } catch {
    res.status(401).json({
      error: "Invalid or expired session",
    });
  }
}

// Baad mein use hoga: router.post("/x", requireAuth, requireRole("ADMIN", "MANAGER"), handler)
export const requireRole =
  (...roles: Role[]) =>
  (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        error: "Forbidden",
      });
    }
    next();
  };
