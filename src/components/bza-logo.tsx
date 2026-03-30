export function BzaLogo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sizes = {
    sm: "text-lg",
    md: "text-xl",
    lg: "text-3xl",
  };
  return (
    <div className="flex items-center gap-0.5">
      <span className={`text-[#0d3d3b] font-bold tracking-tight ${sizes[size]}`}>BZA</span>
      <span className={`text-[#4fd1c5] font-bold ${sizes[size]}`}>.</span>
    </div>
  );
}
