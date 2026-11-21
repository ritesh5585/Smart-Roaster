import { useState, useEffect, useRef, useMemo } from "react";
import Navbar from "../components/Navbar";
import { useAuth } from "../context/AuthContext";
import {
  api,
  type RosterView,
  type RosterEntry,
  type RosterIssue,
  type Suggestion,
} from "../lib/api";
import {
  monthDates,
  weekdayOf,
  weekdayLetter,
  formatDayNumber,
  formatDisplayDate,
  getCurrentMonthString,
  parseYearMonth,
} from "../lib/dateUtils";

type ViewTab = "company" | "pod" | "brand" | "process" | "employee";
type IssueFilter = "all" | "errors" | "warnings" | "preferences";

export default function RosterPage() {
  const { user } = useAuth();
  const canEdit = user?.role === "MANAGER";

  // Month selector
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthString());
  const { year, month } = useMemo(() => parseYearMonth(selectedMonth), [selectedMonth]);
  const dates = useMemo(() => monthDates(year, month), [year, month]);

  // Roster View data
  const [rosterView, setRosterView] = useState<RosterView | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Active view tab
  const [activeTab, setActiveTab] = useState<ViewTab>("company");

  // Filter selections for tabs
  const [selectedPodId, setSelectedPodId] = useState<string>("");
  const [selectedBrandName, setSelectedBrandName] = useState<string>("");
  const [selectedProcessCode, setSelectedProcessCode] = useState<string>("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");

  // Edit popover state
  const [editTarget, setEditTarget] = useState<{
    employeeId: string;
    date: string;
    currentStatus: string;
  } | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  // Dialogs
  const confirmRegenerateRef = useRef<HTMLDialogElement>(null);
  const confirmPublishRef = useRef<HTMLDialogElement>(null);

  // Issues filter & highlight state
  const [issueFilter, setIssueFilter] = useState<IssueFilter>("all");
  const [highlightedTarget, setHighlightedTarget] = useState<{
    employeeId?: string | null;
    brandProcessId?: string | null;
    date?: string | null;
  } | null>(null);

  // Suggestions state
  const [activeGapIssue, setActiveGapIssue] = useState<RosterIssue | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const rosterId = rosterView?.roster?.id;

  // Fetch roster by month
  const fetchRoster = async () => {
    setLoading(true);
    setError(null);
    setEditTarget(null);

    const monthRes = await api.getRosterByMonth(year, month);
    if (monthRes.error) {
      setError(monthRes.error);
      setRosterView(null);
      setLoading(false);
      return;
    }

    if (!monthRes.data?.roster) {
      setRosterView(null);
      setLoading(false);
      return;
    }

    const viewRes = await api.getRoster(monthRes.data.roster.id);
    if (viewRes.error) {
      setError(viewRes.error);
      setRosterView(null);
    } else if (viewRes.data) {
      setRosterView(viewRes.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setEditTarget(null);

    (async () => {
      const monthRes = await api.getRosterByMonth(year, month);
      if (cancelled) return;

      if (monthRes.error) {
        setError(monthRes.error);
        setRosterView(null);
        setLoading(false);
        return;
      }

      if (!monthRes.data?.roster) {
        setRosterView(null);
        setLoading(false);
        return;
      }

      const viewRes = await api.getRoster(monthRes.data.roster.id);
      if (cancelled) return;

      if (viewRes.error) {
        setError(viewRes.error);
        setRosterView(null);
      } else if (viewRes.data) {
        setRosterView(viewRes.data);
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [year, month]);

  // Set default tab selections when roster data arrives
  useEffect(() => {
    if (rosterView) {
      if (rosterView.meta.pods.length > 0 && !selectedPodId) {
        setSelectedPodId(rosterView.meta.pods[0].id);
      }
      const brandNames = Array.from(new Set(rosterView.meta.brandProcesses.map((bp) => bp.brandName)));
      if (brandNames.length > 0 && !selectedBrandName) {
        setSelectedBrandName(brandNames[0]);
      }
      const processCodes = Array.from(new Set(rosterView.meta.brandProcesses.map((bp) => bp.processCode)));
      if (processCodes.length > 0 && !selectedProcessCode) {
        setSelectedProcessCode(processCodes[0]);
      }
      if (rosterView.meta.employees.length > 0 && !selectedEmployeeId) {
        setSelectedEmployeeId(rosterView.meta.employees[0].id);
      }
    }
  }, [rosterId]);

  // Generate / Regenerate
  const handleGenerateClick = () => {
    if (!rosterView) {
      runGenerate(false);
    } else if (rosterView.roster.status === "DRAFT") {
      confirmRegenerateRef.current?.showModal();
    } else {
      setError("Roster is published. Unpublish first to regenerate.");
    }
  };

  const runGenerate = async (overwrite: boolean) => {
    confirmRegenerateRef.current?.close();
    setGenerating(true);
    setError(null);

    const res = await api.generateRoster({ year, month, overwrite });
    if (res.error) {
      setError(res.error);
    } else if (res.data) {
      setRosterView(res.data);
    }
    setGenerating(false);
  };

  // Publish / Unpublish
  const handlePublishClick = () => {
    if (!rosterView) return;
    if (rosterView.summary.errors > 0) {
      confirmPublishRef.current?.showModal();
    } else {
      runPublish(false);
    }
  };

  const runPublish = async (acknowledgeErrors: boolean) => {
    if (!rosterView) return;
    confirmPublishRef.current?.close();
    setError(null);

    const res = await api.publishRoster(rosterView.roster.id, { acknowledgeErrors });
    if (res.error) {
      setError(res.error);
    } else {
      await fetchRoster();
    }
  };

  const handleUnpublishClick = async () => {
    if (!rosterView) return;
    setError(null);
    const res = await api.unpublishRoster(rosterView.roster.id);
    if (res.error) {
      setError(res.error);
    } else {
      await fetchRoster();
    }
  };

  // Manual cell update
  const handleSetStatus = async (newStatus: "WORKING" | "WEEKOFF") => {
    if (!rosterView || !editTarget) return;
    setSavingEdit(true);

    const res = await api.updateRosterEntry(rosterView.roster.id, {
      employeeId: editTarget.employeeId,
      date: editTarget.date,
      status: newStatus,
      version: rosterView.roster.version,
    });

    if (res.error) {
      setError(res.error);
      await fetchRoster();
    } else if (res.data) {
      // Re-fetch entire view to guarantee coverage and issues are freshly synchronized
      const viewRes = await api.getRoster(rosterView.roster.id);
      if (viewRes.data) {
        setRosterView(viewRes.data);
      }
    }
    setSavingEdit(false);
    setEditTarget(null);
  };

  // Issue highlight and scroll
  const handleIssueClick = (issue: RosterIssue) => {
    setHighlightedTarget({
      employeeId: issue.employeeId,
      brandProcessId: issue.brandProcessId,
      date: issue.date,
    });

    if (issue.date) {
      let cellId: string | null = null;
      if (issue.employeeId) {
        cellId = `cell-emp-${issue.employeeId}-${issue.date}`;
      } else if (issue.brandProcessId) {
        cellId = `cell-bp-${issue.brandProcessId}-${issue.date}`;
      }
      if (cellId) {
        const el = document.getElementById(cellId);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
        }
      }
    }

    setTimeout(() => {
      setHighlightedTarget(null);
    }, 2000);
  };

  // Load backup suggestions for a coverage gap issue
  const handleSuggestBackups = async (issue: RosterIssue) => {
    if (!rosterView || !issue.brandProcessId || !issue.date) return;
    setActiveGapIssue(issue);
    setLoadingSuggestions(true);
    setSuggestions([]);

    const res = await api.getSuggestions(rosterView.roster.id, {
      brandProcessId: issue.brandProcessId,
      date: issue.date,
    });

    if (res.error) {
      setError(res.error);
    } else if (res.data) {
      setSuggestions(res.data);
    }
    setLoadingSuggestions(false);
  };

  // Index entries by `${employeeId}:${date}`
  const entryLookup = useMemo(() => {
    const map = new Map<string, RosterEntry>();
    if (rosterView) {
      for (const entry of rosterView.entries) {
        map.set(`${entry.employeeId}:${entry.date}`, entry);
      }
    }
    return map;
  }, [rosterView]);

  // Index coverage by `${brandProcessId}:${date}`
  const coverageLookup = useMemo(() => {
    const map = new Map<string, { required: number; actual: number }>();
    if (rosterView) {
      for (const cov of rosterView.coverage) {
        map.set(`${cov.brandProcessId}:${cov.date}`, {
          required: cov.required,
          actual: cov.actual,
        });
      }
    }
    return map;
  }, [rosterView]);

  // Set of conflict keys `${employeeId}:${date}`
  const conflictKeys = useMemo(() => {
    const set = new Set<string>();
    if (rosterView) {
      for (const issue of rosterView.issues) {
        if (issue.type === "ENTRY_CONFLICTS_LEAVE" && issue.employeeId && issue.date) {
          set.add(`${issue.employeeId}:${issue.date}`);
        }
      }
    }
    return set;
  }, [rosterView]);

  // Set of brandProcessIds with SINGLE_POINT_OF_FAILURE
  const spofBpIds = useMemo(() => {
    const set = new Set<string>();
    if (rosterView) {
      for (const issue of rosterView.issues) {
        if (issue.type === "SINGLE_POINT_OF_FAILURE" && issue.brandProcessId) {
          set.add(issue.brandProcessId);
        }
      }
    }
    return set;
  }, [rosterView]);

  // Filtered issues
  const filteredIssues = useMemo(() => {
    if (!rosterView) return [];
    if (issueFilter === "errors") return rosterView.issues.filter((i) => i.severity === "ERROR");
    if (issueFilter === "warnings") return rosterView.issues.filter((i) => i.severity === "WARNING");
    if (issueFilter === "preferences") return rosterView.issues.filter((i) => i.severity === "INFO");
    return rosterView.issues;
  }, [rosterView, issueFilter]);

  // Reusable Employee Grid Component
  const renderEmployeeGrid = (
    employeesToRender: { id: string; name: string; podId: string | null }[],
    groupLabel?: string
  ) => {
    if (!rosterView) return null;
    const holidaySet = new Set(rosterView.meta.holidays);

    return (
      <div className="overflow-x-auto rounded-[6px] border border-[#E2DDD3] bg-[#FFFFFF]">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-[#E2DDD3] bg-[#F5F2EC]">
              <th className="sticky left-0 top-0 z-30 min-w-[160px] border-r border-[#E2DDD3] bg-[#F5F2EC] px-3 py-2 font-medium text-[#1D1C1A]">
                {groupLabel ? `Staff • ${groupLabel}` : "Staff Member"}
              </th>
              {dates.map((date) => {
                const w = weekdayOf(date);
                const isSunday = w === 0;
                const isHoliday = holidaySet.has(date);
                const tinted = isSunday || isHoliday;

                return (
                  <th
                    key={date}
                    className={`min-w-[36px] px-1 py-2 text-center border-r border-[#E2DDD3] last:border-r-0 ${
                      tinted ? "bg-[#E2DDD3]/50 text-[#1D1C1A]" : "text-[#6B675F]"
                    }`}
                  >
                    <div className="font-semibold">{formatDayNumber(date)}</div>
                    <div className="text-[10px] font-normal">{weekdayLetter(w)}</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E2DDD3]">
            {employeesToRender.length === 0 ? (
              <tr>
                <td colSpan={dates.length + 1} className="py-6 text-center text-xs text-[#6B675F]">
                  No staff members to display in this view.
                </td>
              </tr>
            ) : (
              employeesToRender.map((emp) => (
                <tr key={emp.id} className="hover:bg-[#F5F2EC]/30">
                  <td className="sticky left-0 z-20 border-r border-[#E2DDD3] bg-[#FFFFFF] px-3 py-2 font-medium text-[#1D1C1A] whitespace-nowrap">
                    {emp.name}
                  </td>
                  {dates.map((date) => {
                    const entry = entryLookup.get(`${emp.id}:${date}`);
                    const status = entry?.status || "WORKING";
                    const isManual = entry?.source === "MANUAL";
                    const hasConflict = conflictKeys.has(`${emp.id}:${date}`);
                    const isHighlighted =
                      highlightedTarget?.employeeId === emp.id && highlightedTarget?.date === date;
                    const cellId = `cell-emp-${emp.id}-${date}`;

                    const isEditableStatus = status === "WORKING" || status === "WEEKOFF";
                    const canClickCell = canEdit && rosterView.roster.status === "DRAFT" && isEditableStatus;

                    let badgeClass = "text-[#1D1C1A]";
                    let statusLabel = "W";
                    let tooltip = "Working";

                    if (status === "WEEKOFF") {
                      badgeClass = "bg-[#E4ECE6] text-[#1F4D3A] font-medium";
                      statusLabel = "O";
                      tooltip = "Weekly Off";
                    } else if (status === "LEAVE") {
                      badgeClass = "bg-[#B45309]/10 text-[#B45309] font-medium";
                      statusLabel = "L";
                      tooltip = "Leave (cannot edit manually)";
                    } else if (status === "COMP_OFF") {
                      badgeClass = "bg-[#B45309]/10 text-[#B45309] font-medium";
                      statusLabel = "C";
                      tooltip = "Comp-Off (cannot edit manually)";
                    } else if (status === "HOLIDAY") {
                      badgeClass = "bg-[#E2DDD3]/60 text-[#6B675F] font-medium";
                      statusLabel = "H";
                      tooltip = "Holiday (cannot edit manually)";
                    }

                    return (
                      <td
                        key={date}
                        id={cellId}
                        onClick={() => {
                          if (canClickCell) {
                            setEditTarget({
                              employeeId: emp.id,
                              date,
                              currentStatus: status,
                            });
                          }
                        }}
                        title={tooltip}
                        className={`relative min-w-[36px] p-1 text-center border-r border-[#E2DDD3] last:border-r-0 select-none ${
                          canClickCell ? "cursor-pointer hover:bg-[#F5F2EC]/80" : ""
                        } ${isHighlighted ? "ring-2 ring-[#A3262A] bg-[#A3262A]/20" : ""}`}
                      >
                        <span
                          className={`inline-block w-6 h-6 rounded-[4px] leading-6 text-center text-xs ${badgeClass}`}
                        >
                          {statusLabel}
                        </span>

                        {/* Manual edit corner mark */}
                        {isManual && (
                          <span
                            title="Manually edited"
                            className="absolute top-1 left-1 w-0 h-0 border-t-[5px] border-l-[5px] border-t-[#1F4D3A] border-l-[#1F4D3A] border-r-[5px] border-r-transparent border-b-[5px] border-b-transparent"
                          />
                        )}

                        {/* Leave conflict red dot */}
                        {hasConflict && (
                          <span
                            title="Conflicts with leave"
                            className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#A3262A]"
                          />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    );
  };

  // Reusable Coverage Grid Component
  const renderCoverageGrid = (
    bpsToRender: {
      id: string;
      brandName: string;
      processCode: string;
      operatingRule: string;
      minCoverage: number;
    }[]
  ) => {
    if (!rosterView) return null;
    const holidaySet = new Set(rosterView.meta.holidays);

    return (
      <div className="overflow-x-auto rounded-[6px] border border-[#E2DDD3] bg-[#FFFFFF]">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-[#E2DDD3] bg-[#F5F2EC]">
              <th className="sticky left-0 top-0 z-30 min-w-[160px] border-r border-[#E2DDD3] bg-[#F5F2EC] px-3 py-2 font-medium text-[#1D1C1A]">
                Brand Coverage
              </th>
              {dates.map((date) => {
                const w = weekdayOf(date);
                const isSunday = w === 0;
                const isHoliday = holidaySet.has(date);
                const tinted = isSunday || isHoliday;

                return (
                  <th
                    key={date}
                    className={`min-w-[36px] px-1 py-2 text-center border-r border-[#E2DDD3] last:border-r-0 ${
                      tinted ? "bg-[#E2DDD3]/50 text-[#1D1C1A]" : "text-[#6B675F]"
                    }`}
                  >
                    <div className="font-semibold">{formatDayNumber(date)}</div>
                    <div className="text-[10px] font-normal">{weekdayLetter(w)}</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E2DDD3]">
            {bpsToRender.length === 0 ? (
              <tr>
                <td colSpan={dates.length + 1} className="py-6 text-center text-xs text-[#6B675F]">
                  No brand processes to display in this view.
                </td>
              </tr>
            ) : (
              bpsToRender.map((bp) => {
                const hasSpof = spofBpIds.has(bp.id);

                return (
                  <tr key={bp.id} className="hover:bg-[#F5F2EC]/30">
                    <td className="sticky left-0 z-20 border-r border-[#E2DDD3] bg-[#FFFFFF] px-3 py-2 font-medium text-[#1D1C1A] whitespace-nowrap">
                      <span>
                        {bp.brandName} / {bp.processCode}
                      </span>
                      {hasSpof && (
                        <span
                          title="Single point of failure"
                          className="ml-2 inline-block rounded bg-[#A3262A]/10 px-1 py-0.5 text-[10px] font-semibold text-[#A3262A]"
                        >
                          SPOF
                        </span>
                      )}
                    </td>
                    {dates.map((date) => {
                      const cov = coverageLookup.get(`${bp.id}:${date}`);
                      const isHighlighted =
                        highlightedTarget?.brandProcessId === bp.id && highlightedTarget?.date === date;
                      const cellId = `cell-bp-${bp.id}-${date}`;

                      if (!cov) {
                        return (
                          <td
                            key={date}
                            id={cellId}
                            className="min-w-[36px] p-1 text-center text-xs text-[#6B675F]/40 border-r border-[#E2DDD3] last:border-r-0"
                          >
                            –
                          </td>
                        );
                      }

                      const isGap = cov.actual < cov.required;

                      return (
                        <td
                          key={date}
                          id={cellId}
                          className={`min-w-[36px] p-1 text-center border-r border-[#E2DDD3] last:border-r-0 text-xs font-medium ${
                            isGap
                              ? "bg-[#A3262A]/10 text-[#A3262A]"
                              : "bg-[#E4ECE6]/60 text-[#1F4D3A]"
                          } ${isHighlighted ? "ring-2 ring-[#A3262A] bg-[#A3262A]/30" : ""}`}
                          title={`Required: ${cov.required}, Actual: ${cov.actual}`}
                        >
                          {cov.actual}/{cov.required}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#F5F2EC]">
      <Navbar />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {/* Header and Top Bar */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
          <div>
            <h1 className="font-['Newsreader',Georgia,serif] text-3xl font-medium tracking-tight text-[#1D1C1A]">
              Roster
            </h1>
            <p className="mt-1 text-sm text-[#6B675F]">
              Monthly staff schedule, operating rule constraints and coverage tracking.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="rounded-[6px] border border-[#E2DDD3] bg-[#FFFFFF] px-3 py-1.5 text-sm text-[#1D1C1A] focus:border-[#1F4D3A] focus:outline-none"
            />

            {canEdit && (
              <button
                type="button"
                onClick={handleGenerateClick}
                disabled={generating}
                className="rounded-[6px] bg-[#1F4D3A] px-4 py-1.5 text-sm font-medium text-[#FFFFFF] hover:bg-[#1F4D3A]/90 disabled:opacity-50 transition-colors"
              >
                {generating ? "Generating…" : rosterView ? "Regenerate" : "Generate"}
              </button>
            )}
          </div>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="mb-6 rounded-[6px] border border-[#A3262A]/20 bg-[#A3262A]/10 p-3 text-sm text-[#A3262A] flex items-center justify-between">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-xs underline text-[#A3262A] hover:opacity-80"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="rounded-[6px] border border-[#E2DDD3] bg-[#FFFFFF] p-12 text-center text-sm text-[#6B675F]">
            Loading roster data…
          </div>
        ) : !rosterView ? (
          /* Empty State */
          <div className="rounded-[6px] border border-[#E2DDD3] bg-[#FFFFFF] p-12 text-center">
            <h3 className="font-['Newsreader',Georgia,serif] text-xl font-medium text-[#1D1C1A]">
              No roster generated
            </h3>
            <p className="mt-2 text-sm text-[#6B675F] max-w-md mx-auto">
              No schedule exists for {selectedMonth}. Generate an automated schedule based on team availability,
              leaves, and process rules.
            </p>
            {canEdit && (
              <button
                type="button"
                onClick={() => runGenerate(false)}
                disabled={generating}
                className="mt-6 rounded-[6px] bg-[#1F4D3A] px-4 py-2 text-sm font-medium text-[#FFFFFF] hover:bg-[#1F4D3A]/90 disabled:opacity-50 transition-colors"
              >
                {generating ? "Generating Roster…" : "Generate Roster"}
              </button>
            )}
          </div>
        ) : (
          /* Active Roster Content */
          <div className="space-y-6">
            {/* Summary Strip */}
            <div className="rounded-[6px] border border-[#E2DDD3] bg-[#FFFFFF] p-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className={`inline-block rounded-[6px] px-2.5 py-1 text-xs font-semibold uppercase tracking-wider ${
                    rosterView.roster.status === "PUBLISHED"
                      ? "border border-[#1F4D3A]/30 bg-[#E4ECE6] text-[#1F4D3A]"
                      : "border border-[#6B675F]/30 bg-[#F5F2EC] text-[#6B675F]"
                  }`}
                >
                  {rosterView.roster.status}
                </span>

                <span className="text-xs text-[#6B675F]">v{rosterView.roster.version}</span>

                <div className="h-4 w-[1px] bg-[#E2DDD3]" />

                <span
                  className={`text-xs font-medium ${
                    rosterView.summary.errors > 0 ? "text-[#A3262A]" : "text-[#6B675F]"
                  }`}
                >
                  {rosterView.summary.errors} Error{rosterView.summary.errors === 1 ? "" : "s"}
                </span>

                <span
                  className={`text-xs font-medium ${
                    rosterView.summary.warnings > 0 ? "text-[#B45309]" : "text-[#6B675F]"
                  }`}
                >
                  {rosterView.summary.warnings} Warning{rosterView.summary.warnings === 1 ? "" : "s"}
                </span>

                <span className="text-xs font-medium text-[#1F4D3A]">
                  {rosterView.summary.coveragePercent}% Coverage
                </span>
              </div>

              {canEdit && (
                <div className="flex items-center gap-2">
                  {rosterView.roster.status === "DRAFT" ? (
                    <button
                      type="button"
                      onClick={handlePublishClick}
                      className="rounded-[6px] border border-[#1F4D3A] bg-[#1F4D3A] px-3 py-1 text-xs font-medium text-[#FFFFFF] hover:bg-[#1F4D3A]/90 transition-colors"
                    >
                      Publish Roster
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleUnpublishClick}
                      className="rounded-[6px] border border-[#E2DDD3] bg-[#FFFFFF] px-3 py-1 text-xs font-medium text-[#1D1C1A] hover:bg-[#F5F2EC] transition-colors"
                    >
                      Unpublish to Draft
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* View Switcher Tabs */}
            <div className="flex border-b border-[#E2DDD3] space-x-6 overflow-x-auto">
              {[
                { id: "company", label: "Company" },
                { id: "pod", label: "Pod" },
                { id: "brand", label: "Brand" },
                { id: "process", label: "Process" },
                { id: "employee", label: "Employee" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as ViewTab)}
                  className={`pb-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-[1px] ${
                    activeTab === tab.id
                      ? "border-[#1F4D3A] text-[#1F4D3A]"
                      : "border-transparent text-[#6B675F] hover:text-[#1D1C1A]"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Grid & Issues Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Main Schedule Content: 3 cols */}
              <div className="lg:col-span-3 space-y-6">
                {/* 1. Company Tab */}
                {activeTab === "company" && (
                  <div className="space-y-6">
                    {rosterView.meta.pods.map((pod) => {
                      const podMembers = rosterView.meta.employees.filter((e) => e.podId === pod.id);
                      if (podMembers.length === 0) return null;
                      return (
                        <div key={pod.id} className="space-y-2">
                          <h3 className="font-medium text-sm text-[#1D1C1A]">Pod: {pod.name}</h3>
                          {renderEmployeeGrid(podMembers, pod.name)}
                        </div>
                      );
                    })}

                    {/* Unassigned / Other Pod members */}
                    {(() => {
                      const unassigned = rosterView.meta.employees.filter((e) => !e.podId);
                      if (unassigned.length === 0) return null;
                      return (
                        <div className="space-y-2">
                          <h3 className="font-medium text-sm text-[#6B675F]">Unassigned Staff</h3>
                          {renderEmployeeGrid(unassigned, "Unassigned")}
                        </div>
                      );
                    })()}

                    {/* Overall Brand Coverage Grid */}
                    <div className="space-y-2 pt-4">
                      <h3 className="font-['Newsreader',Georgia,serif] text-lg font-medium text-[#1D1C1A]">
                        Operating Process Coverage
                      </h3>
                      {renderCoverageGrid(rosterView.meta.brandProcesses)}
                    </div>
                  </div>
                )}

                {/* 2. Pod Tab */}
                {activeTab === "pod" && (
                  <div className="space-y-6">
                    <div className="flex items-center gap-3">
                      <label className="text-xs font-medium text-[#6B675F]">Select Pod:</label>
                      <select
                        value={selectedPodId}
                        onChange={(e) => setSelectedPodId(e.target.value)}
                        className="rounded-[6px] border border-[#E2DDD3] bg-[#FFFFFF] px-3 py-1.5 text-xs text-[#1D1C1A] focus:outline-none"
                      >
                        {rosterView.meta.pods.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {(() => {
                      const podMembers = rosterView.meta.employees.filter((e) => e.podId === selectedPodId);
                      const podMemberIds = new Set(podMembers.map((m) => m.id));
                      const assignedBpIds = new Set(
                        rosterView.meta.assignments
                          .filter((a) => podMemberIds.has(a.employeeId))
                          .map((a) => a.brandProcessId)
                      );
                      const relevantBps = rosterView.meta.brandProcesses.filter((bp) =>
                        assignedBpIds.has(bp.id)
                      );

                      return (
                        <>
                          <div className="space-y-2">
                            <h3 className="text-sm font-medium text-[#1D1C1A]">Pod Staff Schedule</h3>
                            {renderEmployeeGrid(podMembers)}
                          </div>
                          <div className="space-y-2 pt-4">
                            <h3 className="text-sm font-medium text-[#1D1C1A]">Assigned Process Coverage</h3>
                            {renderCoverageGrid(relevantBps)}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}

                {/* 3. Brand Tab */}
                {activeTab === "brand" && (
                  <div className="space-y-6">
                    <div className="flex items-center gap-3">
                      <label className="text-xs font-medium text-[#6B675F]">Select Brand:</label>
                      <select
                        value={selectedBrandName}
                        onChange={(e) => setSelectedBrandName(e.target.value)}
                        className="rounded-[6px] border border-[#E2DDD3] bg-[#FFFFFF] px-3 py-1.5 text-xs text-[#1D1C1A] focus:outline-none"
                      >
                        {Array.from(new Set(rosterView.meta.brandProcesses.map((bp) => bp.brandName))).map(
                          (name) => (
                            <option key={name} value={name}>
                              {name}
                            </option>
                          )
                        )}
                      </select>
                    </div>

                    {(() => {
                      const brandBps = rosterView.meta.brandProcesses.filter(
                        (bp) => bp.brandName === selectedBrandName
                      );
                      const brandBpIds = new Set(brandBps.map((bp) => bp.id));
                      const assignedEmpIds = new Set(
                        rosterView.meta.assignments
                          .filter((a) => brandBpIds.has(a.brandProcessId))
                          .map((a) => a.employeeId)
                      );
                      const brandEmployees = rosterView.meta.employees.filter((e) =>
                        assignedEmpIds.has(e.id)
                      );

                      return (
                        <>
                          <div className="space-y-2">
                            <h3 className="text-sm font-medium text-[#1D1C1A]">Brand Process Coverage</h3>
                            {renderCoverageGrid(brandBps)}
                          </div>
                          <div className="space-y-2 pt-4">
                            <h3 className="text-sm font-medium text-[#1D1C1A]">Assigned Staff</h3>
                            {renderEmployeeGrid(brandEmployees)}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}

                {/* 4. Process Tab */}
                {activeTab === "process" && (
                  <div className="space-y-6">
                    <div className="flex items-center gap-3">
                      <label className="text-xs font-medium text-[#6B675F]">Select Process Code:</label>
                      <select
                        value={selectedProcessCode}
                        onChange={(e) => setSelectedProcessCode(e.target.value)}
                        className="rounded-[6px] border border-[#E2DDD3] bg-[#FFFFFF] px-3 py-1.5 text-xs text-[#1D1C1A] focus:outline-none"
                      >
                        {Array.from(new Set(rosterView.meta.brandProcesses.map((bp) => bp.processCode))).map(
                          (code) => (
                            <option key={code} value={code}>
                              {code}
                            </option>
                          )
                        )}
                      </select>
                    </div>

                    {(() => {
                      const procBps = rosterView.meta.brandProcesses.filter(
                        (bp) => bp.processCode === selectedProcessCode
                      );
                      const procBpIds = new Set(procBps.map((bp) => bp.id));
                      const assignedEmpIds = new Set(
                        rosterView.meta.assignments
                          .filter((a) => procBpIds.has(a.brandProcessId))
                          .map((a) => a.employeeId)
                      );
                      const procEmployees = rosterView.meta.employees.filter((e) =>
                        assignedEmpIds.has(e.id)
                      );

                      return (
                        <>
                          <div className="space-y-2">
                            <h3 className="text-sm font-medium text-[#1D1C1A]">Process Coverage Across Brands</h3>
                            {renderCoverageGrid(procBps)}
                          </div>
                          <div className="space-y-2 pt-4">
                            <h3 className="text-sm font-medium text-[#1D1C1A]">Assigned Staff</h3>
                            {renderEmployeeGrid(procEmployees)}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}

                {/* 5. Employee Tab */}
                {activeTab === "employee" && (
                  <div className="space-y-6">
                    <div className="flex items-center gap-3">
                      <label className="text-xs font-medium text-[#6B675F]">Select Employee:</label>
                      <select
                        value={selectedEmployeeId}
                        onChange={(e) => setSelectedEmployeeId(e.target.value)}
                        className="rounded-[6px] border border-[#E2DDD3] bg-[#FFFFFF] px-3 py-1.5 text-xs text-[#1D1C1A] focus:outline-none"
                      >
                        {rosterView.meta.employees.map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {(() => {
                      const emp = rosterView.meta.employees.find((e) => e.id === selectedEmployeeId);
                      if (!emp) return <p className="text-xs text-[#6B675F]">Employee not found.</p>;

                      const empAssignments = rosterView.meta.assignments.filter(
                        (a) => a.employeeId === emp.id
                      );
                      const empBpIds = new Set(empAssignments.map((a) => a.brandProcessId));
                      const empBps = rosterView.meta.brandProcesses.filter((bp) => empBpIds.has(bp.id));
                      const holidaySet = new Set(rosterView.meta.holidays);

                      // Calendar 7 columns, Monday-start
                      // Find first weekday of the month (0=Sun, 1=Mon ... 6=Sat)
                      const firstDayWeekday = weekdayOf(dates[0]);
                      // Offset so Monday is 0: (w + 6) % 7
                      const padBefore = (firstDayWeekday + 6) % 7;

                      return (
                        <div className="space-y-6">
                          {/* Calendar view */}
                          <div className="rounded-[6px] border border-[#E2DDD3] bg-[#FFFFFF] p-4">
                            <div className="flex items-center justify-between mb-4">
                              <h3 className="font-['Newsreader',Georgia,serif] text-lg font-medium text-[#1D1C1A]">
                                {emp.name}'s Schedule • {selectedMonth}
                              </h3>
                              <span className="text-xs text-[#6B675F]">
                                {empBps.length} process assignment(s)
                              </span>
                            </div>

                            <div className="grid grid-cols-7 border-b border-[#E2DDD3] pb-2 text-center text-xs font-medium text-[#6B675F]">
                              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                                <div key={d}>{d}</div>
                              ))}
                            </div>

                            <div className="grid grid-cols-7 gap-1 pt-2">
                              {/* Empty padding cells */}
                              {Array.from({ length: padBefore }).map((_, i) => (
                                <div key={`pad-${i}`} className="h-16 rounded-[4px] bg-[#F5F2EC]/30" />
                              ))}

                              {/* Day cells */}
                              {dates.map((date) => {
                                const entry = entryLookup.get(`${emp.id}:${date}`);
                                const status = entry?.status || "WORKING";
                                const isSunday = weekdayOf(date) === 0;
                                const isHoliday = holidaySet.has(date);

                                let statusBg = "bg-[#FFFFFF] text-[#1D1C1A]";
                                let statusTag = "Working";

                                if (status === "WEEKOFF") {
                                  statusBg = "bg-[#E4ECE6] text-[#1F4D3A] font-medium";
                                  statusTag = "Weekly Off";
                                } else if (status === "LEAVE") {
                                  statusBg = "bg-[#B45309]/10 text-[#B45309] font-medium";
                                  statusTag = "Leave";
                                } else if (status === "COMP_OFF") {
                                  statusBg = "bg-[#B45309]/10 text-[#B45309] font-medium";
                                  statusTag = "Comp-Off";
                                } else if (status === "HOLIDAY") {
                                  statusBg = "bg-[#E2DDD3]/60 text-[#6B675F] font-medium";
                                  statusTag = "Holiday";
                                }

                                return (
                                  <div
                                    key={date}
                                    className={`h-16 rounded-[4px] border border-[#E2DDD3] p-1.5 flex flex-col justify-between ${
                                      isSunday || isHoliday ? "bg-[#F5F2EC]/60" : "bg-[#FFFFFF]"
                                    }`}
                                  >
                                    <div className="flex items-center justify-between text-[11px] font-semibold text-[#1D1C1A]">
                                      <span>{formatDayNumber(date)}</span>
                                      {entry?.source === "MANUAL" && (
                                        <span title="Manual" className="text-[9px] text-[#1F4D3A]">
                                          ●
                                        </span>
                                      )}
                                    </div>
                                    <div
                                      className={`text-[10px] rounded px-1 py-0.5 text-center truncate ${statusBg}`}
                                    >
                                      {statusTag}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Assigned Brand-Processes */}
                          <div className="rounded-[6px] border border-[#E2DDD3] bg-[#FFFFFF] p-4">
                            <h4 className="text-xs font-semibold uppercase tracking-wider text-[#6B675F] mb-3">
                              Assigned Processes
                            </h4>
                            {empBps.length === 0 ? (
                              <p className="text-xs text-[#6B675F]">No brand processes assigned.</p>
                            ) : (
                              <div className="flex flex-wrap gap-2">
                                {empBps.map((bp) => (
                                  <span
                                    key={bp.id}
                                    className="inline-flex items-center rounded-[6px] border border-[#E2DDD3] bg-[#F5F2EC] px-2.5 py-1 text-xs text-[#1D1C1A]"
                                  >
                                    <span className="font-medium">{bp.brandName}</span>
                                    <span className="mx-1 text-[#6B675F]">/</span>
                                    <span>{bp.processCode}</span>
                                    <span className="ml-2 text-[10px] text-[#6B675F]">
                                      ({bp.operatingRule})
                                    </span>
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* Right Side: Issues Panel (1 col) */}
              <div className="lg:col-span-1 space-y-4">
                <div className="rounded-[6px] border border-[#E2DDD3] bg-[#FFFFFF] p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-['Newsreader',Georgia,serif] text-base font-medium text-[#1D1C1A]">
                      Roster Issues
                    </h3>
                    <span className="text-xs text-[#6B675F]">{rosterView.issues.length} total</span>
                  </div>

                  {/* Filter chips */}
                  <div className="flex flex-wrap gap-1.5 border-b border-[#E2DDD3] pb-3 mb-3">
                    {[
                      { id: "all", label: "All", count: rosterView.issues.length },
                      { id: "errors", label: "Errors", count: rosterView.summary.errors },
                      { id: "warnings", label: "Warnings", count: rosterView.summary.warnings },
                      { id: "preferences", label: "Prefs", count: rosterView.summary.infos },
                    ].map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setIssueFilter(f.id as IssueFilter)}
                        className={`rounded-[4px] px-2 py-0.5 text-[11px] font-medium transition-colors ${
                          issueFilter === f.id
                            ? "bg-[#1F4D3A] text-[#FFFFFF]"
                            : "bg-[#F5F2EC] text-[#6B675F] hover:bg-[#E2DDD3]"
                        }`}
                      >
                        {f.label} ({f.count})
                      </button>
                    ))}
                  </div>

                  {/* Issues List */}
                  <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                    {filteredIssues.length === 0 ? (
                      <p className="text-xs text-[#6B675F] py-4 text-center">No issues in this category.</p>
                    ) : (
                      filteredIssues.map((issue, idx) => {
                        let badgeBg = "bg-[#E4ECE6] text-[#1F4D3A]";
                        if (issue.severity === "ERROR") badgeBg = "bg-[#A3262A]/10 text-[#A3262A]";
                        if (issue.severity === "WARNING") badgeBg = "bg-[#B45309]/10 text-[#B45309]";

                        const isCoverageGap = issue.type === "COVERAGE_GAP";

                        return (
                          <div
                            key={idx}
                            onClick={() => handleIssueClick(issue)}
                            className="rounded-[4px] border border-[#E2DDD3] p-2.5 text-xs hover:border-[#1F4D3A] cursor-pointer transition-colors"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${badgeBg}`}>
                                {issue.severity}
                              </span>
                              {issue.date && (
                                <span className="text-[10px] text-[#6B675F]">
                                  {formatDisplayDate(issue.date)}
                                </span>
                              )}
                            </div>

                            <p className="text-[#1D1C1A] leading-relaxed text-[11px]">{issue.message}</p>

                            {/* Suggest Backups Button for Coverage Gaps */}
                            {isCoverageGap && (
                              <div className="mt-2 pt-2 border-t border-[#E2DDD3]">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSuggestBackups(issue);
                                  }}
                                  className="text-[11px] font-medium text-[#1F4D3A] hover:underline"
                                >
                                  Suggest backups →
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Backups Suggestions Panel */}
                {activeGapIssue && (
                  <div className="rounded-[6px] border border-[#1F4D3A]/20 bg-[#FFFFFF] p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-[#1F4D3A]">
                        Backup Candidates
                      </h4>
                      <button
                        type="button"
                        onClick={() => setActiveGapIssue(null)}
                        className="text-xs text-[#6B675F] hover:text-[#1D1C1A]"
                      >
                        ✕
                      </button>
                    </div>

                    <p className="text-[11px] text-[#6B675F] mb-3">
                      For gap on {activeGapIssue.date ? formatDisplayDate(activeGapIssue.date) : "selected date"}
                    </p>

                    {loadingSuggestions ? (
                      <p className="text-xs text-[#6B675F] py-2">Finding available staff…</p>
                    ) : suggestions.length === 0 ? (
                      <p className="text-xs text-[#6B675F] py-2">No backup candidates available.</p>
                    ) : (
                      <div className="space-y-2">
                        {suggestions.map((s) => (
                          <div
                            key={s.employeeId}
                            className="rounded border border-[#E2DDD3] p-2 text-xs bg-[#F5F2EC]/40"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-[#1D1C1A]">{s.employeeName}</span>
                              <span
                                className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                                  s.kind === "CROSS_COVER"
                                    ? "bg-[#E4ECE6] text-[#1F4D3A]"
                                    : "bg-[#B45309]/10 text-[#B45309]"
                                }`}
                              >
                                {s.kind === "CROSS_COVER" ? "Cross-Cover" : "Swap Off"}
                              </span>
                            </div>
                            <p className="text-[11px] text-[#6B675F] mt-1">{s.reason}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Manual Edit Popover / Modal */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1D1C1A]/20 p-4">
          <div className="w-full max-w-sm rounded-[6px] border border-[#E2DDD3] bg-[#FFFFFF] p-5 shadow-lg">
            <h3 className="text-sm font-semibold text-[#1D1C1A] mb-1">Update Schedule Entry</h3>
            <p className="text-xs text-[#6B675F] mb-4">
              Date: {formatDisplayDate(editTarget.date)} • Current: {editTarget.currentStatus}
            </p>

            <div className="space-y-2">
              <button
                type="button"
                disabled={savingEdit || editTarget.currentStatus === "WORKING"}
                onClick={() => handleSetStatus("WORKING")}
                className="w-full rounded-[6px] border border-[#E2DDD3] bg-[#FFFFFF] py-2 text-xs font-medium text-[#1D1C1A] hover:bg-[#F5F2EC] disabled:opacity-40"
              >
                Set Working (W)
              </button>
              <button
                type="button"
                disabled={savingEdit || editTarget.currentStatus === "WEEKOFF"}
                onClick={() => handleSetStatus("WEEKOFF")}
                className="w-full rounded-[6px] border border-[#1F4D3A] bg-[#1F4D3A] py-2 text-xs font-medium text-[#FFFFFF] hover:bg-[#1F4D3A]/90 disabled:opacity-40"
              >
                Set Weekly Off (O)
              </button>
            </div>

            <div className="mt-4 border-t border-[#E2DDD3] pt-3 text-right">
              <button
                type="button"
                disabled={savingEdit}
                onClick={() => setEditTarget(null)}
                className="text-xs text-[#6B675F] hover:text-[#1D1C1A]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Regenerate Dialog */}
      <dialog
        ref={confirmRegenerateRef}
        className="rounded-[6px] border border-[#E2DDD3] bg-[#FFFFFF] p-6 shadow-md max-w-sm backdrop:bg-[#1D1C1A]/20"
      >
        <h3 className="font-['Newsreader',Georgia,serif] text-lg font-medium text-[#1D1C1A]">
          Regenerate Roster?
        </h3>
        <p className="mt-2 text-xs text-[#6B675F]">
          Regenerate and discard manual edits? All custom manual modifications will be reset to auto-scheduled states.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => confirmRegenerateRef.current?.close()}
            className="rounded-[6px] border border-[#E2DDD3] px-3 py-1.5 text-xs font-medium text-[#1D1C1A] hover:bg-[#F5F2EC]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => runGenerate(true)}
            className="rounded-[6px] bg-[#A3262A] px-3 py-1.5 text-xs font-medium text-[#FFFFFF] hover:bg-[#A3262A]/90"
          >
            Regenerate
          </button>
        </div>
      </dialog>

      {/* Confirm Publish Dialog */}
      <dialog
        ref={confirmPublishRef}
        className="rounded-[6px] border border-[#E2DDD3] bg-[#FFFFFF] p-6 shadow-md max-w-sm backdrop:bg-[#1D1C1A]/20"
      >
        <h3 className="font-['Newsreader',Georgia,serif] text-lg font-medium text-[#1D1C1A]">
          Publish Roster with Errors?
        </h3>
        <p className="mt-2 text-xs text-[#6B675F]">
          This roster currently has {rosterView?.summary.errors} error issue(s). Do you still want to publish?
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => confirmPublishRef.current?.close()}
            className="rounded-[6px] border border-[#E2DDD3] px-3 py-1.5 text-xs font-medium text-[#1D1C1A] hover:bg-[#F5F2EC]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => runPublish(true)}
            className="rounded-[6px] bg-[#1F4D3A] px-3 py-1.5 text-xs font-medium text-[#FFFFFF] hover:bg-[#1F4D3A]/90"
          >
            Acknowledge & Publish
          </button>
        </div>
      </dialog>
    </div>
  );
}
