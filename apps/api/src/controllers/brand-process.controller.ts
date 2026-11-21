import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { Prisma, OperatingRule } from "@prisma/client";

const createBrandProcessSchema = z.object({
  brandId: z.string().trim().uuid(),
  processId: z.string().trim().uuid(),
  operatingRule: z.nativeEnum(OperatingRule).optional(),
  minCoverage: z.number().int().min(1).max(20).optional(),
});

const updateBrandProcessSchema = z.object({
  operatingRule: z.nativeEnum(OperatingRule).optional(),
  minCoverage: z.number().int().min(1).max(20).optional(),
});

export async function createBrandProcess(req: Request, res: Response) {
  const parsed = createBrandProcessSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const { brandId, processId, operatingRule, minCoverage } = parsed.data;
  try {
    const brandProcess = await prisma.brandProcess.create({
      data: {
        brandId,
        processId,
        ...(operatingRule ? { operatingRule } : {}),
        ...(minCoverage !== undefined ? { minCoverage } : {}),
      },
      include: {
        brand: true,
        process: true,
        assignments: true,
      },
    });
    res.status(201).json(brandProcess);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2002") {
        return res
          .status(409)
          .json({
            error: "BrandProcess already exists for this brand and process",
          });
      }
      if (err.code === "P2003") {
        return res
          .status(400)
          .json({ error: "Referenced brand or process does not exist" });
      }
    }
    throw err;
  }
}

export async function updateBrandProcess(req: Request, res: Response) {
  const parsed = updateBrandProcessSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const id = req.params.id as string;
  const data: { operatingRule?: OperatingRule; minCoverage?: number } = {};
  if (parsed.data.operatingRule !== undefined)
    data.operatingRule = parsed.data.operatingRule;
  if (parsed.data.minCoverage !== undefined)
    data.minCoverage = parsed.data.minCoverage;

  if (Object.keys(data).length === 0)
    return res.status(400).json({ error: "No fields to update" });

  try {
    const brandProcess = await prisma.brandProcess.update({
      where: { id },
      data,
      include: {
        brand: true,
        process: true,
        assignments: true,
      },
    });
    res.json(brandProcess);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2025")
        return res.status(404).json({ error: "BrandProcess not found" });
    }
    throw err;
  }
}

export async function deleteBrandProcess(req: Request, res: Response) {
  const id = req.params.id as string;
  try {
    await prisma.brandProcess.delete({
      where: { id },
    });
    res.json({ message: "BrandProcess deleted" });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2025")
        return res.status(404).json({ error: "BrandProcess not found" });
    }
    throw err;
  }
}
