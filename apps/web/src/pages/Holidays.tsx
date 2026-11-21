import { useState, useEffect, useRef, type FormEvent } from "react";
import Navbar from "../components/Navbar";
import { useAuth } from "../context/AuthContext";
import { api, type Holiday } from "../lib/api";
import { formatDisplayDate, getWeekdayName, getTodayDateString } from "../lib/dateUtils";

export default function HolidaysPage() {
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "MANAGER";

  const currentYear = new Date().getUTCFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialog State
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [holidayDate, setHolidayDate] = useState("");
  const [holidayName, setHolidayName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const fetchHolidays = async () => {
    setLoading(true);
    setError(null);
    const res = await api.getHolidays({ year: selectedYear });
    if (res.error) setError(res.error);
    else if (res.data) setHolidays(res.data);
    setLoading(false);
  };

  useEffect(() => {
    fetchHolidays();
  }, [selectedYear]);

  const openAddModal = () => {
    setHolidayDate(getTodayDateString());
    setHolidayName("");
    setModalError(null);
    dialogRef.current?.showModal();
  };

  const closeModal = () => {
    dialogRef.current?.close();
  };

  const handleCreateHoliday = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setModalError(null);

    const res = await api.createHoliday({
      date: holidayDate,
      name: holidayName.trim(),
    });
    setSubmitting(false);

    if (res.error) {
      setModalError(res.error);
      return;
    }

    closeModal();
    fetchHolidays();
  };

  const handleDeleteHoliday = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this holiday?")) return;
    const res = await api.deleteHoliday(id);
    if (res.error) {
      setError(res.error);
    } else {
      fetchHolidays();
    }
  };

  const yearOptions = [currentYear - 1, currentYear, currentYear + 1];

  return (
    <div className="min-h-screen bg-[#F5F2EC]">
      <Navbar />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="font-['Newsreader',Georgia,serif] text-3xl font-medium tracking-tight text-[#1D1C1A]">
              Public Holidays
            </h1>
            <p className="mt-1 text-sm text-[#6B675F]">
              Operational calendar holidays for coverage rules and roster generation.
            </p>
          </div>
          {canEdit && (
            <button
              type="button"
              onClick={openAddModal}
              className="inline-flex items-center justify-center rounded-[6px] bg-[#1F4D3A] px-4 py-2 text-sm font-medium text-[#F5F2EC] hover:bg-[#1F4D3A]/90 transition-colors"
            >
              Add Holiday
            </button>
          )}
        </div>

        {error && (
          <div className="mb-6 rounded-[6px] border border-[#A3262A]/20 bg-[#A3262A]/5 p-3 text-sm text-[#A3262A]">
            {error}
          </div>
        )}

        {/* Year Selector */}
        <div className="flex items-center gap-2 mb-6 rounded-[6px] border border-[#E2DDD3] bg-[#FFFFFF] p-3">
          <span className="text-xs font-medium uppercase tracking-wider text-[#6B675F] mr-2">
            Select Year:
          </span>
          <div className="flex gap-2">
            {yearOptions.map((y) => (
              <button
                key={y}
                type="button"
                onClick={() => setSelectedYear(y)}
                className={`rounded-[6px] px-3 py-1 text-xs font-medium transition-colors ${
                  selectedYear === y
                    ? "bg-[#1F4D3A] text-[#F5F2EC]"
                    : "border border-[#E2DDD3] bg-[#FFFFFF] text-[#1D1C1A] hover:bg-[#F5F2EC]"
                }`}
              >
                {y}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="rounded-[6px] border border-[#E2DDD3] bg-[#FFFFFF] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[#E2DDD3] bg-[#F5F2EC]/60 text-xs uppercase tracking-wider text-[#6B675F]">
                <tr>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Weekday</th>
                  <th className="px-4 py-3 font-medium">Holiday Name</th>
                  {canEdit && <th className="px-4 py-3 font-medium text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2DDD3]">
                {loading ? (
                  <tr>
                    <td colSpan={canEdit ? 4 : 3} className="py-8 text-center text-sm text-[#6B675F]">
                      Loading holidays for {selectedYear}…
                    </td>
                  </tr>
                ) : holidays.length === 0 ? (
                  <tr>
                    <td colSpan={canEdit ? 4 : 3} className="py-8 text-center text-sm text-[#6B675F]">
                      No holidays scheduled for {selectedYear}.
                    </td>
                  </tr>
                ) : (
                  holidays.map((h) => (
                    <tr key={h.id} className="hover:bg-[#F5F2EC]/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-[#1D1C1A]">
                        {formatDisplayDate(h.date)}
                      </td>
                      <td className="px-4 py-3 text-xs text-[#6B675F]">{getWeekdayName(h.date)}</td>
                      <td className="px-4 py-3 text-[#1D1C1A]">{h.name}</td>
                      {canEdit && (
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleDeleteHoliday(h.id)}
                            className="text-xs font-medium text-[#A3262A] hover:underline"
                          >
                            Delete
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Add Holiday Dialog */}
      <dialog
        ref={dialogRef}
        className="backdrop:bg-black/40 rounded-[6px] border border-[#E2DDD3] bg-[#FFFFFF] p-6 max-w-md w-full text-left"
      >
        <h2 className="font-['Newsreader',Georgia,serif] text-xl font-medium text-[#1D1C1A]">
          Add Public Holiday
        </h2>

        {modalError && (
          <div className="mt-3 rounded-[6px] border border-[#A3262A]/20 bg-[#A3262A]/5 p-2 text-xs text-[#A3262A]">
            {modalError}
          </div>
        )}

        <form onSubmit={handleCreateHoliday} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-[#6B675F]">
              Date
            </label>
            <input
              type="date"
              required
              value={holidayDate}
              onChange={(e) => setHolidayDate(e.target.value)}
              className="mt-1 block w-full rounded-[6px] border border-[#E2DDD3] px-3 py-1.5 text-sm text-[#1D1C1A] focus:border-[#1F4D3A] focus:outline-none focus:ring-1 focus:ring-[#1F4D3A]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-[#6B675F]">
              Holiday Name
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Independence Day"
              value={holidayName}
              onChange={(e) => setHolidayName(e.target.value)}
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
              {submitting ? "Saving…" : "Save Holiday"}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
