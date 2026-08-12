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

 export function logout() {
  localStorage.removeItem("access_token");
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

export async function getPredictions(patientId: string, limit = 20, offset = 0): Promise<Prediction[]> {
  const { data } = await api.get(`/api/predictions/${patientId}`, { params: { limit, offset } });
  return data;
}

export async function getRecommendations(
  patientId: string,
  limit = 50,
  offset = 0
): Promise<Recommendation[]> {
  const { data } = await api.get(`/api/recommendations/${patientId}`, { params: { limit, offset } });
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

// ---------- Sensor History ----------

export type SensorReading = {
  id: number;
  patient_id: string;
  heart_rate: number | null;
  spo2: number | null;
  temperature: number | null;
  steps: number | null;
  calories: number | null;
  sleep_hours: number | null;
  water_intake_ml: number | null;
  activity_state: string | null;
  recorded_at: string;
};

export type TimeRange = "24h" | "7d" | "30d";

export type SensorHistoryParams = {
  limit?: number;
  offset?: number;
  range?: TimeRange;
  date?: string; // YYYY-MM-DD
};

export type SensorHistoryPage = {
  data: SensorReading[];
  total: number;
};

/**
 * Same GET /api/sensors/{patient_id} endpoint as getSensorHistory() above,
 * with the added range/date filters and total count read back from the
 * X-Total-Count response header. Kept as a separate function rather than
 * changing getSensorHistory()'s signature/return shape, since that one is
 * already used by the dashboard and expects a plain array back.
 */
export async function getSensorHistoryPage(
  patientId: string,
  params: SensorHistoryParams = {}
): Promise<SensorHistoryPage> {
  const response = await api.get(`/api/sensors/${patientId}`, { params });
  const totalHeader = response.headers["x-total-count"];
  const total = totalHeader !== undefined ? Number(totalHeader) : response.data.length;
  return { data: response.data as SensorReading[], total };
}

// ---------- AI Prediction ----------

export type Prediction = {
  id: number;
  patient_id: string;
  label: string;
  probability: number;
  explanation: string | null;
  created_at: string;
};

// ---------- AI Recommendations ----------

export type Recommendation = {
  id: number;
  patient_id: string;
  title: string;
  body: string;
  created_at: string;
};