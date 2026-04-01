import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/utils.js";

/* Windows 2000-style button */
const buttonVariants = cva(
  [
    "inline-flex items-center justify-center",
    "font-[Tahoma,_'MS_Sans_Serif',_Arial,_sans-serif] text-[11px] font-normal",
    "cursor-pointer select-none",
    "transition-none",
    "focus-visible:outline focus-visible:outline-1 focus-visible:outline-dotted focus-visible:outline-black focus-visible:outline-offset-[-3px]",
    "disabled:pointer-events-none disabled:opacity-50",
    "active:[border-top:2px_solid_#404040] active:[border-left:2px_solid_#404040] active:[border-right:2px_solid_#ffffff] active:[border-bottom:2px_solid_#ffffff]"
  ].join(" "),
  {
    variants: {
      variant: {
        default: [
          "bg-[#d4d0c8] text-black",
          "[border-top:2px_solid_#ffffff] [border-left:2px_solid_#ffffff] [border-right:2px_solid_#404040] [border-bottom:2px_solid_#404040]",
          "[outline:1px_solid_#808080]",
          "hover:bg-[#e0ddd5]"
        ].join(" "),
        outline: [
          "bg-[#d4d0c8] text-black",
          "[border-top:2px_solid_#ffffff] [border-left:2px_solid_#ffffff] [border-right:2px_solid_#404040] [border-bottom:2px_solid_#404040]",
          "[outline:1px_solid_#808080]",
          "hover:bg-[#e0ddd5]"
        ].join(" "),
        ghost: [
          "bg-transparent text-black border-transparent",
          "hover:bg-[#d4d0c8]",
          "[border:2px_solid_transparent]"
        ].join(" ")
      },
      size: {
        default: "h-[23px] px-3 min-w-[75px]",
        sm: "h-[21px] px-2 min-w-[60px] text-[11px]",
        lg: "h-[27px] px-4 min-w-[90px]",
        icon: "h-[23px] w-[23px] p-0 min-w-0"
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
