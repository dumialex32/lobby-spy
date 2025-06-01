import type { User } from "@/types/user";
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

type AuthStatus = "idle" | "loading" | "authenticated" | "unauthenticated";

interface AuthState {
  user: User | null;
  status: AuthStatus;
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  status: "idle",
  error: null,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    authRequested: (state) => {
      state.status = "loading";
      state.error = null;
    },
    setUser: (state, action: PayloadAction<User>) => {
      state.user = action.payload;
      state.status = "authenticated";
    },
    clearUser: (state) => {
      state.user = null;
      state.status = "unauthenticated";
    },
    authFailed: (state, action: PayloadAction<string>) => {
      state.error = action.payload;
      state.status = "unauthenticated";
    },
  },
});

export const { authRequested, setUser, clearUser, authFailed } =
  authSlice.actions;
export default authSlice.reducer;
