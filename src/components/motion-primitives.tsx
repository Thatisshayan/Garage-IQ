import { motion, useMotionValue, useTransform, animate, type MotionProps } from "framer-motion";
import { useEffect } from "react";

const EASE = [0.22, 1, 0.36, 1] as const;

export const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE } },
};

export const stagger = {
  animate: { transition: { staggerChildren: 0.05, delayChildren: 0.04 } },
};

export const itemUp = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
};

export function PageShell({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function Counter({ value, duration = 1.1 }: { value: number; duration?: number }) {
  const mv = useMotionValue(0);
  const rounded = useTransform(mv, (v) => Math.round(v).toLocaleString());
  useEffect(() => {
    const controls = animate(mv, value, { duration, ease: [0.22, 1, 0.36, 1] });
    return controls.stop;
  }, [value, duration, mv]);
  return <motion.span>{rounded}</motion.span>;
}

export type { MotionProps };
