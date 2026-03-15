import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthSuspense } from "@/lib/auth/hooks";
import { $createPool, $listUserPools } from "@/server/functions/pool";

const poolNameValidator = z
  .string()
  .trim()
  .min(3, "Pool name must be at least 3 characters")
  .max(50, "Pool name must be at most 50 characters");

export const Route = createFileRoute("/_authenticated/_account/dashboard/")({
  component: DashboardPage,
});

function DashboardPage() {
  const { user } = useAuthSuspense();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: pools, isPending: poolsLoading } = useQuery({
    queryKey: ["pools"],
    queryFn: () => $listUserPools(),
  });

  // Auto-redirect: single pool → go straight to pool dashboard
  useEffect(() => {
    if (pools && pools.length === 1) {
      navigate({
        to: "/p/$slug/dashboard",
        params: { slug: pools[0].slug },
        replace: true,
      });
    }
  }, [pools, navigate]);

  const createPoolMutation = useMutation({
    mutationFn: (name: string) => $createPool({ data: { name } }),
    onSuccess: async (org) => {
      queryClient.invalidateQueries({ queryKey: ["pools"] });
      form.reset();
      toast.success(`Pool "${org.name}" created!`);
      // Navigate to the new pool's dashboard
      navigate({
        to: "/p/$slug/dashboard",
        params: { slug: org.slug },
      });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create pool");
    },
  });

  const form = useForm({
    defaultValues: { name: "" },
    onSubmit: async ({ value }) => {
      createPoolMutation.mutate(value.name);
    },
  });

  const hasPools = pools && pools.length > 0;

  // If single pool, we're redirecting — show nothing to avoid flash
  if (pools && pools.length === 1) {
    return null;
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-bold">{hasPools ? "Your Pools" : "Welcome to NHL Pool"}</h1>
      <p className="mt-1 text-muted-foreground">
        {hasPools
          ? `Welcome back, ${user?.name || user?.email}!`
          : "Create a pool to get started, or wait for an invite from your pool admin."}
      </p>

      <div className="mt-8">
        {poolsLoading ? (
          <p className="text-muted-foreground">Loading pools...</p>
        ) : hasPools ? (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {pools.map((pool) => (
                <Link key={pool.id} to="/p/$slug/dashboard" params={{ slug: pool.slug }}>
                  <Card className="transition-colors hover:border-foreground/20">
                    <CardHeader>
                      <CardTitle>{pool.name}</CardTitle>
                      <CardDescription>{pool.slug}</CardDescription>
                    </CardHeader>
                  </Card>
                </Link>
              ))}
            </div>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Create Another Pool</CardTitle>
              </CardHeader>
              <CardContent>
                <CreatePoolForm form={form} isPending={createPoolMutation.isPending} />
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card className="mx-auto max-w-md">
            <CardHeader className="text-center">
              <CardTitle>Create Your First Pool</CardTitle>
              <CardDescription>
                Get started by creating a hockey pool for your group.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CreatePoolForm form={form} isPending={createPoolMutation.isPending} />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function CreatePoolForm({
  form,
  isPending,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: any;
  isPending: boolean;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
      className="flex flex-col gap-3"
    >
      <form.Field
        name="name"
        validators={{
          onBlur: poolNameValidator,
        }}
      >
        {(field: {
          state: {
            value: string;
            meta: { isTouched: boolean; errors: string[] };
          };
          handleBlur: () => void;
          handleChange: (value: string) => void;
        }) => (
          <div className="space-y-1.5">
            <Label htmlFor="pool-name">Pool Name</Label>
            <Input
              id="pool-name"
              placeholder="e.g. Office Hockey Pool"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
            />
            {field.state.meta.isTouched && field.state.meta.errors.length > 0 && (
              <p className="text-sm text-destructive">
                {field.state.meta.errors
                  .map((e: string | { message: string }) => (typeof e === "string" ? e : e.message))
                  .join(", ")}
              </p>
            )}
          </div>
        )}
      </form.Field>
      <Button type="submit" disabled={isPending}>
        {isPending ? "Creating..." : "Create Pool"}
      </Button>
    </form>
  );
}
