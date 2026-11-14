import { useAuth } from "../components/AuthContext";
import { can } from "../services/auth";
import OwnerHome from "./OwnerHome";
import ManagerHome from "./ManagerHome";
import EmployeeHome from "./EmployeeHome";

// /dashboard shows the home that fits what the person can do:
//   adds people (users.create)           -> the owner's home
//   manages approvals (approvals.manage) -> the manager's home
//   everyone else                        -> the employee's home
export default function Home() {
  const { user } = useAuth();
  if (can(user, "users.create")) return <OwnerHome />;
  if (can(user, "approvals.manage")) return <ManagerHome />;
  return <EmployeeHome />;
}