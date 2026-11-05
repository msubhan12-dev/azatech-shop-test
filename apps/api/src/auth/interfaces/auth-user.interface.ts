export interface AuthUser {
  id: bigint;
  email: string;
  name: string;
  role: string;
}

export interface JwtPayload {
  sub: string; // user id as string
  email: string;
  role: string;
  type: 'access' | 'refresh';
}
