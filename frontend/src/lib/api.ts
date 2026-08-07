import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("access_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export type LoginPayload = { email: string; password: string };
export type SignupPayload = { email: string; password: string; full_name: string; role: string };

export async function login(payload: LoginPayload) {
  const { data } = await api.post("/api/auth/login", payload);
  localStorage.setItem("access_token", data.access_token);
  return data;
}

export async function signup(payload: SignupPayload) {
  const { data } = await api.post("/api/auth/signup", payload);
  localStorage.setItem("access_token", data.access_token);
  return data;
}

export async function getMe() {
  const { data } = await api.get("/api/auth/me");
  return data;
}

export async function getMyPatientProfile() {
  const { data } = await api.get("/api/patients/me");
  return data;
}

export async function getSensorHistory(patientId: string, limit = 50) {
  const { data } = await api.get(`/api/sensors/${patientId}`, { params: { limit } });
  return data;
}

export async function getPredictions(patientId: string, limit = 20) {
  const { data } = await api.get(`/api/predictions/${patientId}`, { params: { limit } });
  return data;
}

export async function getRecommendations(patientId: string, limit = 20) {
  const { data } = await api.get(`/api/recommendations/${patientId}`, { params: { limit } });
  return data;
}
