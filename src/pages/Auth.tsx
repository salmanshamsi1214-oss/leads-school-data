import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import logo from "@/assets/leads-logo.svg";
import { BRAND } from "@/lib/brand";
import { ArrowRight, Loader2, Mail, UserX } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";

interface AuthProps {
  redirectAfterAuth?: string;
}

const ROLES = [
  { id: "super_admin", label: "Super Admin", emoji: "👑", color: "bg-orange-100 text-orange-700 border-orange-200" },
  { id: "principal", label: "Principal", emoji: "🎓", color: "bg-gray-100 text-gray-700 border-gray-200" },
  { id: "vice_principal", label: "Vice Principal", emoji: "📋", color: "bg-gray-100 text-gray-700 border-gray-200" },
  { id: "accountant", label: "Accountant", emoji: "💰", color: "bg-gray-100 text-gray-700 border-gray-200" },
  { id: "teacher", label: "Teacher", emoji: "🍎", color: "bg-gray-100 text-gray-700 border-gray-200" },
  { id: "parent", label: "Parent", emoji: "👨‍👩‍👧", color: "bg-gray-100 text-gray-700 border-gray-200" },
  { id: "student", label: "Student", emoji: "🎒", color: "bg-gray-100 text-gray-700 border-gray-200" },
  { id: "receptionist", label: "Receptionist", emoji: "📞", color: "bg-gray-100 text-gray-700 border-gray-200" },
  { id: "librarian", label: "Librarian", emoji: "📚", color: "bg-gray-100 text-gray-700 border-gray-200" },
];

function resolveRedirectAfterAuth(
  returnTo: string | null,
  fallback = "/dashboard",
) {
  if (returnTo?.startsWith("/") && !returnTo.startsWith("//")) {
    return returnTo;
  }
  return fallback;
}

