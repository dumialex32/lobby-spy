import Spinner from "@/components/Spinner";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export const LoginRedirectHandler = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const redirectPath = sessionStorage.getItem("redirectPath") || "/";
    sessionStorage.removeItem("redirectPath");
    navigate(redirectPath, { replace: true });
  }, [navigate]);

  return <Spinner />;
};
