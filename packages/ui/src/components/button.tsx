import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/utils.js";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-full border text-sm font-semibold tracking-wide transition-all duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "border-primary/85 bg-primary text-black shadow-[0_10px_24px_rgba(255,0,0,0.14)] hover:-translate-y-0.5 hover:border-primary hover:bg-[#ff1a1a] hover:shadow-[0_16px_34px_rgba(255,0,0,0.18)]",
        outline:
          "border-white/10 bg-card/80 text-foreground shadow-[0_8px_22px_rgba(0,0,0,0.18)] hover:-translate-y-0.5 hover:border-white/18 hover:bg-white/[0.04] hover:text-white",
        ghost:
          "border-transparent bg-transparent text-muted-foreground hover:bg-white/[0.05] hover:text-white"
      },
      size: {
        default: "h-11 px-5",
        sm: "h-9 px-4 text-xs",
        lg: "h-12 px-6 text-base",
        icon: "h-11 w-11"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, size, variant, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ size, variant }), className)} {...props} />
  )
);

Button.displayName = "Button";
