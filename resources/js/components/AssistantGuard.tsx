import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { canUseAssistant } from "../services/auth";

export default function AssistantGuard({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  return canUseAssistant(user) ? <>{children}</> : <Navigate to="/dashboard" replace />;
}