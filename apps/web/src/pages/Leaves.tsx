import { useState, useEffect, useRef, type FormEvent } from "react";
import Navbar from "../components/Navbar";
import { useAuth } from "../context/AuthContext";
import { api, type Leave, type Employee, type LeaveType } from "../lib/api";
import {
  formatDisplayDate,
  getInclusiveDays,
  getMonthRange,
  getTodayDateString,
} from "../lib/dateUtils";

export default function LeavesPage() {
  const { user } = useAuth();
  const canEdit = user?.role === "MANAGER";

  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [activeEmployees, setActiveEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedEmpId, setSelectedEmpId] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");

  // Add Leave Dialog State
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [formEmpId, setFormEmpId] = useState("");
  const [formType, setFormType] = useState<LeaveType>("LEAVE");
  const [formStartDate, setFormStartDate] = useState("");
  const [formEndDate, setFormEndDate] = useState("");
  const [formNote, setFormNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const fetchLeaves = async () => {
    setLoading(true);
    setError(null);

    let from: string | undefined;
    let to: string | undefined;

    if (selectedMonth && /^\d{4}-\d{2}$/.test(selectedMonth)) {
      const range = getMonthRange(selectedMonth);
      from = range.from;
      to = range.to;
    }

    const res = await api.getLeaves({
      employeeId: selectedEmpId || undefined,
      from,
      to,
    });

    if (res.error) {
      setError(res.error);
      setLeaves([]);
    } else {
      setLeaves(Array.isArray(res.data) ? res.data : []);
    }
    setLoading(false);
  };

  useEffect(() => {
    let cancelled = false;
    api.getEmployees({ active: true }).then((r) => {
      if (cancelled) return;
      const emps = Array.isArray(r.data) ? r.data : [];
      setActiveEmployees(emps);
      if (emps.length > 0) {
        setFormEmpId((prev) => prev || emps[0].id);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    fetchLeaves();
  }, [selectedEmpId, selectedMonth]);

  const openAddModal = () => {
    setFormEmpId(activeEmployees[0]?.id || "");
    setFormType("LEAVE");
    const today = getTodayDateString();
    setFormStartDate(today);
    setFormEndDate(today);
    setFormNote("");
    setModalError(null);
    dialogRef.current?.showModal();
  };

  const closeModal = () => {
    dialogRef.current?.close();
  };

  const handleCreateLeave = async (e: FormEvent) => {
    e.preventDefault();
    setModalError(null);

    if (formEndDate < formStartDate) {
      setModalError("End date must be greater than or equal to start date.");
      return;
    }

    setSubmitting(true);
    const res = await api.createLeave({
      employeeId: formEmpId,
      startDate: formStartDate,
      endDate: formEndDate,
      type: formType,
      note: formNote.trim() || null,
    });
    setSubmitting(false);

    if (res.error) {
      setModalError(res.error);
      return;
    }

    closeModal();
    fetchLeaves();
  };

  const handleDeleteLeave = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this leave entry?")) return;
    const res = await api.deleteLeave(id);
    if (res.error) {
      setError(res.error);
    } else {
      fetchLeaves();
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F2EC]">
      <Navbar />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="font-['Newsreader',Georgia,serif] text-3xl font-medium tracking-tight text-[#1D1C1A]">
              Staff Leaves &amp; Time Off
            </h1>
            <p className="mt-1 text-sm text-[#6B675F]">
              Review planned absences, medical leaves, and earned compensatory offs.
            </p>
          </div>
          {canEdit && (
            <button
              type="button"
              onClick={openAddModal}
              className="inline-flex items-center justify-center rounded-[6px] bg-[#1F4D3A] px-4 py-2 text-sm font-medium text-[#F5F2EC] hover:bg-[#1F4D3A]/90 transition-colors"
            >
              Add Leave
            </button>
          )}
        </div>

        {error && (
          <div className="mb-6 rounded-[6px] border border-[#A3262A]/20 bg-[#A3262A]/5 p-3 text-sm text-[#A3262A]">
            {error}
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6 rounded-[6px] border border-[#E2DDD3] bg-[#FFFFFF] p-4">
          <div className="flex-1">
            <label className="block text-xs font-medium uppercase tracking-wider text-[#6B675F] mb-1">
              Filter by Employee
            </label>
            <select
              value={selectedEmpId}
              onChange={(e) => setSelectedEmpId(e.target.value)}
              className="w-full rounded-[6px] border border-[#E2DDD3] bg-[#FFFFFF] px-3 py-1.5 text-sm text-[#1D1C1A] focus:border-[#1F4D3A] focus:outline-none focus:ring-1 focus:ring-[#1F4D3A]"
            >
              <option value="">All Employees</option>
              {activeEmployees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}
                </option>
              ))}
            </select>
          </div>

          <div className="w-full sm:w-56">
            <label className="block text-xs font-medium uppercase tracking-wider text-[#6B675F] mb-1">
              Filter by Month
            </label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full rounded-[6px] border border-[#E2DDD3] bg-[#FFFFFF] px-3 py-1.5 text-sm text-[#1D1C1A] focus:border-[#1F4D3A] focus:outline-none focus:ring-1 focus:ring-[#1F4D3A]"
            />
          </div>

          {selectedMonth && (
            <div className="self-end pb-0.5">
              <button
                type="button"
                onClick={() => setSelectedMonth("")}
                className="text-xs text-[#6B675F] hover:text-[#1D1C1A] underline"
              >
                Clear month
              </button>
            </div>
          )}
        </div>

        {/* Table */}
        <div className="rounded-[6px] border border-[#E2DDD3] bg-[#FFFFFF] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[#E2DDD3] bg-[#F5F2EC]/60 text-xs uppercase tracking-wider text-[#6B675F]">
                <tr>
                  <th className="px-4 py-3 font-medium">Employee</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">From</th>
                  <th className="px-4 py-3 font-medium">To</th>
                  <th className="px-4 py-3 font-medium text-center">Days</th>
                  <th className="px-4 py-3 font-medium">Note</th>
                  {canEdit && <th className="px-4 py-3 font-medium text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2DDD3]">
                {loading ? (
                  <tr>
                    <td colSpan={canEdit ? 7 : 6} className="py-8 text-center text-sm text-[#6B675F]">
                      Loading leaves…
                    </td>
                  </tr>
                ) : leaves.length === 0 ? (
                  <tr>
                    <td colSpan={canEdit ? 7 : 6} className="py-8 text-center text-sm text-[#6B675F]">
                      No leave records found.
                    </td>
                  </tr>
                ) : (
                  leaves.map((leave) => {
                    const days = getInclusiveDays(leave.startDate, leave.endDate);
                    const empName = leave.employeeName || leave.employee?.name || "Staff Member";

                    return (
                      <tr key={leave.id} className="hover:bg-[#F5F2EC]/30 transition-colors">
                        <td className="px-4 py-3 font-medium text-[#1D1C1A]">{empName}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-block rounded-[6px] px-2 py-0.5 text-xs font-medium ${leave.type === "COMP_OFF"
                                ? "border border-[#B45309]/30 bg-[#B45309]/10 text-[#B45309]"
                                : "bg-[#E4ECE6] text-[#1F4D3A]"
                              }`}
                          >
                            {leave.type === "COMP_OFF" ? "COMP OFF" : "LEAVE"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[#1D1C1A]">{formatDisplayDate(leave.startDate)}</td>
                        <td className="px-4 py-3 text-[#1D1C1A]">{formatDisplayDate(leave.endDate)}</td>
                        <td className="px-4 py-3 text-center text-[#6B675F]">
                          {days} day{days === 1 ? "" : "s"}
                        </td>
                        <td className="px-4 py-3 text-[#6B675F] max-w-xs truncate">
                          {leave.note || "—"}
                        </td>
                        {canEdit && (
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleDeleteLeave(leave.id)}
                              className="text-xs font-medium text-[#A3262A] hover:underline"
                            >
                              Delete
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Add Leave Dialog */}
      <dialog
        ref={dialogRef}
        className="backdrop:bg-black/40 rounded-[6px] border border-[#E2DDD3] bg-[#FFFFFF] p-6 max-w-md w-full text-left"
      >
        <h2 className="font-['Newsreader',Georgia,serif] text-xl font-medium text-[#1D1C1A]">
          Add Leave
        </h2>

        {modalError && (
          <div className="mt-3 rounded-[6px] border border-[#A3262A]/20 bg-[#A3262A]/5 p-2 text-xs text-[#A3262A]">
            {modalError}
          </div>
        )}

        <form onSubmit={handleCreateLeave} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-[#6B675F]">
              Employee
            </label>
            <select
              required
              value={formEmpId}
              onChange={(e) => setFormEmpId(e.target.value)}
              className="mt-1 block w-full rounded-[6px] border border-[#E2DDD3] bg-[#FFFFFF] px-3 py-1.5 text-sm text-[#1D1C1A] focus:border-[#1F4D3A] focus:outline-none focus:ring-1 focus:ring-[#1F4D3A]"
            >
              {activeEmployees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-[#6B675F]">
              Leave Type
            </label>
            <select
              value={formType}
              onChange={(e) => setFormType(e.target.value as LeaveType)}
              className="mt-1 block w-full rounded-[6px] border border-[#E2DDD3] bg-[#FFFFFF] px-3 py-1.5 text-sm text-[#1D1C1A] focus:border-[#1F4D3A] focus:outline-none focus:ring-1 focus:ring-[#1F4D3A]"
            >
              <option value="LEAVE">Leave</option>
              <option value="COMP_OFF">Compensatory Off</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-[#6B675F]">
                Start Date
              </label>
              <input
                type="date"
                required
                value={formStartDate}
                onChange={(e) => setFormStartDate(e.target.value)}
                className="mt-1 block w-full rounded-[6px] border border-[#E2DDD3] px-3 py-1.5 text-sm text-[#1D1C1A] focus:border-[#1F4D3A] focus:outline-none focus:ring-1 focus:ring-[#1F4D3A]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-[#6B675F]">
                End Date
              </label>
              <input
                type="date"
                required
                value={formEndDate}
                onChange={(e) => setFormEndDate(e.target.value)}
                className="mt-1 block w-full rounded-[6px] border border-[#E2DDD3] px-3 py-1.5 text-sm text-[#1D1C1A] focus:border-[#1F4D3A] focus:outline-none focus:ring-1 focus:ring-[#1F4D3A]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-[#6B675F]">
              Note (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Vacation, medical appointment"
              value={formNote}
              onChange={(e) => setFormNote(e.target.value)}
              className="mt-1 block w-full rounded-[6px] border border-[#E2DDD3] px-3 py-1.5 text-sm text-[#1D1C1A] focus:border-[#1F4D3A] focus:outline-none focus:ring-1 focus:ring-[#1F4D3A]"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-[#E2DDD3]">
            <button
              type="button"
              onClick={closeModal}
              className="rounded-[6px] border border-[#E2DDD3] px-3 py-1.5 text-sm text-[#6B675F] hover:bg-[#F5F2EC] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-[6px] bg-[#1F4D3A] px-4 py-1.5 text-sm font-medium text-[#F5F2EC] hover:bg-[#1F4D3A]/90 disabled:opacity-50 transition-colors"
            >
              {submitting ? "Saving…" : "Save Leave"}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
