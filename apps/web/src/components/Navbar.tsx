import { useState, useRef, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function RosterMark({ className = "w-4 h-4 text-[#1F4D3A]" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor">
      <rect x="0.5" y="0.5" width="4" height="4" rx="0.5" fill="currentColor" stroke="none" />
      <rect x="6.5" y="0.5" width="3" height="3" rx="0.5" strokeWidth="1" />
      <rect x="12.5" y="0.5" width="3" height="3" rx="0.5" strokeWidth="1" />
      <rect x="0.5" y="6.5" width="3" height="3" rx="0.5" strokeWidth="1" />
      <rect x="6.5" y="6.5" width="4" height="4" rx="0.5" fill="currentColor" stroke="none" />
      <rect x="12.5" y="6.5" width="3" height="3" rx="0.5" strokeWidth="1" />
      <rect x="0.5" y="12.5" width="3" height="3" rx="0.5" strokeWidth="1" />
      <rect x="6.5" y="12.5" width="3" height="3" rx="0.5" strokeWidth="1" />
      <rect x="12.5" y="12.5" width="3" height="3" rx="0.5" strokeWidth="1" />
    </svg>
  );
}

interface NavItem {
  label: string;
  to: string;
  ready: boolean;
}

const navByRole: Record<string, NavItem[]> = {
  ADMIN: [
    { label: "Dashboard", to: "/dashboard", ready: true },
    { label: "Employees", to: "/employees", ready: true },
    { label: "Brands", to: "/brands", ready: true },
    { label: "Pods", to: "/pods", ready: true },
    { label: "Roster", to: "/roster", ready: false },
    { label: "Conflicts", to: "/conflicts", ready: false },
    { label: "Users", to: "/users", ready: false },
  ],
  MANAGER: [
    { label: "Dashboard", to: "/dashboard", ready: true },
    { label: "Employees", to: "/employees", ready: true },
    { label: "Brands", to: "/brands", ready: true },
    { label: "Pods", to: "/pods", ready: true },
    { label: "Roster", to: "/roster", ready: false },
    { label: "Conflicts", to: "/conflicts", ready: false },
  ],
  POD_LEAD: [
    { label: "Dashboard", to: "/dashboard", ready: true },
    { label: "My Pod", to: "/my-pod", ready: false },
    { label: "Roster", to: "/roster", ready: false },
  ],
  EMPLOYEE: [
    { label: "Dashboard", to: "/dashboard", ready: true },
    { label: "My Schedule", to: "/schedule", ready: false },
  ],
};

function getInitials(name?: string): string {
  if (!name) return "SR";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const role = user?.role || "EMPLOYEE";
  const items = navByRole[role] || navByRole.EMPLOYEE;
  const activeItems = items.filter((item) => item.ready);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setDropdownOpen(false);
      }
    }

    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [dropdownOpen]);

  const handleLogout = async () => {
    setDropdownOpen(false);
    await logout();
    navigate("/login");
  };

  const isLinkActive = (to: string) => {
    if (to === "/dashboard" && (location.pathname === "/" || location.pathname === "/dashboard")) {
      return true;
    }
    return location.pathname === to;
  };

  return (
    <header className="border-b border-[#E2DDD3] bg-[#FFFFFF]">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        {/* Wordmark */}
        <Link to="/dashboard" className="flex items-center gap-2.5 text-[#1D1C1A] no-underline">
          <RosterMark className="h-4 w-4 text-[#1F4D3A]" />
          <span className="font-['Newsreader',Georgia,serif] text-xl font-medium tracking-tight">
            Smart Roster
          </span>
        </Link>

        {/* Desktop Nav Links */}
        <nav className="hidden md:flex items-center gap-6">
          {activeItems.map((item) => {
            const active = isLinkActive(item.to);
            return (
              <Link
                key={item.label}
                to={item.to}
                className={`py-1 text-sm font-medium transition-colors ${active
                    ? "border-b-2 border-[#1F4D3A] text-[#1F4D3A]"
                    : "text-[#6B675F] hover:text-[#1D1C1A]"
                  }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User Avatar + Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setDropdownOpen((prev) => !prev)}
            aria-haspopup="true"
            aria-expanded={dropdownOpen}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[#E4ECE6] text-xs font-semibold text-[#1F4D3A] transition hover:opacity-90 focus:outline-none focus:ring-1 focus:ring-[#1F4D3A]"
          >
            {getInitials(user?.name)}
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-64 rounded-[6px] border border-[#E2DDD3] bg-[#FFFFFF] p-3 shadow-sm z-50">
              <div className="mb-2">
                <p className="truncate text-sm font-medium text-[#1D1C1A]">{user?.name}</p>
                <p className="truncate text-xs text-[#6B675F]">{user?.email}</p>
                <div className="mt-2">
                  <span className="inline-block rounded-[6px] bg-[#E4ECE6] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#1F4D3A]">
                    {user?.role}
                  </span>
                </div>
              </div>
              <div className="my-2 border-t border-[#E2DDD3]" />
              <button
                type="button"
                onClick={handleLogout}
                className="w-full text-left text-sm text-[#A3262A] hover:bg-[#F5F2EC] px-2 py-1.5 rounded-[6px] transition-colors"
              >
                Log out
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Nav Links: scroll horizontally under bar */}
      <nav className="flex md:hidden overflow-x-auto border-t border-[#E2DDD3] px-4 py-2 gap-4">
        {activeItems.map((item) => {
          const active = isLinkActive(item.to);
          return (
            <Link
              key={item.label}
              to={item.to}
              className={`whitespace-nowrap py-1 text-sm font-medium ${active
                  ? "border-b-2 border-[#1F4D3A] text-[#1F4D3A]"
                  : "text-[#6B675F] hover:text-[#1D1C1A]"
                }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
