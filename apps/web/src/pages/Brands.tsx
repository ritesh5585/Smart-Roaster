import { useState, useEffect, useRef, type FormEvent } from "react";
import Navbar from "../components/Navbar";
import { useAuth } from "../context/AuthContext";
import {
  api,
  type Brand,
  type Process,
  type Employee,
  type OperatingRule,
} from "../lib/api";

const RULE_LABELS: Record<OperatingRule, string> = {
  ALL_365: "365 days",
  EXCEPT_HOLIDAYS: "Daily except holidays",
  NO_SUN_HOLIDAYS: "No Sun & holidays",
};

export default function BrandsPage() {
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "MANAGER";

  const [brands, setBrands] = useState<Brand[]>([]);
  const [allProcesses, setAllProcesses] = useState<Process[]>([]);
  const [activeEmployees, setActiveEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Expanded brands
  const [expandedBrandIds, setExpandedBrandIds] = useState<Record<string, boolean>>({});

  // Add Brand Dialog
  const addBrandDialogRef = useRef<HTMLDialogElement>(null);
  const [newBrandName, setNewBrandName] = useState("");
  const [addingBrand, setAddingBrand] = useState(false);
  const [addBrandError, setAddBrandError] = useState<string | null>(null);

  // Add Process Dialog
  const addProcessDialogRef = useRef<HTMLDialogElement>(null);
  const [selectedBrandForProcess, setSelectedBrandForProcess] = useState<Brand | null>(null);
  const [selectedProcessId, setSelectedProcessId] = useState("");
  const [selectedOperatingRule, setSelectedOperatingRule] = useState<OperatingRule>("EXCEPT_HOLIDAYS");
  const [selectedMinCoverage, setSelectedMinCoverage] = useState(1);
  const [addingProcess, setAddingProcess] = useState(false);
  const [addProcessError, setAddProcessError] = useState<string | null>(null);

  // Inline editing state for brand-process: { bpId: { operatingRule, minCoverage, saving } }
  const [editingBp, setEditingBp] = useState<Record<string, { operatingRule: OperatingRule; minCoverage: number; saving?: boolean }>>({});

  // Assign employee state per brand process: { [bpId]: employeeId }
  const [selectedAssignee, setSelectedAssignee] = useState<Record<string, string>>({});
  const [assigningMap, setAssigningMap] = useState<Record<string, boolean>>({});

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    const [brandRes, procRes, empRes] = await Promise.all([
      api.getBrands(),
      api.getProcesses(),
      api.getEmployees({ active: true }),
    ]);

    if (brandRes.error) setError(brandRes.error);
    else if (brandRes.data) setBrands(brandRes.data);

    if (procRes.data) setAllProcesses(procRes.data);
    if (empRes.data) setActiveEmployees(empRes.data);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const toggleBrandExpand = (brandId: string) => {
    setExpandedBrandIds((prev) => ({ ...prev, [brandId]: !prev[brandId] }));
  };

  // Add Brand
  const openAddBrandModal = () => {
    setNewBrandName("");
    setAddBrandError(null);
    addBrandDialogRef.current?.showModal();
  };

  const handleCreateBrand = async (e: FormEvent) => {
    e.preventDefault();
    setAddingBrand(true);
    setAddBrandError(null);

    const res = await api.createBrand({ name: newBrandName.trim() });
    setAddingBrand(false);
    if (res.error) {
      setAddBrandError(res.error);
      return;
    }
    addBrandDialogRef.current?.close();
    fetchData();
  };

  // Toggle Brand Active
  const handleToggleBrandActive = async (b: Brand) => {
    const res = await api.updateBrand(b.id, { isActive: !b.isActive });
    if (res.error) {
      setError(res.error);
    } else {
      fetchData();
    }
  };

  // Add Process to Brand
  const openAddProcessModal = (brand: Brand) => {
    setSelectedBrandForProcess(brand);
    // filter processes not already added
    const existingProcessIds = new Set(brand.brandProcesses.map((bp) => bp.processId));
    const available = allProcesses.filter((p) => !existingProcessIds.has(p.id));
    setSelectedProcessId(available[0]?.id || "");
    setSelectedOperatingRule("EXCEPT_HOLIDAYS");
    setSelectedMinCoverage(1);
    setAddProcessError(null);
    addProcessDialogRef.current?.showModal();
  };

  const handleCreateBrandProcess = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedBrandForProcess || !selectedProcessId) return;

    setAddingProcess(true);
    setAddProcessError(null);

    const res = await api.createBrandProcess({
      brandId: selectedBrandForProcess.id,
      processId: selectedProcessId,
      operatingRule: selectedOperatingRule,
      minCoverage: selectedMinCoverage,
    });

    setAddingProcess(false);
    if (res.error) {
      setAddProcessError(res.error);
      return;
    }
    addProcessDialogRef.current?.close();
    fetchData();
  };

  // Inline update Brand Process
  const handleInlineSaveBp = async (bpId: string) => {
    const editState = editingBp[bpId];
    if (!editState) return;

    setEditingBp((prev) => ({ ...prev, [bpId]: { ...prev[bpId], saving: true } }));
    const res = await api.updateBrandProcess(bpId, {
      operatingRule: editState.operatingRule,
      minCoverage: editState.minCoverage,
    });
    if (res.error) {
      setError(res.error);
      setEditingBp((prev) => ({ ...prev, [bpId]: { ...prev[bpId], saving: false } }));
    } else {
      // Clear edit state for this bp
      setEditingBp((prev) => {
        const next = { ...prev };
        delete next[bpId];
        return next;
      });
      fetchData();
    }
  };

  // Remove Brand Process
  const handleDeleteBrandProcess = async (bpId: string) => {
    if (!window.confirm("Remove this process and its assignments from the brand?")) return;
    const res = await api.deleteBrandProcess(bpId);
    if (res.error) {
      setError(res.error);
    } else {
      fetchData();
    }
  };

  // Assign Employee
  const handleAssignEmployee = async (bpId: string) => {
    const empId = selectedAssignee[bpId];
    if (!empId) return;

    setAssigningMap((prev) => ({ ...prev, [bpId]: true }));
    const res = await api.createAssignment({ employeeId: empId, brandProcessId: bpId });
    setAssigningMap((prev) => ({ ...prev, [bpId]: false }));

    if (res.error) {
      setError(res.error);
    } else {
      setSelectedAssignee((prev) => ({ ...prev, [bpId]: "" }));
      fetchData();
    }
  };

  // Remove Assignment
  const handleRemoveAssignment = async (assignmentId: string) => {
    const res = await api.deleteAssignment(assignmentId);
    if (res.error) {
      setError(res.error);
    } else {
      fetchData();
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
              Brands & Coverage
            </h1>
            <p className="mt-1 text-sm text-[#6B675F]">
              Configure brand operating requirements, coverage rules, and staff mappings.
            </p>
          </div>
          {canEdit && (
            <button
              type="button"
              onClick={openAddBrandModal}
              className="inline-flex items-center justify-center rounded-[6px] bg-[#1F4D3A] px-4 py-2 text-sm font-medium text-[#F5F2EC] hover:bg-[#1F4D3A]/90 transition-colors"
            >
              Add Brand
            </button>
          )}
        </div>

        {error && (
          <div className="mb-6 rounded-[6px] border border-[#A3262A]/20 bg-[#A3262A]/5 p-3 text-sm text-[#A3262A]">
            {error}
          </div>
        )}

        {/* Brands Accordion List */}
        <div className="space-y-3">
          {loading ? (
            <div className="rounded-[6px] border border-[#E2DDD3] bg-[#FFFFFF] p-8 text-center text-sm text-[#6B675F]">
              Loading brands and coverage…
            </div>
          ) : brands.length === 0 ? (
            <div className="rounded-[6px] border border-[#E2DDD3] bg-[#FFFFFF] p-8 text-center text-sm text-[#6B675F]">
              No brands found.
            </div>
          ) : (
            brands.map((brand) => {
              const isExpanded = !!expandedBrandIds[brand.id];
              const bpCount = brand.brandProcesses?.length ?? 0;

              return (
                <div
                  key={brand.id}
                  className="rounded-[6px] border border-[#E2DDD3] bg-[#FFFFFF] overflow-hidden transition-colors"
                >
                  {/* Brand Row Header */}
                  <div className="flex flex-wrap items-center justify-between p-4 gap-3">
                    <button
                      type="button"
                      onClick={() => toggleBrandExpand(brand.id)}
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
                            {brand.name}
                          </span>
                          <span
                            className={`rounded-[6px] px-2 py-0.5 text-xs font-medium ${brand.isActive
                                ? "bg-[#E4ECE6] text-[#1F4D3A]"
                                : "bg-[#E2DDD3]/50 text-[#6B675F]"
                              }`}
                          >
                            {brand.isActive ? "Active" : "Inactive"}
                          </span>
                        </div>
                        <p className="text-xs text-[#6B675F]">
                          {bpCount} operational process{bpCount === 1 ? "" : "es"}
                        </p>
                      </div>
                    </button>

                    <div className="flex items-center gap-3">
                      {canEdit && (
                        <>
                          <button
                            type="button"
                            onClick={() => openAddProcessModal(brand)}
                            className="rounded-[6px] border border-[#E2DDD3] px-3 py-1 text-xs font-medium text-[#1D1C1A] hover:bg-[#F5F2EC] transition-colors"
                          >
                            Add Process
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleBrandActive(brand)}
                            className={`text-xs font-medium ${brand.isActive ? "text-[#A3262A]" : "text-[#1F4D3A]"
                              } hover:underline`}
                          >
                            {brand.isActive ? "Deactivate" : "Activate"}
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Expanded Content: Brand Processes */}
                  {isExpanded && (
                    <div className="border-t border-[#E2DDD3] bg-[#F5F2EC]/30 p-4 space-y-4">
                      {brand.brandProcesses.length === 0 ? (
                        <p className="text-xs text-[#6B675F]">No processes configured for this brand yet.</p>
                      ) : (
                        brand.brandProcesses.map((bp) => {
                          const assignedList = bp.assignments || [];
                          const isSinglePointOfFailure =
                            bp.operatingRule === "ALL_365" && assignedList.length < bp.minCoverage + 1;

                          const edit = editingBp[bp.id];
                          const isEditing = !!edit;

                          // Active employees not yet assigned to this brand-process
                          const assignedEmpIds = new Set(assignedList.map((a) => a.employeeId));
                          const unassignedActive = activeEmployees.filter((e) => !assignedEmpIds.has(e.id));

                          return (
                            <div
                              key={bp.id}
                              className="rounded-[6px] border border-[#E2DDD3] bg-[#FFFFFF] p-4 text-sm space-y-3"
                            >
                              {/* Top Bar of Process */}
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-xs rounded-[4px] bg-[#1D1C1A] text-[#F5F2EC] px-2 py-0.5">
                                    {bp.process.code}
                                  </span>
                                  <span className="font-medium text-[#1D1C1A]">{bp.process.name}</span>
                                  {isSinglePointOfFailure && (
                                    <span className="rounded-[6px] border border-[#B45309]/30 bg-[#B45309]/10 px-2 py-0.5 text-xs font-medium text-[#B45309]">
                                      Single point of failure
                                    </span>
                                  )}
                                </div>

                                {canEdit && (
                                  <div className="flex items-center gap-2">
                                    {isEditing ? (
                                      <>
                                        <button
                                          type="button"
                                          disabled={edit.saving}
                                          onClick={() => handleInlineSaveBp(bp.id)}
                                          className="text-xs font-medium text-[#1F4D3A] hover:underline disabled:opacity-50"
                                        >
                                          {edit.saving ? "Saving…" : "Save"}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setEditingBp((prev) => {
                                              const next = { ...prev };
                                              delete next[bp.id];
                                              return next;
                                            })
                                          }
                                          className="text-xs text-[#6B675F] hover:underline"
                                        >
                                          Cancel
                                        </button>
                                      </>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setEditingBp((prev) => ({
                                            ...prev,
                                            [bp.id]: {
                                              operatingRule: bp.operatingRule,
                                              minCoverage: bp.minCoverage,
                                            },
                                          }))
                                        }
                                        className="text-xs text-[#1F4D3A] hover:underline"
                                      >
                                        Edit rule
                                      </button>
                                    )}

                                    <button
                                      type="button"
                                      onClick={() => handleDeleteBrandProcess(bp.id)}
                                      className="text-xs text-[#A3262A] hover:underline ml-2"
                                    >
                                      Remove process
                                    </button>
                                  </div>
                                )}
                              </div>

                              {/* Rules & Coverage Row */}
                              <div className="flex flex-wrap items-center gap-6 text-xs text-[#6B675F]">
                                <div>
                                  <span className="font-medium text-[#1D1C1A]">Operating Rule: </span>
                                  {isEditing ? (
                                    <select
                                      value={edit.operatingRule}
                                      onChange={(e) =>
                                        setEditingBp((prev) => ({
                                          ...prev,
                                          [bp.id]: {
                                            ...prev[bp.id],
                                            operatingRule: e.target.value as OperatingRule,
                                          },
                                        }))
                                      }
                                      className="ml-1 rounded-[4px] border border-[#E2DDD3] bg-[#FFFFFF] px-2 py-0.5 text-xs text-[#1D1C1A]"
                                    >
                                      <option value="ALL_365">365 days</option>
                                      <option value="EXCEPT_HOLIDAYS">Daily except holidays</option>
                                      <option value="NO_SUN_HOLIDAYS">No Sun & holidays</option>
                                    </select>
                                  ) : (
                                    <span>{RULE_LABELS[bp.operatingRule]}</span>
                                  )}
                                </div>

                                <div>
                                  <span className="font-medium text-[#1D1C1A]">Min Coverage: </span>
                                  {isEditing ? (
                                    <input
                                      type="number"
                                      min={1}
                                      max={20}
                                      value={edit.minCoverage}
                                      onChange={(e) =>
                                        setEditingBp((prev) => ({
                                          ...prev,
                                          [bp.id]: {
                                            ...prev[bp.id],
                                            minCoverage: Number(e.target.value),
                                          },
                                        }))
                                      }
                                      className="ml-1 w-16 rounded-[4px] border border-[#E2DDD3] bg-[#FFFFFF] px-2 py-0.5 text-xs text-[#1D1C1A]"
                                    />
                                  ) : (
                                    <span>{bp.minCoverage} staff</span>
                                  )}
                                </div>
                              </div>

                              {/* Assigned Employees Chips */}
                              <div>
                                <span className="text-xs font-medium uppercase tracking-wider text-[#6B675F] block mb-1.5">
                                  Assigned Staff ({assignedList.length})
                                </span>
                                <div className="flex flex-wrap gap-2 items-center">
                                  {assignedList.length === 0 ? (
                                    <span className="text-xs text-[#6B675F] italic">No employees assigned yet.</span>
                                  ) : (
                                    assignedList.map((a) => (
                                      <span
                                        key={a.id}
                                        className="inline-flex items-center gap-1.5 rounded-[6px] border border-[#E2DDD3] bg-[#F5F2EC] px-2.5 py-1 text-xs text-[#1D1C1A]"
                                      >
                                        <span>{a.employee?.name || "Unknown"}</span>
                                        {canEdit && (
                                          <button
                                            type="button"
                                            onClick={() => handleRemoveAssignment(a.id)}
                                            className="text-[#6B675F] hover:text-[#A3262A] focus:outline-none"
                                            title="Remove assignment"
                                          >
                                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                          </button>
                                        )}
                                      </span>
                                    ))
                                  )}

                                  {/* Assign Employee dropdown */}
                                  {canEdit && unassignedActive.length > 0 && (
                                    <div className="flex items-center gap-2 mt-1 sm:mt-0">
                                      <select
                                        value={selectedAssignee[bp.id] || ""}
                                        onChange={(e) =>
                                          setSelectedAssignee((prev) => ({
                                            ...prev,
                                            [bp.id]: e.target.value,
                                          }))
                                        }
                                        className="rounded-[4px] border border-[#E2DDD3] bg-[#FFFFFF] px-2 py-1 text-xs text-[#1D1C1A]"
                                      >
                                        <option value="">+ Assign staff…</option>
                                        {unassignedActive.map((e) => (
                                          <option key={e.id} value={e.id}>
                                            {e.name}
                                          </option>
                                        ))}
                                      </select>
                                      {selectedAssignee[bp.id] && (
                                        <button
                                          type="button"
                                          disabled={assigningMap[bp.id]}
                                          onClick={() => handleAssignEmployee(bp.id)}
                                          className="rounded-[4px] bg-[#1F4D3A] px-2 py-1 text-xs font-medium text-[#F5F2EC] hover:bg-[#1F4D3A]/90 disabled:opacity-50"
                                        >
                                          {assigningMap[bp.id] ? "Assigning…" : "Assign"}
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </main>

      {/* Add Brand Dialog */}
      <dialog
        ref={addBrandDialogRef}
        className="backdrop:bg-black/40 rounded-[6px] border border-[#E2DDD3] bg-[#FFFFFF] p-6 max-w-md w-full text-left"
      >
        <h2 className="font-['Newsreader',Georgia,serif] text-xl font-medium text-[#1D1C1A]">
          Add Brand
        </h2>

        {addBrandError && (
          <div className="mt-3 rounded-[6px] border border-[#A3262A]/20 bg-[#A3262A]/5 p-2 text-xs text-[#A3262A]">
            {addBrandError}
          </div>
        )}

        <form onSubmit={handleCreateBrand} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-[#6B675F]">
              Brand Name
            </label>
            <input
              type="text"
              required
              value={newBrandName}
              onChange={(e) => setNewBrandName(e.target.value)}
              className="mt-1 block w-full rounded-[6px] border border-[#E2DDD3] px-3 py-1.5 text-sm text-[#1D1C1A] focus:border-[#1F4D3A] focus:outline-none focus:ring-1 focus:ring-[#1F4D3A]"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-[#E2DDD3]">
            <button
              type="button"
              onClick={() => addBrandDialogRef.current?.close()}
              className="rounded-[6px] border border-[#E2DDD3] px-3 py-1.5 text-sm text-[#6B675F] hover:bg-[#F5F2EC] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={addingBrand}
              className="rounded-[6px] bg-[#1F4D3A] px-4 py-1.5 text-sm font-medium text-[#F5F2EC] hover:bg-[#1F4D3A]/90 disabled:opacity-50 transition-colors"
            >
              {addingBrand ? "Saving…" : "Save Brand"}
            </button>
          </div>
        </form>
      </dialog>

      {/* Add Process to Brand Dialog */}
      <dialog
        ref={addProcessDialogRef}
        className="backdrop:bg-black/40 rounded-[6px] border border-[#E2DDD3] bg-[#FFFFFF] p-6 max-w-md w-full text-left"
      >
        <h2 className="font-['Newsreader',Georgia,serif] text-xl font-medium text-[#1D1C1A]">
          Add Process to {selectedBrandForProcess?.name}
        </h2>

        {addProcessError && (
          <div className="mt-3 rounded-[6px] border border-[#A3262A]/20 bg-[#A3262A]/5 p-2 text-xs text-[#A3262A]">
            {addProcessError}
          </div>
        )}

        <form onSubmit={handleCreateBrandProcess} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-[#6B675F]">
              Process
            </label>
            <select
              required
              value={selectedProcessId}
              onChange={(e) => setSelectedProcessId(e.target.value)}
              className="mt-1 block w-full rounded-[6px] border border-[#E2DDD3] bg-[#FFFFFF] px-3 py-1.5 text-sm text-[#1D1C1A] focus:border-[#1F4D3A] focus:outline-none focus:ring-1 focus:ring-[#1F4D3A]"
            >
              {allProcesses
                .filter(
                  (p) =>
                    !selectedBrandForProcess?.brandProcesses.some((bp) => bp.processId === p.id)
                )
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} - {p.name}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-[#6B675F]">
              Operating Rule
            </label>
            <select
              value={selectedOperatingRule}
              onChange={(e) => setSelectedOperatingRule(e.target.value as OperatingRule)}
              className="mt-1 block w-full rounded-[6px] border border-[#E2DDD3] bg-[#FFFFFF] px-3 py-1.5 text-sm text-[#1D1C1A] focus:border-[#1F4D3A] focus:outline-none focus:ring-1 focus:ring-[#1F4D3A]"
            >
              <option value="ALL_365">365 days</option>
              <option value="EXCEPT_HOLIDAYS">Daily except holidays</option>
              <option value="NO_SUN_HOLIDAYS">No Sun & holidays</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-[#6B675F]">
              Min Coverage (1 - 20 staff)
            </label>
            <input
              type="number"
              min={1}
              max={20}
              required
              value={selectedMinCoverage}
              onChange={(e) => setSelectedMinCoverage(Number(e.target.value))}
              className="mt-1 block w-full rounded-[6px] border border-[#E2DDD3] px-3 py-1.5 text-sm text-[#1D1C1A] focus:border-[#1F4D3A] focus:outline-none focus:ring-1 focus:ring-[#1F4D3A]"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-[#E2DDD3]">
            <button
              type="button"
              onClick={() => addProcessDialogRef.current?.close()}
              className="rounded-[6px] border border-[#E2DDD3] px-3 py-1.5 text-sm text-[#6B675F] hover:bg-[#F5F2EC] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={addingProcess}
              className="rounded-[6px] bg-[#1F4D3A] px-4 py-1.5 text-sm font-medium text-[#F5F2EC] hover:bg-[#1F4D3A]/90 disabled:opacity-50 transition-colors"
            >
              {addingProcess ? "Adding…" : "Add Process"}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
