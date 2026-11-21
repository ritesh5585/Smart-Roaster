import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { Prisma } from "@prisma/client";

const createPodSchema = z.object({
  name: z.string().trim().min(1).max(100),
  leadId: z.string().trim().uuid().optional().nullable(),
});

const updatePodSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  leadId: z.string().trim().uuid().optional().nullable(),
});

export async function getPods(_req: Request, res: Response) {
  const pods = await prisma.pod.findMany({
    include: {
      lead: true,
      _count: { select: { members: true } },
    },
    orderBy: { name: "asc" },
  });
  res.json(pods);
}

export async function createPod(req: Request, res: Response) {
  const parsed = createPodSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const { name, leadId } = parsed.data;
  try {
    const pod = await prisma.pod.create({
      data: {
        name,
        leadId: leadId || null,
      },
      include: {
        lead: true,
        _count: { select: { members: true } },
      },
    });
    res.status(201).json(pod);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2002")
        return res
          .status(409)
          .json({ error: "Pod name or lead already exists" });
      if (err.code === "P2003")
        return res
          .status(400)
          .json({ error: "Referenced lead does not exist" });
    }
    throw err;
  }
}

export async function updatePod(req: Request, res: Response) {
  const parsed = updatePodSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const id = req.params.id as string;
  const data: { name?: string; leadId?: string | null } = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name;
  if (parsed.data.leadId !== undefined) data.leadId = parsed.data.leadId;

  if (Object.keys(data).length === 0)
    return res.status(400).json({ error: "No fields to update" });

  try {
    const pod = await prisma.pod.update({
      where: { id },
      data,
      include: {
        lead: true,
        _count: { select: { members: true } },
      },
    });
    res.json(pod);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2025")
        return res.status(404).json({ error: "Pod not found" });
      if (err.code === "P2002")
        return res
          .status(409)
          .json({ error: "Pod name or lead already exists" });
      if (err.code === "P2003")
        return res
          .status(400)
          .json({ error: "Referenced lead does not exist" });
    }
    throw err;
  }
}
