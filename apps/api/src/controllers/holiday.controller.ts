import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { Prisma } from "@prisma/client";
import { dateStringSchema, formatDate, parseDate } from "../lib/date";

const createHolidaySchema = z.object({
  date: dateStringSchema,
  name: z.string().trim().min(1).max(100),
});

export async function getHolidays(req: Request, res: Response) {
  const yearParam = req.query.year;
  let where: Prisma.HolidayWhereInput | undefined;

  if (yearParam) {
    if (typeof yearParam !== "string" || !/^\d{4}$/.test(yearParam)) {
      return res
        .status(400)
        .json({ error: "Invalid year format, expected YYYY" });
    }
    const start = parseDate(`${yearParam}-01-01`);
    const end = parseDate(`${yearParam}-12-31`);
    where = {
      date: {
        gte: start,
        lte: end,
      },
    };
  }

  const holidays = await prisma.holiday.findMany({
    where,
    orderBy: { date: "asc" },
  });

  res.json(
    holidays.map((h) => ({
      id: h.id,
      name: h.name,
      date: formatDate(h.date),
    })),
  );
}

export async function createHoliday(req: Request, res: Response) {
  const parsed = createHolidaySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const { date, name } = parsed.data;

  try {
    const holiday = await prisma.holiday.create({
      data: {
        date: parseDate(date),
        name,
      },
    });
    res.status(201).json({
      id: holiday.id,
      name: holiday.name,
      date: formatDate(holiday.date),
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2002") {
        return res
          .status(409)
          .json({ error: "A holiday with this date already exists" });
      }
    }
    throw err;
  }
}

export async function deleteHoliday(req: Request, res: Response) {
  const id = req.params.id as string;
  try {
    await prisma.holiday.delete({
      where: { id },
    });
    res.json({ message: "Holiday deleted" });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2025") {
        return res.status(404).json({ error: "Holiday not found" });
      }
    }
    throw err;
  }
}
