"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import axios from "axios";
import Link from "next/link";
import {
  ArrowLeft,
  Moon,
  Sun,
  Globe,
  Camera,
  User as UserIcon,
  Lock,
  Bell,
  ShieldAlert,
  Phone,
  LogOut,
} from "lucide-react";
import {
  API_URL,
  getMe,
  getMyPatientProfile,
  updateMyPatientProfile,
  uploadProfilePhoto,
  changePassword,
  getMySettings,
  updateMySettings,
  logout,
  type PatientProfile,
  type UserSettingsData,
} from "@/lib/api";

const PHONE_REGEX = /^\+?[0-9\-\s()]{7,20}$/;

const LANGUAGE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "hi", label: "Hindi" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
];

const passwordSchema = z
  .object({
    current_password: z.string().min(1, "Current password is required"),
    new_password: z.string().min(8, "New password must be at least 8 characters"),
    confirm_password: z.string().min(1, "Please confirm your new password"),
  })
  .refine((data) => data.new_password === data.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
  });
type PasswordFormValues = z.infer<typeof passwordSchema>;

const emergencyContactSchema = z.object({
  emergency_contact_name: z.string().max(255, "Name is too long").optional(),
  emergency_contact_phone: z
    .string()
    .optional()
    .refine((v) => !v || PHONE_REGEX.test(v), { message: "Invalid phone number format" }),
});
type EmergencyContactFormValues = z.infer<typeof emergencyContactSchema>;

function extractErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const detail = (err.response?.data as { detail?: string } | undefined)?.detail;
    if (detail) return detail;
  }
  return fallback;
}

