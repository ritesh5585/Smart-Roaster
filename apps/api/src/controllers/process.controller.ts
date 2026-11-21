import { Request, Response } from "express";
import { prisma } from "../lib/prisma";

export async function getProcesses(_req: Request, res: Response) {
  const processes = await prisma.process.findMany({
    orderBy: { code: "asc" },
  });
  res.json(processes);
}
