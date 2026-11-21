import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { Prisma } from "@prisma/client";

const createBrandSchema = z.object({
  name: z.string().trim().min(1).max(100),
});

const updateBrandSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  isActive: z.boolean().optional(),
});

export async function getBrands(_req: Request, res: Response) {
  const brands = await prisma.brand.findMany({
    include: {
      brandProcesses: {
        include: {
          process: true,
          assignments: {
            include: {
              employee: true,
            },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });
  res.json(brands);
}

export async function createBrand(req: Request, res: Response) {
  const parsed = createBrandSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const { name } = parsed.data;
  try {
    const brand = await prisma.brand.create({
      data: { name },
      include: {
        brandProcesses: {
          include: {
            process: true,
            assignments: {
              include: { employee: true },
            },
          },
        },
      },
    });
    res.status(201).json(brand);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2002")
        return res.status(409).json({ error: "Brand name already exists" });
    }
    throw err;
  }
}

export async function updateBrand(req: Request, res: Response) {
  const parsed = updateBrandSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const id = req.params.id as string;
  const data: { name?: string; isActive?: boolean } = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name;
  if (parsed.data.isActive !== undefined) data.isActive = parsed.data.isActive;

  if (Object.keys(data).length === 0)
    return res.status(400).json({ error: "No fields to update" });

  try {
    const brand = await prisma.brand.update({
      where: { id },
      data,
      include: {
        brandProcesses: {
          include: {
            process: true,
            assignments: {
              include: { employee: true },
            },
          },
        },
      },
    });
    res.json(brand);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2025")
        return res.status(404).json({ error: "Brand not found" });
      if (err.code === "P2002")
        return res.status(409).json({ error: "Brand name already exists" });
    }
    throw err;
  }
}
