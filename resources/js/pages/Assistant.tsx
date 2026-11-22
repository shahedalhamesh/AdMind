import { Navigate } from "react-router-dom";

// The AI chat now lives inside the Content page.
export default function Assistant() {
  return <Navigate to="/content?ai=1" replace />;
}