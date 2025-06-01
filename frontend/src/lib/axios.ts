import axios from "axios";
import { clearUser } from "@/features/auth/store/authSlice";
import { refreshToken } from "@/features/auth/api/auth";
import { store } from "@/redux/store";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
  xsrfCookieName: "XSRF-TOKEN",
  xsrfHeaderName: "X-XSRF-TOKEN",
});

api.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        await refreshToken();
        return api(originalRequest);
      } catch (refreshError) {
        store.dispatch(clearUser());
        if (!window.location.pathname.includes("login")) {
          localStorage.setItem("postLoginRedirect", window.location.pathname);
          window.location.href = "/login";
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);
