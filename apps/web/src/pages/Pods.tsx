import { useState, useEffect, useRef, type FormEvent } from "react";
import Navbar from "../components/Navbar";
import { useAuth } from "../context/AuthContext";
import { api, type Pod, type Employee } from "../lib/api";

export default function PodsPage() {
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "MANAGER";

  const [pods, setPods] = useState<Pod[]>([]);
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Expanded Pods state
  const [expandedPodIds, setExpandedPodIds] = useState<Record<string, boolean>>({});

  // Dialog State
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [editingPod, setEditingPod] = useState<Pod | null>(null);
  const [podName, setPodName] = useState("");
  const [leadId, setLeadId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    const [podRes, empRes] = await Promise.all([
      api.getPods(),
      api.getEmployees(),
    ]);

    if (podRes.error) setError(podRes.error);
    else if (podRes.data) setPods(podRes.data);

    if (empRes.data) setAllEmployees(empRes.data);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const togglePodExpand = (podId: string) => {
    setExpandedPodIds((prev) => ({ ...prev, [podId]: !prev[podId] }));
  };

  const openAddModal = () => {
    setEditingPod(null);
    setPodName("");
    setLeadId("");
    setModalError(null);
    dialogRef.current?.showModal();
  };

  const openEditModal = (pod: Pod) => {
    setEditingPod(pod);
    setPodName(pod.name);
    setLeadId(pod.leadId || "");
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

    if (editingPod) {
      const res = await api.updatePod(editingPod.id, {
        name: podName.trim(),
        leadId: leadId || null,
      });
      if (res.error) {
        setModalError(res.error);
        setSubmitting(false);
        return;
      }
    } else {
      const res = await api.createPod({
        name: podName.trim(),
        leadId: leadId || null,
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

  return (
    <div className="min-h-screen bg-[#F5F2EC]">
      <Navbar />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="font-['Newsreader',Georgia,serif] text-3xl font-medium tracking-tight text-[#1D1C1A]">
              Operational Pods
            </h1>
            <p className="mt-1 text-sm text-[#6B675F]">
              Team groupings, designated pod leads, and member distributions.
            </p>
          </div>
          {canEdit && (
            <button
              type="button"
              onClick={openAddModal}
              className="inline-flex items-center justify-center rounded-[6px] bg-[#1F4D3A] px-4 py-2 text-sm font-medium text-[#F5F2EC] hover:bg-[#1F4D3A]/90 transition-colors"
            >
              Add Pod
            </button>
          )}
        </div>

        {error && (
          <div className="mb-6 rounded-[6px] border border-[#A3262A]/20 bg-[#A3262A]/5 p-3 text-sm text-[#A3262A]">
            {error}
          </div>
        )}

        {/* Cards-less List */}
        <div className="rounded-[6px] border border-[#E2DDD3] bg-[#FFFFFF] divide-y divide-[#E2DDD3] overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-sm text-[#6B675F]">Loading operational pods…</div>
          ) : pods.length === 0 ? (
            <div className="p-8 text-center text-sm text-[#6B675F]">No pods configured yet.</div>
          ) : (
            pods.map((pod) => {
              const isExpanded = !!expandedPodIds[pod.id];
              const members = allEmployees.filter((e) => e.podId === pod.id);
              const memberCount = pod._count?.members ?? members.length;

              return (
                <div key={pod.id} className="transition-colors">
                  {/* Pod Row */}
                  <div className="flex flex-wrap items-center justify-between p-4 gap-3">
                    <button
                      type="button"
                      onClick={() => togglePodExpand(pod.id)}
                      className="flex items-center gap-3 text-left focus:outline-none"
                    >
                      <svg
                        className={`h-4 w-4 text-[#6B675F] transition-transform ${isExpanded ? "rotate-90" : ""
                          }`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-['Newsreader',Georgia,serif] text-lg font-medium text-[#1D1C1A]">
                            {pod.name}
                          </span>
                        </div>
                        <p className="text-xs text-[#6B675F]">
                          Lead:{" "}
                          <span className="font-medium text-[#1D1C1A]">
                            {pod.lead?.name || "Unassigned"}
                          </span>{" "}
                          • {memberCount} member{memberCount === 1 ? "" : "s"}
                        </p>
                      </div>
                    </button>

                    <div className="flex items-center gap-3">
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => openEditModal(pod)}
                          className="text-xs font-medium text-[#1F4D3A] hover:underline"
                        >
                          Edit
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expanded Members View */}
                  {isExpanded && (
                    <div className="border-t border-[#E2DDD3] bg-[#F5F2EC]/40 p-4">
                      <div className="text-xs font-medium uppercase tracking-wider text-[#6B675F] mb-2">
                        Pod Members
                      </div>
                      {members.length === 0 ? (
                        <p className="text-xs text-[#6B675F]">No staff members assigned to this pod.</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead className="border-b border-[#E2DDD3] text-[#6B675F]">
                              <tr>
                                <th className="py-2 pr-4 font-medium">Name</th>
                                <th className="py-2 pr-4 font-medium">Email</th>
                                <th className="py-2 pr-4 font-medium">Assignments</th>
                                <th className="py-2 font-medium">Role in Pod</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#E2DDD3]/60">
                              {members.map((m) => (
                                <tr key={m.id}>
                                  <td className="py-2 pr-4 font-medium text-[#1D1C1A]">{m.name}</td>
                                  <td className="py-2 pr-4 text-[#6B675F]">{m.email || "—"}</td>
                                  <td className="py-2 pr-4 text-[#1D1C1A]">{m._count?.assignments ?? 0}</td>
                                  <td className="py-2">
                                    {m.id === pod.leadId ? (
                                      <span className="rounded-[4px] bg-[#E4ECE6] px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[#1F4D3A]">
                                        Pod Lead
                                      </span>
                                    ) : (
                                      <span className="text-[#6B675F]">Member</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </main>

      {/* Dialog for Add/Edit Pod */}
      <dialog
        ref={dialogRef}
        className="backdrop:bg-black/40 rounded-[6px] border border-[#E2DDD3] bg-[#FFFFFF] p-6 max-w-md w-full text-left"
      >
        <h2 className="font-['Newsreader',Georgia,serif] text-xl font-medium text-[#1D1C1A]">
          {editingPod ? "Edit Pod" : "Add Pod"}
        </h2>

        {modalError && (
          <div className="mt-3 rounded-[6px] border border-[#A3262A]/20 bg-[#A3262A]/5 p-2 text-xs text-[#A3262A]">
            {modalError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-[#6B675F]">
              Pod Name
            </label>
            <input
              type="text"
              required
              value={podName}
              onChange={(e) => setPodName(e.target.value)}
              className="mt-1 block w-full rounded-[6px] border border-[#E2DDD3] px-3 py-1.5 text-sm text-[#1D1C1A] focus:border-[#1F4D3A] focus:outline-none focus:ring-1 focus:ring-[#1F4D3A]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-[#6B675F]">
              Pod Lead
            </label>
            <select
              value={leadId}
              onChange={(e) => setLeadId(e.target.value)}
              className="mt-1 block w-full rounded-[6px] border border-[#E2DDD3] bg-[#FFFFFF] px-3 py-1.5 text-sm text-[#1D1C1A] focus:border-[#1F4D3A] focus:outline-none focus:ring-1 focus:ring-[#1F4D3A]"
            >
              <option value="">Unassigned</option>
              {allEmployees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} ({e.email || "no email"})
                </option>
              ))}
            </select>
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
              {submitting ? "Saving…" : "Save Pod"}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
