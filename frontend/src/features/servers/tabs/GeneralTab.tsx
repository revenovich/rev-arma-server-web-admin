import { useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useServer, useUpdateServer } from "@/hooks/useServers";
import { Skeleton } from "@/components/ui/skeleton";

const serverGeneralSchema = z.object({
  title: z.string().min(1, "Server name is required"),
  port: z.number().int().min(1).max(65535),
  password: z.string().nullable(),
  admin_password: z.string().nullable(),
  max_players: z.number().int().min(1, "Must have at least 1 player").max(256),
  persistent: z.boolean(),
  von: z.boolean(),
  auto_start: z.boolean(),
});

type ServerGeneralFormValues = z.infer<typeof serverGeneralSchema>;

export function GeneralTab() {
  const { id } = useParams<{ id: string }>();
  const { data: server, isLoading } = useServer(id ?? "");
  const updateServer = useUpdateServer(id ?? "");

  const form = useForm<ServerGeneralFormValues>({
    resolver: zodResolver(serverGeneralSchema),
    mode: "onTouched",
    defaultValues: {
      title: "",
      port: 2302,
      password: null,
      admin_password: null,
      max_players: 32,
      persistent: false,
      von: true,
      auto_start: false,
    },
  });

  // Reset form when server data loads
  const serverData = server;
  if (serverData && form.getValues("title") === "" && !form.formState.isDirty) {
    form.reset({
      title: serverData.title,
      port: serverData.port,
      password: serverData.password,
      admin_password: serverData.admin_password,
      max_players: serverData.max_players,
      persistent: serverData.persistent,
      von: serverData.von,
      auto_start: serverData.auto_start,
    });
  }

  async function onSubmit(values: ServerGeneralFormValues) {
    await updateServer.mutateAsync(values);
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
    );
  }

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isDirty, isSubmitting },
  } = form;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Identity */}
      <Card className="space-y-4 p-5">
        <h3 className="section-label">Identity</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="title" className="text-xs text-muted-foreground">
              Server Name *
            </label>
            <Input id="title" {...register("title")} />
            {errors.title && (
              <p className="text-xs text-danger">{errors.title.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <label htmlFor="port" className="text-xs text-muted-foreground">
              Port
            </label>
            <Input id="port" type="number" {...register("port", { valueAsNumber: true })} />
          </div>
        </div>
      </Card>

      {/* Passwords */}
      <Card className="space-y-4 p-5">
        <h3 className="section-label">Passwords</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="password" className="text-xs text-muted-foreground">
              Player Password
            </label>
            <Input id="password" type="password" {...register("password")} placeholder="None" />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="admin_password" className="text-xs text-muted-foreground">
              Admin Password
            </label>
            <Input id="admin_password" type="password" {...register("admin_password")} placeholder="None" />
          </div>
        </div>
      </Card>

      {/* Max Players & Server Options */}
      <Card className="space-y-4 p-5">
        <h3 className="section-label">Players & Options</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="max_players" className="text-xs text-muted-foreground">
              Max Players
            </label>
            <Input id="max_players" type="number" {...register("max_players", { valueAsNumber: true })} />
            {errors.max_players && (
              <p className="text-xs text-danger">{errors.max_players.message}</p>
            )}
          </div>
          <div className="flex items-center justify-between gap-3">
            <label id="persistent-label" htmlFor="persistent" className="text-sm">Persistent</label>
            <Switch
              id="persistent"
              aria-labelledby="persistent-label"
              checked={watch("persistent")}
              onCheckedChange={(checked) => setValue("persistent", checked, { shouldDirty: true })}
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <label id="von-label" htmlFor="von" className="text-sm">Voice Over Network</label>
            <Switch
              id="von"
              aria-labelledby="von-label"
              checked={watch("von")}
              onCheckedChange={(checked) => setValue("von", checked, { shouldDirty: true })}
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <label id="auto_start-label" htmlFor="auto_start" className="text-sm">Auto Start</label>
            <Switch
              id="auto_start"
              aria-labelledby="auto_start-label"
              checked={watch("auto_start")}
              onCheckedChange={(checked) => setValue("auto_start", checked, { shouldDirty: true })}
            />
          </div>
        </div>
      </Card>

      {/* Submit */}
      <div className="flex justify-end">
        <Button type="submit" disabled={!isDirty || isSubmitting}>
          {isSubmitting ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}