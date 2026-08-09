import axios from "axios";

export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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
  return data as PatientProfile;
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

// ---------- Patient Profile ----------

export type PatientProfile = {
  id: string;
  user_id: string;
  date_of_birth: string | null;
  age: number | null;
  gender: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  device_id: string | null;
  phone_number: string | null;
  blood_group: string | null;
  medical_history: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  photo_url: string | null;
};

export type PatientProfileUpdate = Partial<
  Pick<
    PatientProfile,
    | "date_of_birth"
    | "gender"
    | "height_cm"
    | "weight_kg"
    | "phone_number"
    | "blood_group"
    | "medical_history"
    | "emergency_contact_name"
    | "emergency_contact_phone"
  >
>;

export async function updateMyPatientProfile(payload: PatientProfileUpdate) {
  const { data } = await api.put("/api/patients/me", payload);
  return data as PatientProfile;
}

export async function updateMyName(full_name: string) {
  const { data } = await api.put("/api/auth/me", { full_name });
  return data;
}

export async function uploadProfilePhoto(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await api.post("/api/patients/me/photo", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data as PatientProfile;
}