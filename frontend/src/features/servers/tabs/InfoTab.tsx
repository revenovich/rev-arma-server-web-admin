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

const serverInfoSchema = z.object({
  title: z.string().min(1, "Server name is required"),
  port: z.coerce.number().int().min(1).max(65535),
  password: z.string().nullable(),
  admin_password: z.string().nullable(),
  max_players: z.coerce.number().int().min(1, "Must have at least 1 player").max(256),
  motd: z.string().nullable(),
  persistent: z.boolean(),
  von: z.boolean(),
  auto_start: z.boolean(),
  battle_eye: z.boolean(),
  verify_signatures: z.coerce.number().int().min(0).max(2),
  file_patching: z.boolean(),
});

type ServerInfoFormValues = z.infer<typeof serverInfoSchema>;

export function InfoTab() {
  const { id } = useParams<{ id: string }>();
  const { data: server, isLoading } = useServer(id ?? "");
  const updateServer = useUpdateServer(id ?? "");

  const form = useForm<ServerInfoFormValues>({
    resolver: zodResolver(serverInfoSchema),
    mode: "onTouched",
    defaultValues: {
      title: "",
      port: 2302,
      password: null,
      admin_password: null,
      max_players: 32,
      motd: null,
      persistent: false,
      von: true,
      auto_start: false,
      battle_eye: true,
      verify_signatures: 2,
      file_patching: false,
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
      motd: serverData.motd,
      persistent: serverData.persistent,
      von: serverData.von,
      auto_start: serverData.auto_start,
      battle_eye: serverData.battle_eye,
      verify_signatures: serverData.verify_signatures,
      file_patching: serverData.file_patching,
    });
  }

  async function onSubmit(values: ServerInfoFormValues) {
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
        <h3 className="text-sm font-medium text-foreground">Identity</h3>
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
            <Input id="port" type="number" {...register("port")} />
          </div>
        </div>
      </Card>

      {/* Passwords */}
      <Card className="space-y-4 p-5">
        <h3 className="text-sm font-medium text-foreground">Passwords</h3>
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

      {/* Max Players & MOTD */}
      <Card className="space-y-4 p-5">
        <h3 className="text-sm font-medium text-foreground">Players & Messages</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="max_players" className="text-xs text-muted-foreground">
              Max Players
            </label>
            <Input id="max_players" type="number" {...register("max_players")} />
            {errors.max_players && (
              <p className="text-xs text-danger">{errors.max_players.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <label htmlFor="motd" className="text-xs text-muted-foreground">
              Message of the Day
            </label>
            <Input id="motd" {...register("motd")} placeholder="None" />
          </div>
        </div>
      </Card>

      {/* Toggles */}
      <Card className="space-y-4 p-5">
        <h3 className="text-sm font-medium text-foreground">Server Options</h3>
        <div className="grid gap-4 sm:grid-cols-2">
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
          <div className="flex items-center justify-between gap-3">
            <label id="battle_eye-label" htmlFor="battle_eye" className="text-sm">BattlEye</label>
            <Switch
              id="battle_eye"
              aria-labelledby="battle_eye-label"
              checked={watch("battle_eye")}
              onCheckedChange={(checked) => setValue("battle_eye", checked, { shouldDirty: true })}
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <label id="file_patching-label" htmlFor="file_patching" className="text-sm">File Patching</label>
            <Switch
              id="file_patching"
              aria-labelledby="file_patching-label"
              checked={watch("file_patching")}
              onCheckedChange={(checked) => setValue("file_patching", checked, { shouldDirty: true })}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="verify_signatures" className="text-xs text-muted-foreground">
              Verify Signatures (0-2)
            </label>
            <Input id="verify_signatures" type="number" {...register("verify_signatures")} />
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