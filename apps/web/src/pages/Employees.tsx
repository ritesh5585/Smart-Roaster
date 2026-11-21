import { useState, useEffect, useRef, type FormEvent } from "react";
import Navbar from "../components/Navbar";
import { useAuth } from "../context/AuthContext";
import { api, type Employee, type Pod } from "../lib/api";

export default function EmployeesPage() {
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "MANAGER";

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [pods, setPods] = useState<Pod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [activeOnly, setActiveOnly] = useState(false);

  // Modal State
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    podId: "",
    isActive: true,
  });
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    const [empRes, podRes] = await Promise.all([
      api.getEmployees({ active: activeOnly }),
      api.getPods(),
    ]);

    if (empRes.error) setError(empRes.error);
    else if (empRes.data) setEmployees(empRes.data);

    if (podRes.data) setPods(podRes.data);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [activeOnly]);

  const openAddModal = () => {
    setEditingEmp(null);
    setFormData({ name: "", email: "", podId: "", isActive: true });
    setModalError(null);
    dialogRef.current?.showModal();
  };

  const openEditModal = (emp: Employee) => {
    setEditingEmp(emp);
    setFormData({
      name: emp.name,
      email: emp.email || "",
      podId: emp.podId || "",
      isActive: emp.isActive,
    });
    setModalError(null);
    dialogRef.current?.showModal();
  };

  const closeModal = () => {
    dialogRef.current?.close();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setModalError(null);

    if (editingEmp) {
      const res = await api.updateEmployee(editingEmp.id, {
        name: formData.name.trim(),
        email: formData.email.trim() || null,
        podId: formData.podId || null,
        isActive: formData.isActive,
      });
      if (res.error) {
        setModalError(res.error);
        setSubmitting(false);
        return;
      }
    } else {
      const res = await api.createEmployee({
        name: formData.name.trim(),
        email: formData.email.trim() || null,
        podId: formData.podId || null,
      });
      if (res.error) {
        setModalError(res.error);
        setSubmitting(false);
        return;
      }
    }

    setSubmitting(false);
    closeModal();
    fetchData();
  };

  const toggleStatus = async (emp: Employee) => {
    const res = await api.updateEmployee(emp.id, { isActive: !emp.isActive });
    if (res.error) {
      setError(res.error);
    } else {
      fetchData();
    }
  };

  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch =
      emp.name.toLowerCase().includes(search.toLowerCase()) ||
      (emp.email && emp.email.toLowerCase().includes(search.toLowerCase()));
    return matchesSearch;
  });

  return (
    <div className="min-h-screen bg-[#F5F2EC]">
      <Navbar />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="font-['Newsreader',Georgia,serif] text-3xl font-medium tracking-tight text-[#1D1C1A]">
              Employees
            </h1>
            <p className="mt-1 text-sm text-[#6B675F]">
              Manage operations staff, assignments, and pod memberships.
            </p>
          </div>
          {canEdit && (
            <button
              type="button"
              onClick={openAddModal}
              className="inline-flex items-center justify-center rounded-[6px] bg-[#1F4D3A] px-4 py-2 text-sm font-medium text-[#F5F2EC] hover:bg-[#1F4D3A]/90 transition-colors"
            >
              Add Employee
            </button>
          )}
        </div>

        {error && (
          <div className="mb-6 rounded-[6px] border border-[#A3262A]/20 bg-[#A3262A]/5 p-3 text-sm text-[#A3262A]">
            {error}
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 rounded-[6px] border border-[#E2DDD3] bg-[#FFFFFF] p-4">
          <div className="w-full sm:w-72">
            <input
              type="text"
              placeholder="Search by name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-[6px] border border-[#E2DDD3] bg-[#FFFFFF] px-3 py-1.5 text-sm text-[#1D1C1A] placeholder-[#6B675F]/60 focus:border-[#1F4D3A] focus:outline-none focus:ring-1 focus:ring-[#1F4D3A]"
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer text-sm text-[#1D1C1A]">
            <input
              type="checkbox"
              checked={activeOnly}
              onChange={(e) => setActiveOnly(e.target.checked)}
              className="rounded border-[#E2DDD3] text-[#1F4D3A] focus:ring-[#1F4D3A]"
            />
            <span>Active only</span>
          </label>
        </div>

        {/* Table */}
        <div className="rounded-[6px] border border-[#E2DDD3] bg-[#FFFFFF] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[#E2DDD3] bg-[#F5F2EC]/60 text-xs uppercase tracking-wider text-[#6B675F]">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Pod</th>
                  <th className="px-4 py-3 font-medium text-center">Assignments</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  {canEdit && <th className="px-4 py-3 font-medium text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2DDD3]">
                {loading ? (
                  <tr>
                    <td colSpan={canEdit ? 6 : 5} className="py-8 text-center text-sm text-[#6B675F]">
                      Loading staff records…
                    </td>
                  </tr>
                ) : filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={canEdit ? 6 : 5} className="py-8 text-center text-sm text-[#6B675F]">
                      No employees found.
                    </td>
                  </tr>
                ) : (
                  filteredEmployees.map((emp) => (
                    <tr key={emp.id} className="hover:bg-[#F5F2EC]/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-[#1D1C1A]">{emp.name}</td>
                      <td className="px-4 py-3 text-[#6B675F]">{emp.email || "—"}</td>
                      <td className="px-4 py-3 text-[#1D1C1A]">{emp.pod?.name || "Unassigned"}</td>
                      <td className="px-4 py-3 text-center text-[#1D1C1A]">
                        {emp._count?.assignments ?? 0}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block rounded-[6px] px-2 py-0.5 text-xs font-medium ${emp.isActive
                              ? "bg-[#E4ECE6] text-[#1F4D3A]"
                              : "bg-[#E2DDD3]/50 text-[#6B675F]"
                            }`}
                        >
                          {emp.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      {canEdit && (
                        <td className="px-4 py-3 text-right space-x-2">
                          <button
                            type="button"
                            onClick={() => openEditModal(emp)}
                            className="text-xs font-medium text-[#1F4D3A] hover:underline"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleStatus(emp)}
                            className={`text-xs font-medium ${emp.isActive
                                ? "text-[#A3262A] hover:underline"
                                : "text-[#1F4D3A] hover:underline"
                              }`}
                          >
                            {emp.isActive ? "Deactivate" : "Activate"}
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

      {/* Native <dialog> Modal for Add/Edit */}
      <dialog
        ref={dialogRef}
        className="backdrop:bg-black/40 rounded-[6px] border border-[#E2DDD3] bg-[#FFFFFF] p-6 max-w-md w-full text-left"
      >
        <h2 className="font-['Newsreader',Georgia,serif] text-xl font-medium text-[#1D1C1A]">
          {editingEmp ? "Edit Employee" : "Add Employee"}
        </h2>

        {modalError && (
          <div className="mt-3 rounded-[6px] border border-[#A3262A]/20 bg-[#A3262A]/5 p-2 text-xs text-[#A3262A]">
            {modalError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-[#6B675F]">
              Full Name
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="mt-1 block w-full rounded-[6px] border border-[#E2DDD3] px-3 py-1.5 text-sm text-[#1D1C1A] focus:border-[#1F4D3A] focus:outline-none focus:ring-1 focus:ring-[#1F4D3A]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-[#6B675F]">
              Work Email
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="mt-1 block w-full rounded-[6px] border border-[#E2DDD3] px-3 py-1.5 text-sm text-[#1D1C1A] focus:border-[#1F4D3A] focus:outline-none focus:ring-1 focus:ring-[#1F4D3A]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-[#6B675F]">
              Assigned Pod
            </label>
            <select
              value={formData.podId}
              onChange={(e) => setFormData({ ...formData, podId: e.target.value })}
              className="mt-1 block w-full rounded-[6px] border border-[#E2DDD3] bg-[#FFFFFF] px-3 py-1.5 text-sm text-[#1D1C1A] focus:border-[#1F4D3A] focus:outline-none focus:ring-1 focus:ring-[#1F4D3A]"
            >
              <option value="">Unassigned</option>
              {pods.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {editingEmp && (
            <label className="flex items-center gap-2 cursor-pointer pt-1 text-sm text-[#1D1C1A]">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="rounded border-[#E2DDD3] text-[#1F4D3A] focus:ring-[#1F4D3A]"
              />
              <span>Active Employee</span>
            </label>
          )}

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
              {submitting ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