function Auth({ redirectAfterAuth }: AuthProps = {}) {
  const { isLoading: authLoading, isAuthenticated, signIn } = useAuth();
  const bootstrapRole = useMutation(api.users.bootstrapRole);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = resolveRedirectAfterAuth(
    searchParams.get("returnTo"),
    redirectAfterAuth,
  );
  const [step, setStep] = useState<"signIn" | { email: string }>("signIn");
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState("super_admin");

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate(redirect);
    }
  }, [authLoading, isAuthenticated, navigate, redirect]);

  const handleEmailSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData(event.currentTarget);
      await signIn("email-otp", formData);
      setStep({ email: formData.get("email") as string });
      setIsLoading(false);
    } catch (error) {
      console.error("Email sign-in error:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Failed to send verification code. Please try again.",
      );
      setIsLoading(false);
    }
  };

  const handleOtpSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData(event.currentTarget);
      await signIn("email-otp", formData);
      navigate(redirect);
    } catch (error) {
      console.error("OTP verification error:", error);
      setError("The verification code you entered is incorrect.");
      setIsLoading(false);
      setOtp("");
    }
  };

  const handleGuestLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await signIn("anonymous");
      try {
        await bootstrapRole();
      } catch {
        // If the session wasn't ready yet, RoleGate bootstraps on first render.
      }
      navigate(redirect);
    } catch (error) {
      console.error("Guest login error:", error);
      setError(`Failed to sign in as guest: ${error instanceof Error ? error.message : "Unknown error"}`);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Left side — Orange hero (same as landing) */}
      <div className="relative w-full md:w-[45%] bg-gradient-to-br from-orange-600 via-orange-500 to-amber-500 text-white flex flex-col justify-between overflow-hidden min-h-[30vh] md:min-h-screen">
        <div className="absolute top-0 left-0 w-64 h-64 bg-white/10 rounded-full -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-white/5 rounded-full translate-x-1/3 translate-y-1/3" />

        <header className="relative z-10 flex items-center gap-3 px-6 py-5 md:px-8 md:py-8">
          <img src={logo} alt={`${BRAND.schoolName} logo`} width={44} height={44} className="rounded-xl bg-white p-1" />
          <div>
            <p className="text-lg font-extrabold tracking-tight">LEADS SCHOOL SYSTEM</p>
            <p className="text-xs text-white/80 font-medium">{BRAND.campusName}</p>
          </div>
        </header>

        <div className="relative z-10 flex-1 flex flex-col justify-center px-6 md:px-8 pb-8 md:pb-16">
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
        </div>

        <div className="relative z-10 px-6 md:px-8 pb-5 md:pb-8">
          <div className="flex items-center gap-4 text-xs text-white/70">
            <span className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-white/60" />
              24/7 Access
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-white/60" />
              Mobile Friendly
            </span>
          </div>
        </div>
      </div>

      {/* Right side — Auth form */}
      <div className="w-full md:w-[55%] bg-white flex items-center justify-center px-6 py-10 md:py-0">
        <div className="max-w-md w-full">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-orange-100 to-amber-100 flex items-center justify-center shrink-0">
              <img src={logo} alt={`${BRAND.schoolName} logo`} width={40} height={40} className="rounded-lg" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">{BRAND.schoolName}</h2>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{BRAND.campusName}</p>
            </div>
          </div>

          <h3 className="text-2xl font-extrabold text-gray-900 mb-1">Sign in to your portal</h3>
          <p className="text-sm text-gray-500 mb-6">Choose your role to continue</p>

          {step === "signIn" ? (
            <>
              {/* Role selection grid */}
              <div className="grid grid-cols-2 gap-2.5 mb-6">
                {ROLES.map((role) => (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => setSelectedRole(role.id)}
                    className={`flex items-center gap-2.5 rounded-xl border-2 px-3.5 py-3 text-left text-sm font-semibold transition-all cursor-pointer ${
                      selectedRole === role.id
                        ? "border-orange-500 bg-orange-50 text-orange-700 shadow-sm"
                        : "border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300 hover:bg-gray-100"
                    }`}
                  >
                    <span className="text-lg">{role.emoji}</span>
                    <span className="flex items-center gap-1.5">
                      <span className={`size-2 rounded-full ${selectedRole === role.id ? "bg-orange-500" : "bg-gray-300"}`} />
                      {role.label}
                    </span>
                  </button>
                ))}
              </div>

              {/* Email form */}
              <form onSubmit={handleEmailSubmit}>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">Username</label>
                    <Input
                      name="email"
                      placeholder="name@example.com"
                      type="email"
                      className="h-11"
                      disabled={isLoading}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">Password</label>
                    <Input
                      name="password"
                      placeholder="Enter your password"
                      type="password"
                      className="h-11"
                      disabled={isLoading}
                    />
                  </div>
                </div>

                {error && (
                  <p className="mt-2 text-sm text-red-500">{error}</p>
                )}

                <Button
                  type="submit"
                  className="w-full mt-5 h-11 bg-orange-600 hover:bg-orange-700 text-white font-bold"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    <>
                      Sign in
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>

                <div className="mt-4">
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-white px-2 text-gray-400">Or</span>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full mt-4"
                    onClick={handleGuestLogin}
                    disabled={isLoading}
                  >
                    <UserX className="mr-2 h-4 w-4" />
                    Continue as Guest
                  </Button>
                  <p className="mt-2 text-center text-[11px] text-gray-400">
                    Guest sign-in gives full access right away — no approval needed.
                  </p>
                </div>
              </form>
            </>
          ) : (
            <>
              {/* OTP verification step */}
              <Card className="border shadow-sm">
                <CardHeader className="text-center">
                  <CardTitle>Check your email</CardTitle>
                  <CardDescription>
                    We&apos;ve sent a code to {step.email}
                  </CardDescription>
                </CardHeader>
                <form onSubmit={handleOtpSubmit}>
                  <CardContent className="pb-4">
                    <input type="hidden" name="email" value={step.email} />
                    <input type="hidden" name="code" value={otp} />

                    <div className="flex justify-center">
                      <InputOTP
                        value={otp}
                        onChange={setOtp}
                        maxLength={6}
                        disabled={isLoading}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && otp.length === 6 && !isLoading) {
                            const form = (e.target as HTMLElement).closest("form");
                            if (form) {
                              form.requestSubmit();
                            }
                          }
                        }}
                      >
                        <InputOTPGroup>
                          {Array.from({ length: 6 }).map((_, index) => (
                            <InputOTPSlot key={index} index={index} />
                          ))}
                        </InputOTPGroup>
                      </InputOTP>
                    </div>
                    {error && (
                      <p className="mt-2 text-sm text-red-500 text-center">
                        {error}
                      </p>
                    )}
                    <p className="text-sm text-muted-foreground text-center mt-4">
                      Didn&apos;t receive a code?{" "}
                      <Button
                        variant="link"
                        className="p-0 h-auto"
                        onClick={() => setStep("signIn")}
                      >
                        Try again
                      </Button>
                    </p>
                  </CardContent>
                  <CardFooter className="flex-col gap-2">
                    <Button
                      type="submit"
                      className="w-full bg-orange-600 hover:bg-orange-700"
                      disabled={isLoading || otp.length !== 6}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Verifying...
                        </>
                      ) : (
                        <>
                          Verify code
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setStep("signIn")}
                      disabled={isLoading}
                      className="w-full"
                    >
                      Use different email
                    </Button>
                  </CardFooter>
                </form>
              </Card>
            </>
          )}

          <p className="mt-6 text-center text-[11px] text-gray-400">
            © {new Date().getFullYear()} {BRAND.schoolName} — {BRAND.campusName}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function AuthPage(props: AuthProps) {
  return (
    <Suspense>
      <Auth {...props} />
    </Suspense>
  );
}