export default function SettingsPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [patient, setPatient] = useState<PatientProfile | null>(null);
  const [accountSettings, setAccountSettings] = useState<UserSettingsData | null>(null);

  const [darkMode, setDarkMode] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [languageSaving, setLanguageSaving] = useState(false);
  const [notifSaving, setNotifSaving] = useState<string | null>(null); // which toggle is in-flight
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [contactSaving, setContactSaving] = useState(false);
  const [contactEditing, setContactEditing] = useState(false);

  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const passwordForm = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { current_password: "", new_password: "", confirm_password: "" },
  });

  const contactForm = useForm<EmergencyContactFormValues>({
    resolver: zodResolver(emergencyContactSchema),
    defaultValues: { emergency_contact_name: "", emergency_contact_phone: "" },
  });

  useEffect(() => {
    async function load() {
      try {
        await getMe();
        const [profile, mySettings] = await Promise.all([getMyPatientProfile(), getMySettings()]);
        setPatient(profile);
        setAccountSettings(mySettings);
        contactForm.reset({
          emergency_contact_name: profile.emergency_contact_name ?? "",
          emergency_contact_phone: profile.emergency_contact_phone ?? "",
        });
        // The <html> "dark" class was already applied (or not) by the
        // inline script in layout.tsx before this component mounted —
        // read it back rather than re-deriving from localStorage here,
        // so there's a single source of truth for the current state.
        setDarkMode(document.documentElement.classList.contains("dark"));
      } catch {
        router.push("/login");
      } finally {
        setLoading(false);
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  function handleToggleDarkMode() {
    const next = !darkMode;
    setDarkMode(next);
    if (next) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }

  async function handleLanguageChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const language = e.target.value;
    setLanguageSaving(true);
    setServerError(null);
    try {
      const updated = await updateMySettings({ language });
      setAccountSettings(updated);
      setSuccessMessage("Language preference saved.");
    } catch (err: unknown) {
      setServerError(extractErrorMessage(err, "Failed to save language preference."));
    } finally {
      setLanguageSaving(false);
    }
  }

  async function handleNotifToggle(key: "notify_emergency" | "notify_reminder" | "notify_info") {
    if (!accountSettings) return;
    const next = !accountSettings[key];
    setNotifSaving(key);
    setServerError(null);
    try {
      const updated = await updateMySettings({ [key]: next });
      setAccountSettings(updated);
    } catch (err: unknown) {
      setServerError(extractErrorMessage(err, "Failed to update notification preference."));
    } finally {
      setNotifSaving(null);
    }
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setServerError("Photo must be a JPEG, PNG, or WEBP image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setServerError("Photo must be smaller than 5MB.");
      return;
    }

    setPhotoUploading(true);
    setServerError(null);
    try {
      const updated = await uploadProfilePhoto(file);
      setPatient(updated);
      setSuccessMessage("Profile photo updated.");
    } catch (err: unknown) {
      setServerError(extractErrorMessage(err, "Failed to upload photo. Please try again."));
    } finally {
      setPhotoUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function onSubmitPassword(values: PasswordFormValues) {
    setPasswordSaving(true);
    setServerError(null);
    setSuccessMessage(null);
    try {
      await changePassword(values.current_password, values.new_password);
      passwordForm.reset({ current_password: "", new_password: "", confirm_password: "" });
      setSuccessMessage("Password changed successfully.");
    } catch (err: unknown) {
      setServerError(extractErrorMessage(err, "Failed to change password. Please try again."));
    } finally {
      setPasswordSaving(false);
    }
  }

  async function onSubmitContact(values: EmergencyContactFormValues) {
    setContactSaving(true);
    setServerError(null);
    setSuccessMessage(null);
    try {
      const updated = await updateMyPatientProfile({
        emergency_contact_name: values.emergency_contact_name || null,
        emergency_contact_phone: values.emergency_contact_phone || null,
      });
      setPatient(updated);
      setContactEditing(false);
      setSuccessMessage("Emergency contact updated.");
    } catch (err: unknown) {
      setServerError(extractErrorMessage(err, "Failed to update emergency contact. Please try again."));
    } finally {
      setContactSaving(false);
    }
  }

  if (loading) return <div className="p-10">Loading settings...</div>;

  const photoSrc = patient?.photo_url ? `${API_URL}${patient.photo_url}` : null;

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 mb-6"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Dashboard
      </Link>

      <h1 className="text-3xl font-bold mb-1">Settings</h1>
      <p className="text-slate-500 dark:text-slate-400 mb-6">Manage your account, appearance, and preferences.</p>

      {serverError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {serverError}
        </div>
      )}
      {successMessage && !serverError && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {successMessage}
        </div>
      )}

      <div className="space-y-6">
        {/* Appearance */}
        <SectionCard title="Appearance" icon={darkMode ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Dark Mode</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Applies instantly and is remembered on this device.
              </p>
            </div>
            <Toggle checked={darkMode} onChange={handleToggleDarkMode} label="Dark Mode" />
          </div>
        </SectionCard>

        {/* Language */}
        <SectionCard title="Language" icon={<Globe className="w-4 h-4" />}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Preferred Language</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Saved to your account. Translated UI text is not yet available for all pages.
              </p>
            </div>
            <select
              value={accountSettings?.language ?? "en"}
              onChange={handleLanguageChange}
              disabled={languageSaving}
              className="input w-40 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
            >
              {LANGUAGE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </SectionCard>

        {/* Profile Photo */}
        <SectionCard title="Profile Photo" icon={<Camera className="w-4 h-4" />}>
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-full ring-2 ring-white dark:ring-slate-800 bg-slate-100 dark:bg-slate-800 overflow-hidden flex items-center justify-center">
                {photoSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photoSrc} alt="Profile photo" className="w-full h-full object-cover" />
                ) : (
                  <UserIcon className="w-7 h-7 text-slate-400" />
                )}
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={photoUploading}
                className="absolute bottom-0 right-0 bg-slate-900 text-white rounded-full p-1.5 hover:bg-slate-700 disabled:opacity-50"
                aria-label="Change profile photo"
              >
                <Camera className="w-3.5 h-3.5" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handlePhotoChange}
                className="hidden"
              />
            </div>
            <div>
              <p className="text-sm font-medium">{photoUploading ? "Uploading..." : "Update your photo"}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">JPEG, PNG, or WEBP. Max 5MB.</p>
            </div>
          </div>
        </SectionCard>

        {/* Password Change */}
        <SectionCard title="Password" icon={<Lock className="w-4 h-4" />}>
          <form onSubmit={passwordForm.handleSubmit(onSubmitPassword)} className="space-y-3">
            <FormField label="Current Password" error={passwordForm.formState.errors.current_password?.message}>
              <input
                type="password"
                className="input"
                {...passwordForm.register("current_password")}
              />
            </FormField>
            <FormField label="New Password" error={passwordForm.formState.errors.new_password?.message}>
              <input type="password" className="input" {...passwordForm.register("new_password")} />
            </FormField>
            <FormField label="Confirm New Password" error={passwordForm.formState.errors.confirm_password?.message}>
              <input type="password" className="input" {...passwordForm.register("confirm_password")} />
            </FormField>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={passwordSaving}
                className="px-5 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-700 disabled:opacity-50"
              >
                {passwordSaving ? "Updating..." : "Update Password"}
              </button>
            </div>
          </form>
        </SectionCard>

        {/* Notification Preferences */}
        <SectionCard title="Notification Preferences" icon={<Bell className="w-4 h-4" />}>
          <div className="space-y-4">
            <NotifRow
              label="Emergency Alerts"
              description="Abnormal heart rate, SpO2, or temperature readings."
              checked={accountSettings?.notify_emergency ?? true}
              saving={notifSaving === "notify_emergency"}
              onChange={() => handleNotifToggle("notify_emergency")}
            />
            <NotifRow
              label="Reminders"
              description="Scheduled and follow-up reminders."
              checked={accountSettings?.notify_reminder ?? true}
              saving={notifSaving === "notify_reminder"}
              onChange={() => handleNotifToggle("notify_reminder")}
            />
            <NotifRow
              label="Info Updates"
              description="General, non-urgent updates."
              checked={accountSettings?.notify_info ?? true}
              saving={notifSaving === "notify_info"}
              onChange={() => handleNotifToggle("notify_info")}
            />
          </div>
        </SectionCard>

        {/* Emergency Contact */}
        <SectionCard title="Emergency Contact" icon={<ShieldAlert className="w-4 h-4" />}>
          {!contactEditing ? (
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
                <ViewField
                  icon={<UserIcon className="w-4 h-4" />}
                  label="Contact Name"
                  value={patient?.emergency_contact_name || "Not provided"}
                />
                <ViewField
                  icon={<Phone className="w-4 h-4" />}
                  label="Contact Phone"
                  value={patient?.emergency_contact_phone || "Not provided"}
                />
              </div>
              <button
                type="button"
                onClick={() => setContactEditing(true)}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Edit
              </button>
            </div>
          ) : (
            <form onSubmit={contactForm.handleSubmit(onSubmitContact)} className="space-y-3">
              <FormField
                label="Contact Name"
                error={contactForm.formState.errors.emergency_contact_name?.message}
              >
                <input className="input" {...contactForm.register("emergency_contact_name")} />
              </FormField>
              <FormField
                label="Contact Phone"
                error={contactForm.formState.errors.emergency_contact_phone?.message}
              >
                <input className="input" {...contactForm.register("emergency_contact_phone")} />
              </FormField>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    contactForm.reset({
                      emergency_contact_name: patient?.emergency_contact_name ?? "",
                      emergency_contact_phone: patient?.emergency_contact_phone ?? "",
                    });
                    setContactEditing(false);
                  }}
                  className="px-5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={contactSaving}
                  className="px-5 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-700 disabled:opacity-50"
                >
                  {contactSaving ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          )}
        </SectionCard>

        {/* Logout */}
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={() => {
              logout();
              router.push("/login");
            }}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg border border-red-300 text-red-600 text-sm font-medium hover:bg-red-50"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </div>

      <style jsx global>{`
        .input {
          width: 100%;
          border: 1px solid rgb(203 213 225);
          border-radius: 0.5rem;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
        }
        .input:focus {
          outline: none;
          border-color: rgb(15 23 42);
        }
      `}</style>
    </main>
  );
}

function SectionCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-slate-900 dark:border-slate-800 rounded-xl border p-6">
      <div className="flex items-center gap-2 mb-4 text-slate-800 dark:text-slate-100">
        {icon}
        <h2 className="text-base font-semibold">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function FormField({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">{label}</label>
      {children}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}

function ViewField({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="text-slate-400 mt-0.5">{icon}</span>
      <div>
        <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
        <p className="font-medium text-slate-800 dark:text-slate-100">{value}</p>
      </div>
    </div>
  );
}

function NotifRow({
  label,
  description,
  checked,
  saving,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  saving: boolean;
  onChange: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>
      </div>
      <Toggle checked={checked} onChange={onChange} disabled={saving} label={label} />
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
        checked ? "bg-slate-900 dark:bg-teal-500" : "bg-slate-300 dark:bg-slate-700"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}