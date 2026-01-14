import { cn } from "@/lib/utils";
import { TextareaHTMLAttributes, forwardRef } from "react";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[100px] w-full rounded-md border border-[#dcd6f6] bg-white px-4 py-3 text-sm",
          "font-['Archivo'] text-[#1a1a2e]",
          "placeholder:text-[#6b6b7b]",
          "transition-all duration-200 resize-none",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#dcd6f6] focus-visible:border-[#c9c1ed]",
          "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-[#fbf5ea]",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };
