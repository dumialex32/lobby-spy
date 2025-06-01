import { Button } from "@/components/ui/button";
import { redirectToSteamLogin } from "../api/auth";

export const SteamLoginButton = () => {
  return <Button onClick={redirectToSteamLogin}>Log in with Steam</Button>;
};
