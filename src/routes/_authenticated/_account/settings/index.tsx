import { UpdateAvatarCard, UpdateNameCard } from "@daveyplate/better-auth-ui";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod/v4";

import { useAuthSuspense } from "@/lib/auth/hooks";

const searchSchema = z.object({
  setup: z.boolean().optional(),
});

export const Route = createFileRoute("/_authenticated/_account/settings/")({
  validateSearch: searchSchema,
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = useAuthSuspense();
  const { setup } = Route.useSearch();

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-3xl font-bold">Profile Settings</h1>

      {setup && !user?.name && (
        <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4 text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200">
          Welcome! Set your name and avatar to get started.
        </div>
      )}

      <div className="mt-6 space-y-6">
        <UpdateNameCard />
        <UpdateAvatarCard />
      </div>
    </div>
  );
}
