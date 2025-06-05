export type CookieSettings = {
  isProd: boolean;
  domain: string;
};

export type CookieOptions = {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'lax' | 'strict' | 'none';
  domain: string;
  path: string;
  maxAge?: number;
};
