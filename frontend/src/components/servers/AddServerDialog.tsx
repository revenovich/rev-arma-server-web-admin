import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useCreateServer } from "@/hooks/useServers";

export function AddServerDialog() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [port, setPort] = useState(2302);
  const [password, setPassword] = useState("");

  const { mutate: createServer, isPending } = useCreateServer();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    createServer(
      { title: title.trim(), port, password: password || null },
      {
        onSuccess: () => {
          setOpen(false);
          setTitle("");
          setPort(2302);
          setPassword("");
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <Plus className="mr-1.5 h-3.5 w-3.5" />
        Add Server
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Server</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="new-server-title" className="text-xs text-muted-foreground">
              Server Name *
            </label>
            <Input
              id="new-server-title"
              aria-label="Server Name"
              placeholder="My Arma Server"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="new-server-port" className="text-xs text-muted-foreground">
              Port
            </label>
            <Input
              id="new-server-port"
              aria-label="Port"
              type="number"
              min={1}
              max={65535}
              value={port}
              onChange={(e) => setPort(Number(e.target.value) || 2302)}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="new-server-password" className="text-xs text-muted-foreground">
              Player Password
            </label>
            <Input
              id="new-server-password"
              aria-label="Player Password"
              type="password"
              placeholder="None"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancel
            </DialogClose>
            <Button type="submit" disabled={!title.trim() || isPending}>
              {isPending ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
