import { useAuth } from "../context/AuthContext";
import Navbar from "../components/Navbar";

export default function Dashboard() {
  const { user } = useAuth();

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const firstName = user?.name ? user.name.trim().split(/\s+/)[0] : "there";

  const statTiles = [
    { label: "Employees", value: "--", note: "Available after setup" },
    { label: "Active brands", value: "--", note: "Available after setup" },
    { label: "Pods", value: "--", note: "Available after setup" },
    { label: "Open conflicts", value: "--", note: "Available after setup" },
  ];

  const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

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
            Operations Dashboard • <span className="uppercase tracking-wider font-medium text-[#1F4D3A]">{user?.role}</span>
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
              <div className="mt-2 text-2xl font-semibold text-[#1D1C1A]">{tile.value}</div>
              <div className="mt-1 text-xs text-[#6B675F]">{tile.note}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* This Month Panel: 2 cols */}
          <div className="lg:col-span-2 rounded-[6px] border border-[#E2DDD3] bg-[#FFFFFF] p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-['Newsreader',Georgia,serif] text-xl font-medium text-[#1D1C1A]">
                This month
              </h2>
              <span className="text-xs text-[#6B675F]">Overview</span>
            </div>

            {/* Empty-state roster grid skeleton */}
            <div className="rounded-[6px] border border-[#E2DDD3] overflow-hidden">
              <div className="grid grid-cols-7 border-b border-[#E2DDD3] bg-[#F5F2EC]/60 text-center">
                {weekdays.map((day) => (
                  <div key={day} className="py-2 text-xs font-medium text-[#6B675F] border-r border-[#E2DDD3] last:border-r-0">
                    {day}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 bg-[#FFFFFF]">
                {Array.from({ length: 35 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-14 border-b border-r border-[#E2DDD3] p-1.5 last:border-r-0 [&:nth-child(7n)]:border-r-0 [&:nth-last-child(-n+7)]:border-b-0"
                  >
                    <span className="text-[10px] text-[#6B675F]/50">{i + 1}</span>
                  </div>
                ))}
              </div>
            </div>

            <p className="mt-4 text-center text-sm text-[#6B675F]">
              No roster generated yet.
            </p>
          </div>

          {/* Next Steps Panel: 1 col */}
          <div className="rounded-[6px] border border-[#E2DDD3] bg-[#FFFFFF] p-6 flex flex-col justify-between">
            <div>
              <h2 className="font-['Newsreader',Georgia,serif] text-xl font-medium text-[#1D1C1A] mb-4">
                Next steps
              </h2>
              <ol className="space-y-4 text-sm text-[#6B675F] list-decimal list-inside">
                <li className="leading-relaxed">
                  <span className="text-[#1D1C1A] font-medium">Add employees</span>
                  <p className="text-xs text-[#6B675F] ml-5 mt-0.5">Input staff profiles, skills and availability constraints.</p>
                </li>
                <li className="leading-relaxed">
                  <span className="text-[#1D1C1A] font-medium">Add brands and processes</span>
                  <p className="text-xs text-[#6B675F] ml-5 mt-0.5">Configure operational requirements and operating days.</p>
                </li>
                <li className="leading-relaxed">
                  <span className="text-[#1D1C1A] font-medium">Assign resources</span>
                  <p className="text-xs text-[#6B675F] ml-5 mt-0.5">Map team members to specific brands and pods.</p>
                </li>
                <li className="leading-relaxed">
                  <span className="text-[#1D1C1A] font-medium">Generate roster</span>
                  <p className="text-xs text-[#6B675F] ml-5 mt-0.5">Run automated scheduling and resolve coverage conflicts.</p>
                </li>
              </ol>
            </div>

            <div className="mt-6 border-t border-[#E2DDD3] pt-4 text-xs text-[#6B675F]">
              Configuration unlocks sequentially once organization data is saved.
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
