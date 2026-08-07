import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen px-6 text-center">
      <h1 className="text-4xl font-bold mb-4">AI Powered Personalized Health Assistant</h1>
      <p className="text-slate-600 max-w-xl mb-8">
        Real-time vitals monitoring, ML-driven health predictions, and personalized
        recommendations — powered by IoT sensors and a modern web dashboard.
      </p>
      <div className="flex gap-4">
        <Link href="/login" className="px-6 py-3 bg-slate-900 text-white rounded-lg font-medium">
          Log In
        </Link>
        <Link href="/signup" className="px-6 py-3 border border-slate-300 rounded-lg font-medium">
          Sign Up
        </Link>
      </div>
    </main>
  );
}
