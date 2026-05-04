// When the frontend is served from a different origin than the API,
// set VITE_API_URL to the backend base URL (e.g. https://html-lang-tr-backend.vercel.app)
export const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

export interface Company {
  id: string;
  name: string;
}

export interface User {
  id: string;
  username: string;
  fullName: string;
  role: string;
  department: string | null;
  avatar: string | null;
  companyId: string | null;
}

export interface AuthState {
  user: User;
  company: Company | null;
}

export async function login(username: string, password: string): Promise<AuthState> {
  const response = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
    credentials: "include",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Giriş başarısız");
  }

  const data = await response.json();
  localStorage.setItem("user", JSON.stringify(data.user));
  if (data.company) {
    localStorage.setItem("company", JSON.stringify(data.company));
  }
  return { user: data.user, company: data.company };
}

export async function logout(): Promise<void> {
  await fetch(`${API_BASE}/api/auth/logout`, {
    method: "POST",
    credentials: "include",
  });
  localStorage.removeItem("user");
  localStorage.removeItem("company");
}

export function getCurrentUser(): User | null {
  const userStr = localStorage.getItem("user");
  return userStr ? JSON.parse(userStr) : null;
}

export function getCurrentCompany(): Company | null {
  const companyStr = localStorage.getItem("company");
  return companyStr ? JSON.parse(companyStr) : null;
}

export async function checkAuth(): Promise<AuthState | null> {
  try {
    const response = await fetch(`${API_BASE}/api/auth/me`, {
      credentials: "include",
    });

    if (!response.ok) {
      localStorage.removeItem("user");
      localStorage.removeItem("company");
      return null;
    }

    const data = await response.json();
    localStorage.setItem("user", JSON.stringify(data.user));
    if (data.company) {
      localStorage.setItem("company", JSON.stringify(data.company));
    }
    return { user: data.user, company: data.company };
  } catch (error) {
    localStorage.removeItem("user");
    localStorage.removeItem("company");
    return null;
  }
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/auth/change-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ currentPassword, newPassword }),
    credentials: "include",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Sifre degistirilemedi");
  }
}

export async function resetPasswordWithToken(token: string, newPassword: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, newPassword }),
    credentials: "include",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Sifre sifirlanamadi");
  }
}

export async function requestPasswordReset(username: string): Promise<{ token: string }> {
  const res = await fetch(`${API_BASE}/api/auth/request-reset`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username }),
    credentials: "include",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Sifirlama baslatilamadi");
  }
  return res.json();
}
