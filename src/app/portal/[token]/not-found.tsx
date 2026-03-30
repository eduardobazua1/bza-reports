import { BzaLogo } from "@/components/bza-logo";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50">
      <div className="text-center px-6">
        <div className="flex justify-center mb-6"><BzaLogo size="lg" /></div>
        <h1 className="text-xl font-semibold text-stone-800 mb-2">Portal not found</h1>
        <p className="text-stone-400 text-sm">
          This link is invalid or has been deactivated. Please contact BZA International Services.
        </p>
      </div>
    </div>
  );
}
