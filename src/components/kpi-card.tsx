"use client";

import Link from "next/link";
import { useEffect, useState, useRef } from "react";

export function KPIBig({
  label, value, unit, color, href, animatedValue,
}: {
  label: string;
  value: string;
  unit: string;
  color: "blue" | "green" | "amber" | "red";
  href?: string;
  animatedValue?: number;
}) {
  const accentColors = {
    blue: "border-l-blue-500",
    green: "border-l-emerald-500",
    amber: "border-l-amber-500",
    red: "border-l-red-500",
  };

  const valueColors = {
    blue: "text-stone-900",
    green: "text-emerald-700",
    amber: "text-stone-900",
    red: "text-red-700",
  };

  const [display, setDisplay] = useState("0");
  const ref = useRef<HTMLDivElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (!animatedValue && animatedValue !== 0) {
      setDisplay(value);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true;
          animate();
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [value, animatedValue]);

  function animate() {
    if (!animatedValue && animatedValue !== 0) { setDisplay(value); return; }
    const duration = 1200;
    const start = performance.now();
    const step = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = eased * animatedValue;

      if (value.includes("M")) {
        setDisplay(`$${new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(current / 1000000)}M`);
      } else if (value.includes("K")) {
        setDisplay(`$${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(current / 1000))}K`);
      } else {
        setDisplay(new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(current)));
      }

      if (progress < 1) requestAnimationFrame(step);
      else setDisplay(value);
    };
    requestAnimationFrame(step);
  }

  const cardClasses = `bg-white rounded-md shadow-sm border-l-[3px] ${accentColors[color]} p-4`;

  const content = (
    <div ref={ref}>
      <p className="text-xs font-medium text-stone-500 uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-semibold mt-1 ${valueColors[color]}`}>{display}</p>
      <p className="text-xs text-stone-400 mt-0.5">{unit}</p>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className={`${cardClasses} hover:shadow-md transition-shadow cursor-pointer block`}>
        {content}
      </Link>
    );
  }
  return <div className={cardClasses}>{content}</div>;
}
