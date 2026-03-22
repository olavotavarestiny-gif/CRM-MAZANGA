import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:     "border-[#dde3ec] bg-[#f5f7fa] text-[#0A2540]",
        secondary:   "border-[#dde3ec] bg-white text-[#6b7e9a]",
        destructive: "border-red-200 bg-red-50 text-red-700",
        outline:     "border-[#0A2540] text-[#0A2540] bg-white",
        success:     "border-emerald-200 bg-emerald-50 text-emerald-700",
        solid:       "border-[#0A2540] bg-[#0A2540] text-white",
      },
    },
    defaultVariants: { variant: "default" },
  }
)

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
