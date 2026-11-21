import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { RosterMark } from "../components/Navbar";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const err = await login(email, password);
    setSubmitting(false);
    if (err) return setError(err);
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-[#F5F2EC] flex flex-col md:flex-row">
      {/* Left Column (Desktop branding) */}
      <div className="hidden md:flex md:w-5/12 bg-[#1D1C1A] text-[#F5F2EC] p-12 flex-col justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <RosterMark className="h-5 w-5 text-[#E4ECE6]" />
            <span className="font-['Newsreader',Georgia,serif] text-2xl font-medium tracking-tight text-[#F5F2EC]">
              Smart Roster
            </span>
          </div>
          <p className="mt-8 text-base text-[#E2DDD3]/80 max-w-sm leading-relaxed">
            Plan shifts. Catch coverage gaps before your clients do.
          </p>
        </div>

        {/* Decorative 7x5 roster grid */}
        <div className="my-10">
          <div className="text-xs uppercase tracking-wider text-[#6B675F] mb-3">Sample Monthly Coverage</div>
          <div className="grid grid-cols-7 gap-1.5 max-w-xs">
            {Array.from({ length: 35 }).map((_, i) => {
              const isWarn = i === 11 || i === 24;
              const isFilled = i === 2 || i === 8 || i === 15 || i === 20 || i === 29;
              return (
                <div
                  key={i}
                  className={`h-7 rounded-[4px] border ${
                    isWarn
                      ? "border-[#B45309] bg-[#B45309]/20"
                      : isFilled
                        ? "border-[#1F4D3A] bg-[#1F4D3A]"
                        : "border-[#3D3A34] bg-[#262420]/50"
                  }`}
                />
              );
            })}
          </div>
          <div className="mt-3 flex items-center gap-4 text-xs text-[#6B675F]">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-[2px] bg-[#1F4D3A]" /> Staffed
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-[2px] bg-[#B45309]" /> Coverage gap
            </span>
          </div>
        </div>

        <div className="text-xs text-[#6B675F]">
          Internal operations tool • v1.0
        </div>
      </div>

      {/* Right Column (Form) */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          {/* Mobile wordmark */}
          <div className="flex md:hidden items-center gap-2 mb-8">
            <RosterMark className="h-5 w-5 text-[#1F4D3A]" />
            <span className="font-['Newsreader',Georgia,serif] text-2xl font-medium tracking-tight text-[#1D1C1A]">
              Smart Roster
            </span>
          </div>

          <div className="bg-[#FFFFFF] border border-[#E2DDD3] rounded-[6px] p-8">
            <h1 className="font-['Newsreader',Georgia,serif] text-2xl font-medium text-[#1D1C1A]">
              Sign in
            </h1>
            <p className="mt-1 text-sm text-[#6B675F]">
              Enter your credentials to access your roster dashboard.
            </p>

            {error && (
              <div className="mt-4 rounded-[6px] border border-[#A3262A]/20 bg-[#A3262A]/5 p-3 text-sm text-[#A3262A]">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label htmlFor="email" className="block text-xs font-medium uppercase tracking-wider text-[#6B675F]">
                  Work Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1.5 block w-full rounded-[6px] border border-[#E2DDD3] bg-[#FFFFFF] px-3 py-2 text-sm text-[#1D1C1A] placeholder-[#6B675F]/50 focus:border-[#1F4D3A] focus:outline-none focus:ring-1 focus:ring-[#1F4D3A]"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-xs font-medium uppercase tracking-wider text-[#6B675F]">
                  Password
                </label>
                <div className="relative mt-1.5">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full rounded-[6px] border border-[#E2DDD3] bg-[#FFFFFF] px-3 py-2 pr-10 text-sm text-[#1D1C1A] focus:border-[#1F4D3A] focus:outline-none focus:ring-1 focus:ring-[#1F4D3A]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-[#6B675F] hover:text-[#1D1C1A]"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-[6px] bg-[#1F4D3A] px-4 py-2.5 text-sm font-medium text-[#F5F2EC] hover:bg-[#1F4D3A]/90 focus:outline-none focus:ring-1 focus:ring-[#1F4D3A] disabled:opacity-50 transition-colors"
              >
                {submitting ? "Signing in..." : "Sign in"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
