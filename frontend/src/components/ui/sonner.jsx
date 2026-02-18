import { Toaster as Sonner, toast } from "sonner"

const Toaster = ({
  theme = "dark",
  ...props
}) => {
  return (
    <Sonner
      theme={theme}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-card group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          success: "group-[.toaster]:bg-primary/20 group-[.toaster]:border-primary/50",
          info: "group-[.toaster]:bg-blue-500/20 group-[.toaster]:border-blue-500/50",
        },
      }}
      {...props} />
  );
}

export { Toaster, toast }
