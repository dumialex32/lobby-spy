import { api } from "@/lib/axios";
import type { User } from "@/types/user";

export const getSteamLoginUrl = (): string => {
  return `${import.meta.env.VITE_API_BASE_URL}/auth/steam`;
};

export const refreshToken = async (): Promise<void> => {
  await api.post("/auth/refresh");
};

export const authApi = {
  getMe: async (): Promise<User> => {
    const { data } = await api.get<{ user: User }>("/auth/me");
    return data.user;
  },
  logout: async (): Promise<void> => {
    await api.post("/auth/logout");
  },
};

export const redirectToSteamLogin = (): void => {
  window.location.href = getSteamLoginUrl();
};
