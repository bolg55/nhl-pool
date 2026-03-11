import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold">NHL Pool</h1>
        <p className="mt-2 text-muted-foreground">Coming soon.</p>
      </div>
    </div>
  );
}
