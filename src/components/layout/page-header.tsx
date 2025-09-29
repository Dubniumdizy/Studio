import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: string;
  description?: string;
  className?: string;
  actions?: React.ReactNode;
};

export function PageHeader({ title, description, className, actions }: PageHeaderProps) {
  return (
    <div className={cn("flex justify-between items-start mb-6", className)}>
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight font-headline text-foreground">
          {title}
        </h1>
        {description && <p className="text-lg text-muted-foreground">{description}</p>}
      </div>
      {actions && <div>{actions}</div>}
    </div>
  );
}
