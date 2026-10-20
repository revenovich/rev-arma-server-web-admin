import { useRef, useState } from "react";
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
  // Empty = let the backend pick a port no other server uses
  const [port, setPort] = useState("");
  const [password, setPassword] = useState("");
  // isPending only updates on the next render, so a fast double click would
  // otherwise send two POSTs
  const submitting = useRef(false);

  const { mutate: createServer, isPending } = useCreateServer();

  const portNumber = port.trim() === "" ? undefined : Number(port);
  const portValid =
    portNumber === undefined || (Number.isInteger(portNumber) && portNumber >= 1 && portNumber <= 65531);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      // Cancel or close starts the next dialog empty
      setTitle("");
      setPort("");
      setPassword("");
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !portValid || submitting.current) return;
    submitting.current = true;
    createServer(
      {
        title: title.trim(),
        ...(portNumber === undefined ? {} : { port: portNumber }),
        password: password || null,
      },
      {
        onSuccess: () => handleOpenChange(false),
        onSettled: () => {
          submitting.current = false;
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
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
              max={65531}
              placeholder="Automatic (first free, from 2302)"
              value={port}
              onChange={(e) => setPort(e.target.value)}
              aria-invalid={!portValid}
            />
            {!portValid && (
              <p className="text-xs text-danger">Port must be a whole number from 1 to 65531</p>
            )}
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
            <Button type="submit" disabled={!title.trim() || !portValid || isPending}>
              {isPending ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
