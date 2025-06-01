import type { RootState } from "@/redux/store";

export const selectUser = (state: RootState) => state.auth.user;
export const selectAuthStatus = (state: RootState) => state.auth.status;
export const selectIsAuthenticated = (state: RootState) =>
  state.auth.status === "authenticated";
export const selectAuthLoading = (state: RootState) =>
  state.auth.status === "loading";
export const selectAuthError = (state: RootState) => state.auth.error;
