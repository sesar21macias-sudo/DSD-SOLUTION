"use client";

import { ButtonHTMLAttributes } from "react";
import { motion } from "motion/react";
import styles from "./Button.module.css";

type NativeButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "onDrag" | "onDragStart" | "onDragEnd" | "onAnimationStart" | "onAnimationEnd"
>;

type ButtonProps = NativeButtonProps & {
  variant?: "primary" | "secondary";
  size?: "md" | "sm";
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  const classes = [styles.btn, styles[variant], size === "sm" ? styles.sm : "", className]
    .filter(Boolean)
    .join(" ");

  return (
    <motion.button
      className={classes}
      disabled={disabled}
      whileTap={disabled ? undefined : { scale: 0.97 }}
      transition={{ type: "spring", duration: 0.25, bounce: 0 }}
      {...rest}
    >
      {children}
    </motion.button>
  );
}
