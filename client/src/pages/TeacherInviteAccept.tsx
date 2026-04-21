import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { GraduationCap, CheckCircle2, Lock, User, Mail, Eye, EyeOff } from "lucide-react";
import { SebaSymbol } from "@/components/SebaSymbol";

export default function TeacherInviteAccept() {
  const [, navigate] = useLocation();

  // Extract token from URL: /invite/teacher/:token
  const token = window.location.pathname.split("/invite/teacher/")[1] ?? "";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [done, setDone] = useState(false);

  // Validate the invite token
  const { data: invite, isLoading, error } = trpc.tenants.validateTeacherInvite.useQuery(
    { token },
    { enabled: token.length === 64, retry: false }
  );

  const accept = trpc.tenants.acceptTeacherInvite.useMutation({
    onSuccess: () => {
      setDone(true);
      toast.success("Account created! You can now log in.");
    },
    onError: (err) => toast.error(err.message),
  });

  if (!token || token.length !== 64) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-6 h-6 text-red-500" />
          </div>
          <h1 className="text-lg font-semibold text-gray-900 mb-2">Invalid Invite Link</h1>
          <p className="text-sm text-gray-500">This invite link is malformed or incomplete. Please contact your SEBA administrator.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-sm text-gray-500">Validating invite...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-6 h-6 text-red-500" />
          </div>
          <h1 className="text-lg font-semibold text-gray-900 mb-2">Invite Unavailable</h1>
          <p className="text-sm text-gray-500">{error.message}</p>
          <p className="text-xs text-gray-400 mt-3">Please contact your SEBA administrator for a new invite link.</p>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-6 h-6 text-green-600" />
          </div>
          <h1 className="text-lg font-semibold text-gray-900 mb-2">Account Created!</h1>
          <p className="text-sm text-gray-600 mb-1">
            You are now registered as a Teacher at <strong>{invite?.tenantName}</strong>.
          </p>
          <p className="text-sm text-gray-500 mb-6">You can now log in with your email and password.</p>
          <button
            onClick={() => navigate("/login")}
            className="w-full py-2.5 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-gray-900">Teacher Invitation</h1>
            <p className="text-xs text-gray-500">
              You have been invited to join <strong>{invite?.tenantName}</strong> as a Teacher
            </p>
          </div>
        </div>

        {/* Expiry notice */}
        {invite?.expiresAt && (
          <div className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 mb-5 text-xs text-amber-700">
            This invite expires on {new Date(invite.expiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
          </div>
        )}

        {/* Form */}
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Full Name</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your full name"
                className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="email"
                value={email || invite?.email || ""}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                className="w-full pl-9 pr-10 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        <button
          disabled={!name.trim() || !email.trim() || password.length < 8 || accept.isPending}
          onClick={() => accept.mutate({ token, name: name.trim(), email: email.trim(), password })}
          className="w-full mt-6 py-2.5 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          {accept.isPending ? "Creating account..." : "Create Teacher Account"}
        </button>

        <p className="text-center text-xs text-gray-400 mt-4 flex items-center justify-center gap-1">
          <SebaSymbol className="w-3 h-3 opacity-50" />
          Powered by SEBA
        </p>
      </div>
    </div>
  );
}
