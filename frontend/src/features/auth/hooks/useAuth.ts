import { useMutation, useQuery } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/redux/reduxHooks";

import { setUser, clearUser, authFailed } from "../store/authSlice";
import { AUTH_QUERY_KEY } from "@/constants";
import { authApi, redirectToSteamLogin } from "../api/auth";
import type { User } from "@/types/user";
import {
  selectUser,
  selectIsAuthenticated,
  selectAuthLoading,
  selectAuthError,
} from "../store/authSelectors";

export const useAuth = () => {
  const dispatch = useAppDispatch();

  const {
    data: user,
    isPending,
    isFetching,
    error: queryError,
    refetch,
    isError,
    isSuccess,
  } = useQuery<User, AxiosError>({
    queryKey: [AUTH_QUERY_KEY],
    queryFn: authApi.getMe,
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: 1000 * 60 * 15, // 15 minutes
    retry: (failureCount, error) =>
      error.response?.status !== 401 && failureCount < 2,
    gcTime: 1000 * 60 * 30, // 30 minute cache
  });

  // Handle query state changes
  useEffect(() => {
    if (isSuccess && user) {
      dispatch(setUser(user));
    }
  }, [isSuccess, user, dispatch]);

  useEffect(() => {
    if (isError) {
      dispatch(clearUser());
      dispatch(authFailed(queryError?.message || "Authentication failed"));
    }
  }, [isError, queryError, dispatch]);

  const logoutMutation = useMutation<void, AxiosError>({
    mutationFn: authApi.logout,
    onSuccess: () => {
      dispatch(clearUser());
    },
    onError: (error: AxiosError) => {
      dispatch(authFailed(error.message));
    },
  });

  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const isLoading = useAppSelector(selectAuthLoading) || isPending;
  const error = useAppSelector(selectAuthError) || queryError?.message;

  return {
    user: useAppSelector(selectUser),
    isLoading,
    isFetching,
    isAuthenticated,
    isError: !!error,
    error,
    logoutStatus: logoutMutation.status,
    isLoggingOut: logoutMutation.isPending,
    login: redirectToSteamLogin,
    logout: logoutMutation.mutate,
    refetch,
  };
};
