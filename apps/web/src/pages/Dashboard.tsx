import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Navbar from "../components/Navbar";
import { api, type Leave, type RosterStatus } from "../lib/api";
import { formatDisplayDate } from "../lib/dateUtils";

interface CurrentRosterInfo {
  id: string;
  status: RosterStatus;
  version: number;
  errors: number;
  warnings: number;
  coveragePercent: number;
}

export default function Dashboard() {
  const { user } = useAuth();

  const [activeEmpCount, setActiveEmpCount] = useState<number | null>(null);
  const [empError, setEmpError] = useState<string | null>(null);

  const [activeBrandsCount, setActiveBrandsCount] = useState<number | null>(null);
  const [brandError, setBrandError] = useState<string | null>(null);

  const [podsCount, setPodsCount] = useState<number | null>(null);
  const [podError, setPodError] = useState<string | null>(null);

  const [rosterInfo, setRosterInfo] = useState<CurrentRosterInfo | null>(null);
  const [rosterChecked, setRosterChecked] = useState(false);
  const [rosterError, setRosterError] = useState<string | null>(null);

  const [upcomingLeaves, setUpcomingLeaves] = useState<Leave[]>([]);
  const [leavesError, setLeavesError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    // Date computation following the strict date rule:
    // Never use new Date(string); build today/+14 days from local year/month/day numbers,
    // format with padStart, and handle day overflow via new Date(y, m, d + 14) then read local parts.
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth(); // 0-based
    const d = now.getDate();

    const todayStr = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

    const future = new Date(y, m, d + 14);
    const fy = future.getFullYear();
    const fm = future.getMonth() + 1;
    const fd = future.getDate();
    const futureStr = `${fy}-${String(fm).padStart(2, "0")}-${String(fd).padStart(2, "0")}`;

    const currentYear = y;
    const currentMonth = m + 1;

    Promise.all([
      api.getEmployees({ active: true }),
      api.getBrands(),
      api.getPods(),
      api.getRosterByMonth(currentYear, currentMonth),
      api.getLeaves({ from: todayStr, to: futureStr }),
    ]).then(async ([empRes, brandRes, podRes, rosterMonthRes, leavesRes]) => {
      if (cancelled) return;

      // 1. Employees
      if (empRes.error) {
        setEmpError(empRes.error);
      } else if (Array.isArray(empRes.data)) {
        setActiveEmpCount(empRes.data.length);
      }

      // 2. Active Brands
      if (brandRes.error) {
        setBrandError(brandRes.error);
      } else if (Array.isArray(brandRes.data)) {
        const activeBrands = brandRes.data.filter((b) => b.isActive);
        setActiveBrandsCount(activeBrands.length);
      }

      // 3. Pods
      if (podRes.error) {
        setPodError(podRes.error);
      } else if (Array.isArray(podRes.data)) {
        setPodsCount(podRes.data.length);
      }

      // 4. Upcoming Leaves
      if (leavesRes.error) {
        setLeavesError(leavesRes.error);
      } else if (Array.isArray(leavesRes.data)) {
        setUpcomingLeaves(leavesRes.data);
      }

      // 5. Current Month Roster
      if (rosterMonthRes.error) {
        setRosterError(rosterMonthRes.error);
        setRosterChecked(true);
      } else if (rosterMonthRes.data?.roster) {
        const rosterHeader = rosterMonthRes.data.roster;
        const rosterDetailRes = await api.getRoster(rosterHeader.id);
        if (cancelled) return;

        if (rosterDetailRes.error) {
          setRosterError(rosterDetailRes.error);
        } else if (rosterDetailRes.data) {
          const view = rosterDetailRes.data;
          setRosterInfo({
            id: view.roster.id,
            status: view.roster.status,
            version: view.roster.version,
            errors: view.summary.errors,
            warnings: view.summary.warnings,
            coveragePercent: view.summary.coveragePercent,
          });
        }
        setRosterChecked(true);
      } else {
        setRosterChecked(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const firstName = user?.name ? user.name.trim().split(/\s+/)[0] : "there";

  const statTiles = [
    {
      label: "Employees",
      value: activeEmpCount !== null ? String(activeEmpCount) : "--",
      note: empError ? empError : activeEmpCount !== null ? "Active staff" : "Loading…",
      valueColor: "text-[#1D1C1A]",
      isError: !!empError,
    },
    {
      label: "Active brands",
      value: activeBrandsCount !== null ? String(activeBrandsCount) : "--",
      note: brandError ? brandError : activeBrandsCount !== null ? "Operating brands" : "Loading…",
      valueColor: "text-[#1D1C1A]",
      isError: !!brandError,
    },
    {
      label: "Pods",
      value: podsCount !== null ? String(podsCount) : "--",
      note: podError ? podError : podsCount !== null ? "Operational pods" : "Loading…",
      valueColor: "text-[#1D1C1A]",
      isError: !!podError,
    },
    {
      label: "Open errors",
      value: rosterInfo !== null ? String(rosterInfo.errors) : "--",
      note: rosterError
        ? rosterError
        : rosterInfo !== null
        ? rosterInfo.errors === 1
          ? "1 open error"
          : `${rosterInfo.errors} open errors`
        : rosterChecked
        ? "No roster yet"
        : "Loading…",
      valueColor:
        rosterInfo !== null
          ? rosterInfo.errors > 0
            ? "text-[#A3262A]"
            : "text-[#1F4D3A]"
          : "text-[#1D1C1A]",
      isError: !!rosterError,
    },
  ];

  return (
    <div className="min-h-screen bg-[#F5F2EC]">
      <Navbar />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {/* Welcome Header */}
        <div className="mb-8">
          <h1 className="font-['Newsreader',Georgia,serif] text-3xl font-medium tracking-tight text-[#1D1C1A]">
            {greeting}, {firstName}
          </h1>
          <p className="mt-1 text-sm text-[#6B675F]">
            Operations Dashboard •{" "}
            <span className="uppercase tracking-wider font-medium text-[#1F4D3A]">
              {user?.role}
            </span>
          </p>
        </div>

        {/* 4 Stat Tiles */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          {statTiles.map((tile) => (
            <div
              key={tile.label}
              className="rounded-[6px] border border-[#E2DDD3] bg-[#FFFFFF] p-5 transition-colors"
            >
              <div className="text-xs uppercase tracking-wider text-[#6B675F]">{tile.label}</div>
              <div className={`mt-2 text-2xl font-semibold ${tile.valueColor}`}>
                {tile.value}
              </div>
              <div className={`mt-1 text-xs ${tile.isError ? "text-[#A3262A]" : "text-[#6B675F]"}`}>
                {tile.note}
              </div>
            </div>
          ))}
        </div>

        {/* Main Content Grid: 2 cols on lg */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* This Month Panel: 2 cols */}
          <div className="lg:col-span-2 rounded-[6px] border border-[#E2DDD3] bg-[#FFFFFF] p-6">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <div className="flex items-center gap-2">
                <h2 className="font-['Newsreader',Georgia,serif] text-xl font-medium text-[#1D1C1A]">
                  This month
                </h2>
                {rosterInfo && (
                  <>
                    <span
                      className={`rounded-[6px] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                        rosterInfo.status === "PUBLISHED"
                          ? "bg-[#E4ECE6] text-[#1F4D3A]"
                          : "border border-[#B45309]/30 bg-[#B45309]/10 text-[#B45309]"
                      }`}
                    >
                      {rosterInfo.status}
                    </span>
                    <span className="text-xs text-[#6B675F]">v{rosterInfo.version}</span>
                  </>
                )}
              </div>
              {rosterInfo && (
                <Link
                  to="/roster"
                  className="text-xs font-medium text-[#1F4D3A] hover:underline"
                >
                  Open roster →
                </Link>
              )}
            </div>

            {rosterError ? (
              <p className="text-xs text-[#A3262A] py-6 text-center">{rosterError}</p>
            ) : rosterInfo ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="rounded-[6px] border border-[#E2DDD3] p-4">
                    <div className="text-xs uppercase tracking-wider text-[#6B675F]">Coverage</div>
                    <div className="mt-1 text-2xl font-semibold text-[#1D1C1A]">
                      {rosterInfo.coveragePercent}%
                    </div>
                    <div className="text-xs text-[#6B675F] mt-0.5">Required staffing</div>
                  </div>
                  <div className="rounded-[6px] border border-[#E2DDD3] p-4">
                    <div className="text-xs uppercase tracking-wider text-[#6B675F]">Errors</div>
                    <div
                      className={`mt-1 text-2xl font-semibold ${
                        rosterInfo.errors > 0 ? "text-[#A3262A]" : "text-[#1F4D3A]"
                      }`}
                    >
                      {rosterInfo.errors}
                    </div>
                    <div className="text-xs text-[#6B675F] mt-0.5">Mandatory gaps</div>
                  </div>
                  <div className="rounded-[6px] border border-[#E2DDD3] p-4">
                    <div className="text-xs uppercase tracking-wider text-[#6B675F]">Warnings</div>
                    <div
                      className={`mt-1 text-2xl font-semibold ${
                        rosterInfo.warnings > 0 ? "text-[#B45309]" : "text-[#6B675F]"
                      }`}
                    >
                      {rosterInfo.warnings}
                    </div>
                    <div className="text-xs text-[#6B675F] mt-0.5">Operational risks</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center">
                <p className="text-sm text-[#6B675F] mb-4">No roster generated yet.</p>
                <Link
                  to="/roster"
                  className="inline-flex items-center justify-center rounded-[6px] bg-[#1F4D3A] px-4 py-2 text-sm font-medium text-[#F5F2EC] hover:bg-[#1F4D3A]/90 transition-colors"
                >
                  Go to Roster
                </Link>
              </div>
            )}
          </div>

          {/* Upcoming Leaves (next 14 days) Panel: 1 col */}
          <div className="rounded-[6px] border border-[#E2DDD3] bg-[#FFFFFF] p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-['Newsreader',Georgia,serif] text-xl font-medium text-[#1D1C1A]">
                Upcoming leaves
              </h2>
              <span className="text-xs text-[#6B675F]">Next 14 days</span>
            </div>

            {leavesError ? (
              <p className="text-xs text-[#A3262A] py-4">{leavesError}</p>
            ) : upcomingLeaves.length === 0 ? (
              <p className="text-xs text-[#6B675F] py-4">No upcoming leaves.</p>
            ) : (
              <div className="space-y-3">
                {upcomingLeaves.map((leave) => {
                  const empName = leave.employeeName || leave.employee?.name || "Staff Member";
                  const datesText =
                    leave.startDate === leave.endDate
                      ? formatDisplayDate(leave.startDate)
                      : `${formatDisplayDate(leave.startDate)} – ${formatDisplayDate(leave.endDate)}`;

                  return (
                    <div
                      key={leave.id}
                      className="flex items-start justify-between gap-2 pb-3 border-b border-[#E2DDD3] last:border-b-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#1D1C1A] truncate">{empName}</p>
                        <p className="text-xs text-[#6B675F] mt-0.5">{datesText}</p>
                      </div>
                      <span
                        className={`shrink-0 rounded-[6px] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                          leave.type === "COMP_OFF"
                            ? "border border-[#B45309]/30 bg-[#B45309]/10 text-[#B45309]"
                            : "bg-[#E4ECE6] text-[#1F4D3A]"
                        }`}
                      >
                        {leave.type === "COMP_OFF" ? "Comp Off" : "Leave"}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
