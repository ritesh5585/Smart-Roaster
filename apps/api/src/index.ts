import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/auth.routes";
import podRoutes from "./routes/pod.routes";
import employeeRoutes from "./routes/employee.routes";
import processRoutes from "./routes/process.routes";
import brandRoutes from "./routes/brand.routes";
import brandProcessRoutes from "./routes/brand-process.routes";
import assignmentRoutes from "./routes/assignment.routes";
import holidayRoutes from "./routes/holiday.routes";
import leaveRoutes from "./routes/leave.routes";
import rosterRoutes from "./routes/roster.routes";

for (const key of ["DATABASE_URL", "JWT_SECRET", "CLIENT_ORIGIN"]) {
  if (!process.env[key]) throw new Error(`Missing env var: ${key}`);
}

const app = express();

app.set("trust proxy", 1);

app.use(helmet());
app.use(
  cors({
    origin: [
      process.env.CLIENT_ORIGIN || "http://localhost:5173",
      "http://localhost:5173",
    ],
    credentials: true,
  }),
);
app.use(express.json({ limit: "10kb" }));
app.use(cookieParser());

app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/auth", authRoutes);
app.use("/pods", podRoutes);
app.use("/employees", employeeRoutes);
app.use("/processes", processRoutes);
app.use("/brands", brandRoutes);
app.use("/brand-processes", brandProcessRoutes);
app.use("/assignments", assignmentRoutes);
app.use("/holidays", holidayRoutes);
app.use("/leaves", leaveRoutes);
app.use("/rosters", rosterRoutes);

const port = Number(process.env.PORT) || 4000;
if (!process.env.VERCEL) {
  app.listen(port, () => console.log(`API running on :${port}`));
}

export default app;
