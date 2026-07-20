import { Card } from "@/components/ui/card";

export function PagePlaceholder({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-3xl font-bold tracking-tight text-slate-950">
        {title}
      </h1>
      <p className="mt-2 text-slate-600">{description}</p>
      <Card className="mt-8 p-8 text-center">
        <p className="font-medium text-slate-900">
          Coming in a later milestone
        </p>
        <p className="mt-2 text-sm text-slate-500">
          This page is reserved for future financial functionality.
        </p>
      </Card>
    </div>
  );
}
