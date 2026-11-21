import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { OAuth2Client } from "google-auth-library";
import { User } from "@prisma/client";
import { prisma } from "../lib/prisma";

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const isProd = process.env.NODE_ENV === "production";

// Frontend (Vercel) aur API (Render) alag domain par hongi -> prod mein sameSite "none" + secure zaroori
const cookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: (isProd ? "none" : "lax") as "none" | "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

const registerSchema = z.object({
  name: z.string().trim().min(2).max(60),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(72), // bcrypt 72 bytes ke baad ignore karta hai
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(72),
});

const googleSchema = z.object({ credential: z.string().min(10) });

const publicUser = (u: User) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
});

function startSession(res: Response, user: User) {
  const token = jwt.sign(
    { sub: user.id, role: user.role },
    process.env.JWT_SECRET!,
    { expiresIn: "7d" },
  );
  res.cookie("token", token, cookieOptions);
}

export async function register(req: Request, res: Response) {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });
  const { name, email, password } = parsed.data;

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists)
    return res.status(409).json({ error: "Email already registered" });

  // role body se kabhi nahi lete (mass assignment / privilege escalation); default EMPLOYEE
  const user = await prisma.user.create({
    data: { name, email, passwordHash: await bcrypt.hash(password, 12) },
  });

  startSession(res, user);
  res.status(201).json({ user: publicUser(user) });
}

export async function login(req: Request, res: Response) {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(401).json({ error: "Invalid email or password" });
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  const ok = user?.passwordHash
    ? await bcrypt.compare(password, user.passwordHash)
    : false;
  if (!user || !ok)
    return res.status(401).json({ error: "Invalid email or password" });

  startSession(res, user);
  res.json({ user: publicUser(user) });
}

export async function googleLogin(req: Request, res: Response) {
  const parsed = googleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: parsed.data.credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    payload = ticket.getPayload();
  } catch {
    return res.status(401).json({ error: "Invalid Google token" });
  }

  if (!payload?.email || !payload.email_verified) {
    return res.status(401).json({ error: "Google email not verified" });
  }

  const email = payload.email.toLowerCase();
  let user = await prisma.user.findFirst({
    where: { OR: [{ googleId: payload.sub }, { email }] },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        name: payload.name ?? email.split("@")[0],
        email,
        googleId: payload.sub,
      },
    });
  } else if (!user.googleId) {
    // pehle password se register tha, ab same verified email se Google link kar do
    user = await prisma.user.update({
      where: { id: user.id },
      data: { googleId: payload.sub },
    });
  }

  startSession(res, user);
  res.json({ user: publicUser(user) });
}

export async function me(req: Request, res: Response) {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) return res.status(401).json({ error: "User not found" });
  res.json({ user: publicUser(user) });
}

export function logout(_req: Request, res: Response) {
  const { maxAge, ...clearOptions } = cookieOptions; // clear karne ke options set karne wale se match hone chahiye
  res.clearCookie("token", clearOptions);
  res.json({ message: "Logged out" });
}
