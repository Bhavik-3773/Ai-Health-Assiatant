"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import axios from "axios";
import Link from "next/link";
import {
  User as UserIcon,
  Calendar,
  Ruler,
  Weight,
  Droplet,
  FileText,
  Phone,
  ShieldAlert,
  Camera,
  Pencil,
  X,
  ArrowLeft,
} from "lucide-react";
import {
  API_URL,
  getMe,
  getMyPatientProfile,
  updateMyPatientProfile,
  updateMyName,
  uploadProfilePhoto,
  type PatientProfile,
} from "@/lib/api";

const PHONE_REGEX = /^\+?[0-9\-\s()]{7,20}$/;
const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;

function numberInRange(min: number, max: number, label: string) {
  return z
    .string()
    .optional()
    .refine((v) => !v || (!Number.isNaN(Number(v)) && Number(v) >= min && Number(v) <= max), {
      message: `${label} must be a number between ${min} and ${max}`,
    });
}

const profileSchema = z.object({
  full_name: z.string().min(1, "Full name is required").max(255, "Full name is too long"),
  date_of_birth: z
    .string()
    .optional()
    .refine((v) => !v || new Date(v) <= new Date(), { message: "Date of birth cannot be in the future" }),
  gender: z.string().optional(),
  height_cm: numberInRange(30, 300, "Height"),
  weight_kg: numberInRange(2, 500, "Weight"),
  blood_group: z.string().optional(),
  medical_history: z.string().max(4000, "Medical history is too long (max 4000 characters)").optional(),
  emergency_contact_name: z.string().max(255, "Name is too long").optional(),
  emergency_contact_phone: z
    .string()
    .optional()
    .refine((v) => !v || PHONE_REGEX.test(v), { message: "Invalid phone number format" }),
  phone_number: z
    .string()
    .optional()
    .refine((v) => !v || PHONE_REGEX.test(v), { message: "Invalid phone number format" }),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

function calculateAge(dob: string | null | undefined): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const hadBirthdayThisYear =
    today.getMonth() > birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() >= birth.getDate());
  if (!hadBirthdayThisYear) age -= 1;
  return age;
}

function buildFormValues(fullName: string, profile: PatientProfile): ProfileFormValues {
  return {
    full_name: fullName,
    date_of_birth: profile.date_of_birth ?? "",
    gender: profile.gender ?? "",
    height_cm: profile.height_cm !== null ? String(profile.height_cm) : "",
    weight_kg: profile.weight_kg !== null ? String(profile.weight_kg) : "",
    blood_group: profile.blood_group ?? "",
    medical_history: profile.medical_history ?? "",
    emergency_contact_name: profile.emergency_contact_name ?? "",
    emergency_contact_phone: profile.emergency_contact_phone ?? "",
    phone_number: profile.phone_number ?? "",
  };
}

function extractErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const detail = (err.response?.data as { detail?: string } | undefined)?.detail;
    if (detail) return detail;
  }
  return fallback;
}

