import Spinner from "@/components/Spinner";
import { useAuth } from "../hooks/useAuth";
import { Navigate, Outlet, useLocation } from "react-router-dom";

export const ProtectedRoute = () => {
  const location = useLocation();
  const { isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return <Spinner />;
  }

  if (!isAuthenticated) {
    // Store current path before redirect
    sessionStorage.setItem(
      "redirectPath",
      `${location.pathname}${location.search}`
    );
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
};
