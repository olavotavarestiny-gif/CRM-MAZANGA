import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const commerceButtonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap text-sm font-semibold ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
  {
    variants: {
      variant: {
        default:     "rounded-lg bg-[#B84D0E] text-white hover:bg-[#9a3d0a]",
        destructive: "rounded-lg bg-red-600 text-white hover:bg-red-700",
        outline:     "rounded-lg border border-[#B84D0E] bg-white text-[#B84D0E] hover:bg-[#B84D0E] hover:text-white",
        secondary:   "rounded-lg bg-white text-[#B84D0E] border border-[#dde3ec] hover:bg-[#FDF2EA]",
        ghost:       "rounded-lg text-[#B84D0E] hover:bg-[#FDF2EA]",
        link:        "text-[#B84D0E] underline-offset-4 hover:underline",
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

export interface CommerceButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof commerceButtonVariants> {
  asChild?: boolean
}

const CommerceButton = React.forwardRef<HTMLButtonElement, CommerceButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(commerceButtonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
CommerceButton.displayName = "CommerceButton"

export { CommerceButton, commerceButtonVariants }