export default function ProfilePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const originalValuesRef = useRef<ProfileFormValues | null>(null);

  const [email, setEmail] = useState("");
  const [patient, setPatient] = useState<PatientProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: "",
      date_of_birth: "",
      gender: "",
      height_cm: "",
      weight_kg: "",
      blood_group: "",
      medical_history: "",
      emergency_contact_name: "",
      emergency_contact_phone: "",
      phone_number: "",
    },
  });

  useEffect(() => {
    async function load() {
      try {
        const me = await getMe();
        const profile = await getMyPatientProfile();
        setEmail(me.email);
        setPatient(profile);
        const values = buildFormValues(me.full_name, profile);
        originalValuesRef.current = values;
        reset(values);
      } catch {
        router.push("/login");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [reset, router]);

  const watchedDob = watch("date_of_birth");
  const liveAge = editing ? calculateAge(watchedDob) : patient?.age ?? null;

  async function onSubmit(values: ProfileFormValues) {
    setSaving(true);
    setServerError(null);
    setSuccessMessage(null);
    try {
      if (values.full_name !== originalValuesRef.current?.full_name) {
        await updateMyName(values.full_name.trim());
      }

      const updated = await updateMyPatientProfile({
        date_of_birth: values.date_of_birth || null,
        gender: values.gender || null,
        height_cm: values.height_cm ? Number(values.height_cm) : null,
        weight_kg: values.weight_kg ? Number(values.weight_kg) : null,
        blood_group: values.blood_group || null,
        medical_history: values.medical_history || null,
        emergency_contact_name: values.emergency_contact_name || null,
        emergency_contact_phone: values.emergency_contact_phone || null,
        phone_number: values.phone_number || null,
      });

      setPatient(updated);
      const newValues = buildFormValues(values.full_name.trim(), updated);
      originalValuesRef.current = newValues;
      reset(newValues);
      setEditing(false);
      setSuccessMessage("Profile updated successfully.");
    } catch (err: unknown) {
      setServerError(extractErrorMessage(err, "Failed to update profile. Please try again."));
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    if (originalValuesRef.current) reset(originalValuesRef.current);
    setServerError(null);
    setEditing(false);
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

  if (loading) return <div className="p-10">Loading profile...</div>;

  const displayName = originalValuesRef.current?.full_name || "";
  const photoSrc = patient?.photo_url ? `${API_URL}${patient.photo_url}` : null;

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 mb-6">
        <ArrowLeft className="w-4 h-4" /> Back to Dashboard
      </Link>

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

      {/* Header card */}
      <div className="rounded-2xl overflow-hidden border bg-white mb-6">
        <div className="h-24 bg-gradient-to-r from-teal-500 to-blue-600" />
        <div className="px-6 pb-6">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between -mt-12 gap-4">
            <div className="flex items-end gap-4">
              <div className="relative">
                <div className="w-24 h-24 rounded-full ring-4 ring-white bg-slate-100 overflow-hidden flex items-center justify-center">
                  {photoSrc ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photoSrc} alt="Profile photo" className="w-full h-full object-cover" />
                  ) : (
                    <UserIcon className="w-10 h-10 text-slate-400" />
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
              <div className="pb-1">
                <h1 className="text-xl font-bold">{displayName || "Your Profile"}</h1>
                <p className="text-sm text-slate-500">{email}</p>
              </div>
            </div>

            {!editing ? (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-700"
              >
                <Pencil className="w-4 h-4" /> Edit Profile
              </button>
            ) : (
              <button
                type="button"
                onClick={handleCancel}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-300 text-sm font-medium hover:bg-slate-50"
              >
                <X className="w-4 h-4" /> Cancel
              </button>
            )}
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Personal Information */}
          <SectionCard title="Personal Information" icon={<UserIcon className="w-4 h-4" />}>
            {editing ? (
              <>
                <FormField label="Full Name" error={errors.full_name?.message}>
                  <input {...register("full_name")} className="input" />
                </FormField>
                <FormField label="Date of Birth" error={errors.date_of_birth?.message}>
                  <input type="date" {...register("date_of_birth")} className="input" />
                </FormField>
                <div className="text-sm text-slate-500 -mt-2 mb-3">
                  Age: <span className="font-medium text-slate-700">{liveAge ?? "—"}</span>
                </div>
                <FormField label="Gender" error={errors.gender?.message}>
                  <select {...register("gender")} className="input">
                    <option value="">Select gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                    <option value="Prefer not to say">Prefer not to say</option>
                  </select>
                </FormField>
                <FormField label="Phone Number" error={errors.phone_number?.message}>
                  <input {...register("phone_number")} placeholder="+91 98765 43210" className="input" />
                </FormField>
              </>
            ) : (
              <>
                <ViewField icon={<Calendar className="w-4 h-4" />} label="Age" value={liveAge !== null ? `${liveAge} years` : "Not provided"} />
                <ViewField icon={<UserIcon className="w-4 h-4" />} label="Gender" value={patient?.gender || "Not provided"} />
                <ViewField icon={<Phone className="w-4 h-4" />} label="Phone Number" value={patient?.phone_number || "Not provided"} />
              </>
            )}
          </SectionCard>

          {/* Health Information */}
          <SectionCard title="Health Information" icon={<Droplet className="w-4 h-4" />}>
            {editing ? (
              <>
                <FormField label="Height (cm)" error={errors.height_cm?.message}>
                  <input inputMode="decimal" {...register("height_cm")} className="input" />
                </FormField>
                <FormField label="Weight (kg)" error={errors.weight_kg?.message}>
                  <input inputMode="decimal" {...register("weight_kg")} className="input" />
                </FormField>
                <FormField label="Blood Group" error={errors.blood_group?.message}>
                  <select {...register("blood_group")} className="input">
                    <option value="">Select blood group</option>
                    {BLOOD_GROUPS.map((bg) => (
                      <option key={bg} value={bg}>
                        {bg}
                      </option>
                    ))}
                  </select>
                </FormField>
              </>
            ) : (
              <>
                <ViewField icon={<Ruler className="w-4 h-4" />} label="Height" value={patient?.height_cm ? `${patient.height_cm} cm` : "Not provided"} />
                <ViewField icon={<Weight className="w-4 h-4" />} label="Weight" value={patient?.weight_kg ? `${patient.weight_kg} kg` : "Not provided"} />
                <ViewField icon={<Droplet className="w-4 h-4" />} label="Blood Group" value={patient?.blood_group || "Not provided"} />
              </>
            )}
          </SectionCard>

          {/* Medical History */}
          <SectionCard title="Medical History" icon={<FileText className="w-4 h-4" />} full>
            {editing ? (
              <FormField label="Medical History" error={errors.medical_history?.message}>
                <textarea
                  {...register("medical_history")}
                  rows={4}
                  placeholder="Allergies, chronic conditions, past surgeries, current medications..."
                  className="input resize-y"
                />
              </FormField>
            ) : (
              <p className="text-sm text-slate-700 whitespace-pre-wrap">
                {patient?.medical_history || "No medical history recorded."}
              </p>
            )}
          </SectionCard>

          {/* Emergency Contact */}
          <SectionCard title="Emergency Contact" icon={<ShieldAlert className="w-4 h-4" />} full>
            {editing ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Contact Name" error={errors.emergency_contact_name?.message}>
                  <input {...register("emergency_contact_name")} className="input" />
                </FormField>
                <FormField label="Contact Phone" error={errors.emergency_contact_phone?.message}>
                  <input {...register("emergency_contact_phone")} placeholder="+91 98765 43210" className="input" />
                </FormField>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <ViewField icon={<UserIcon className="w-4 h-4" />} label="Contact Name" value={patient?.emergency_contact_name || "Not provided"} />
                <ViewField icon={<Phone className="w-4 h-4" />} label="Contact Phone" value={patient?.emergency_contact_phone || "Not provided"} />
              </div>
            )}
          </SectionCard>
        </div>

        {editing && (
          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={handleCancel}
              className="px-5 py-2.5 rounded-lg border border-slate-300 text-sm font-medium hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        )}
      </form>

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

function SectionCard({
  title,
  icon,
  full,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`bg-white rounded-xl border p-6 ${full ? "md:col-span-2" : ""}`}>
      <div className="flex items-center gap-2 mb-4 text-slate-800">
        {icon}
        <h2 className="text-base font-semibold">{title}</h2>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function FormField({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-3">
      <label className="block text-xs font-medium text-slate-500 mb-1">{label}</label>
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
        <p className="text-xs text-slate-500">{label}</p>
        <p className="font-medium text-slate-800">{value}</p>
      </div>
    </div>
  );
}