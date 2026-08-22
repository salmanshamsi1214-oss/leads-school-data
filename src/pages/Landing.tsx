import { Link } from "react-router";
import logo from "@/assets/leads-logo.svg";
import { BRAND, fullSchoolName } from "@/lib/brand";

export default function Landing() {
  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Left side — Orange hero */}
      <div className="relative w-full md:w-1/2 bg-gradient-to-br from-orange-600 via-orange-500 to-amber-500 text-white flex flex-col justify-between overflow-hidden min-h-[40vh] md:min-h-screen">
        {/* Decorative circles */}
        <div className="absolute top-0 left-0 w-64 h-64 bg-white/10 rounded-full -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-white/5 rounded-full translate-x-1/3 translate-y-1/3" />
        <div className="absolute top-1/3 right-10 w-32 h-32 bg-white/10 rounded-full" />

        {/* Header */}
        <header className="relative z-10 flex items-center gap-3 px-6 py-5 md:px-10 md:py-8">
          <img src={logo} alt={`${BRAND.schoolName} logo`} width={44} height={44} className="rounded-xl bg-white p-1" />
          <div>
            <p className="text-lg font-extrabold tracking-tight">LEADS SCHOOL SYSTEM</p>
            <p className="text-xs text-white/80 font-medium">{BRAND.campusName}</p>
          </div>
        </header>

        {/* Hero content */}
        <div className="relative z-10 flex-1 flex flex-col justify-center px-6 md:px-10 pb-8 md:pb-16">
          <p className="text-xs font-semibold tracking-widest text-white/80 uppercase mb-3">
            {BRAND.campusName} · Pakistan
          </p>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold leading-[1.1] tracking-tight mb-5">
            One campus,
            <br />
            every record,
            <br />
            one login.
          </h1>
          <p className="text-sm md:text-base text-white/85 leading-relaxed max-w-md">
            Attendance, homework, fees, exams and parent updates — all in one place, built for {BRAND.schoolName}.
          </p>
          <Link
            to="/auth"
            className="mt-8 inline-flex items-center gap-2 bg-white text-orange-600 font-bold text-sm px-6 py-3 rounded-xl w-fit hover:bg-orange-50 transition-colors"
          >
            Get Started
            <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
            </svg>
          </Link>
        </div>

        {/* Bottom accent */}
        <div className="relative z-10 px-6 md:px-10 pb-5 md:pb-8">
          <div className="flex items-center gap-4 text-xs text-white/70">
            <span className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-white/60" />
              24/7 Access
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-white/60" />
              Mobile Friendly
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-white/60" />
              Real-time Data
            </span>
          </div>
        </div>
      </div>

      {/* Right side — White panel with sign-in link */}
      <div className="w-full md:w-1/2 bg-white flex flex-col items-center justify-center px-6 py-12 md:py-0">
        <div className="max-w-sm w-full text-center">
          <div className="flex justify-center mb-5">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-orange-100 to-amber-100 flex items-center justify-center">
              <img src={logo} alt={`${BRAND.schoolName} logo`} width={56} height={56} className="rounded-xl" />
            </div>
          </div>

          <h2 className="text-xl font-bold text-gray-900">{BRAND.schoolName}</h2>
          <p className="text-xs text-gray-500 font-medium tracking-wide uppercase mt-0.5">{BRAND.campusName}</p>

          <div className="mt-8">
            <p className="text-2xl font-extrabold text-gray-900 mb-1">Welcome Back!</p>
            <p className="text-sm text-gray-500">Sign in to manage your school</p>
          </div>

          <Link
            to="/auth"
            className="mt-8 inline-flex items-center gap-2 bg-orange-600 text-white font-bold text-sm px-8 py-3.5 rounded-xl w-full justify-center hover:bg-orange-700 transition-colors shadow-lg shadow-orange-600/25"
          >
            Sign in to your portal
            <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
            </svg>
          </Link>

          <div className="mt-8 grid grid-cols-2 gap-3 text-left">
            {[
              { emoji: "🏫", label: "School Admin" },
              { emoji: "👩‍🏫", label: "Teachers" },
              { emoji: "👨‍👩‍👧", label: "Parents" },
              { emoji: "📚", label: "Students" },
            ].map((item) => (
              <div
                key={item.label}
                className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5 bg-gray-50"
              >
                <span className="text-lg">{item.emoji}</span>
                <span className="text-xs font-semibold text-gray-700">{item.label}</span>
              </div>
            ))}
          </div>

          <p className="mt-8 text-[11px] text-gray-400">
            © {new Date().getFullYear()} {fullSchoolName}. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
