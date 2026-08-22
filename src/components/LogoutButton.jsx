import { useState } from "react";
import { LogOut } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function LogoutButton({ className = "" }) {
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);
    try {
      await base44.auth.logout("/login");
    } catch (e) {
      window.location.href = "/login";
    }
  };

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className={`inline-flex items-center gap-2 text-sm font-medium transition-colors disabled:opacity-50 ${className}`}
    >
      <LogOut className="w-4 h-4" /> Esci
    </button>
  );
}