import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap text-sm font-semibold ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--workspace-primary)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
  {
    variants: {
      variant: {
        default:     "rounded-lg bg-[var(--workspace-primary)] text-[var(--workspace-on-primary)] hover:bg-[var(--workspace-primary-hover)]",
        destructive: "rounded-lg bg-red-600 text-white hover:bg-red-700",
        outline:     "rounded-lg border border-[var(--workspace-primary)] bg-white text-[var(--workspace-primary)] hover:bg-[var(--workspace-primary)] hover:text-[var(--workspace-on-primary)]",
        secondary:   "rounded-lg border border-[#dde3ec] bg-white text-[var(--workspace-primary)] hover:bg-[var(--workspace-primary-soft)]",
        ghost:       "rounded-lg text-[var(--workspace-primary)] hover:bg-[var(--workspace-primary-soft)]",
        link:        "text-[var(--workspace-primary)] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm:      "h-8 px-3 text-xs",
        lg:      "h-11 px-8 text-base",
        icon:    "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
