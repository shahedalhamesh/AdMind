import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { canUseInsights } from "../services/auth";

export default function InsightsGuard({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  return canUseInsights(user) ? <>{children}</> : <Navigate to="/dashboard" replace />;
}