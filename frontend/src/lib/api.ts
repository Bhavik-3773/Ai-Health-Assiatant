import axios from "axios";

export const API_URL = 
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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

export async function updateMyName(full_name: string) {
  const { data } = await api.put("/api/auth/me", { full_name });
  return data;
}

export async function changePassword(current_password: string, new_password: string): Promise<void> {
  await api.post("/api/auth/change-password", { current_password, new_password });
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
  // NEW (Doctor Dashboard). Only populated by the doctor/admin-facing
  // endpoints (getDoctorPatients with includeStatus, getPatientById) —
  // undefined/null for the patient's own /me profile, mirroring the
  // backend's PatientOut extension.
  full_name?: string | null;
  latest_heart_rate?: number | null;
  latest_spo2?: number | null;
  latest_temperature?: number | null;
  latest_activity_state?: string | null;
  latest_reading_at?: string | null;
  latest_prediction_label?: string | null;
  latest_prediction_probability?: number | null;
  unread_alert_count?: number;
};

export type PatientProfileUpdate = Partial<
  Omit<
    PatientProfile,
    | "id"
    | "user_id"
    | "age"
    | "photo_url"
    | "full_name"
    | "latest_heart_rate"
    | "latest_spo2"
    | "latest_temperature"
    | "latest_activity_state"
    | "latest_reading_at"
    | "latest_prediction_label"
    | "latest_prediction_probability"
    | "unread_alert_count"
  >
>;

export async function updateMyPatientProfile(payload: PatientProfileUpdate): Promise<PatientProfile> {
  const { data } = await api.put("/api/patients/me", payload);
  return data;
}

export async function uploadMyPatientPhoto(file: File): Promise<PatientProfile> {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await api.post("/api/patients/me/photo", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function uploadProfilePhoto(file: File): Promise<PatientProfile> {
  return uploadMyPatientPhoto(file);
}

export type TimeRange = "24h" | "7d" | "30d";
export async function getSensorHistoryPage(
  patientId: string,
  params: { limit?: number; offset?: number; range?: TimeRange; date?: string }
) {
  const response = await api.get(`/api/sensors/${patientId}`, { params });
  const total = Number(response.headers["x-total-count"] ?? response.data.length);
  return { data: response.data as SensorReading[], total };
}

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

// ---------- Notifications ----------

export type NotificationType = "emergency" | "info" | "reminder";

export type NotificationItem = {
  id: number;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
};

export async function getNotifications(
  unreadOnly = false,
  patientId?: string
): Promise<NotificationItem[]> {
  const { data } = await api.get("/api/notifications", {
    params: { unread_only: unreadOnly, patient_id: patientId },
  });
  return data;
}

export async function markNotificationRead(notificationId: number): Promise<void> {
  await api.post(`/api/notifications/${notificationId}/read`);
}

export async function deleteNotification(notificationId: number): Promise<void> {
  await api.delete(`/api/notifications/${notificationId}`);
}

// ---------- Account Settings ----------
// NEW. Consumes GET/PUT /api/settings/me (routers/settings.py). Dark Mode
// is intentionally NOT here — it's applied directly via localStorage +
// the <html> class in layout.tsx / settings/page.tsx, no API round-trip.

export type UserSettingsData = {
  user_id: string;
  language: string;
  notify_emergency: boolean;
  notify_reminder: boolean;
  notify_info: boolean;
  updated_at: string;
};

export type UserSettingsUpdate = Partial<
  Omit<UserSettingsData, "user_id" | "updated_at">
>;

export async function getMySettings(): Promise<UserSettingsData> {
  const { data } = await api.get("/api/settings/me");
  return data;
}

export async function updateMySettings(payload: UserSettingsUpdate): Promise<UserSettingsData> {
  const { data } = await api.put("/api/settings/me", payload);
  return data;
}

// ---------- Doctor Dashboard ----------
// NEW. Consumes the doctor/admin-facing endpoints in routers/patients.py
// (existing GET /api/patients, GET /api/patients/{id}, extended; plus the
// new GET /api/patients/overview). getMyPatientProfile/getSensorHistory/
// getPredictions/getRecommendations/getNotifications above are all reused
// as-is by the doctor patient-detail page — no duplicate versions of those.

export async function getDoctorPatients(params?: {
  search?: string;
  limit?: number;
  offset?: number;
  includeStatus?: boolean;
}): Promise<PatientProfile[]> {
  const { data } = await api.get("/api/patients", {
    params: {
      search: params?.search,
      limit: params?.limit,
      offset: params?.offset,
      include_status: params?.includeStatus ?? true,
    },
  });
  return data;
}

export async function getPatientById(patientId: string): Promise<PatientProfile> {
  const { data } = await api.get(`/api/patients/${patientId}`);
  return data;
}

export type PatientBrief = {
  id: string;
  full_name: string;
  device_id: string | null;
};

export type AlertActivity = {
  id: number;
  patient: PatientBrief;
  type: NotificationType;
  title: string;
  message: string;
  created_at: string;
};

export type PredictionActivity = {
  id: number;
  patient: PatientBrief;
  label: string;
  probability: number;
  created_at: string;
};

export type SensorActivity = {
  id: number;
  patient: PatientBrief;
  heart_rate: number | null;
  spo2: number | null;
  temperature: number | null;
  activity_state: string | null;
  recorded_at: string;
};

export type DoctorOverview = {
  total_patients: number;
  attention_count: number;
  recent_alerts: AlertActivity[];
  recent_predictions: PredictionActivity[];
  recent_activity: SensorActivity[];
};

export async function getPatientsOverview(): Promise<DoctorOverview> {
  const { data } = await api.get("/api/patients/overview");
  return data;
}