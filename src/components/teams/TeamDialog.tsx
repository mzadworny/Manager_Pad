import type { SyntheticEvent } from "react";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Team } from "@/types";

interface TeamDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  team?: Team;
  onSuccess: () => Promise<void>;
}

export function TeamDialog({ open, onOpenChange, team, onSuccess }: TeamDialogProps) {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const rawName = formData.get("name");
    const trimmedName = (typeof rawName === "string" ? rawName : "").trim();
    if (!trimmedName) {
      setError("Team name is required.");
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const endpoint = team ? `/api/teams/${team.id}` : "/api/teams";
      const method = team ? "PATCH" : "POST";
      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: trimmedName }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Unable to save team");
      }

      await onSuccess();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save team");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) {
          setError(null);
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{team ? "Edit team" : "Create team"}</DialogTitle>
          <DialogDescription>
            {team ? "Update the name of your team." : "Add a new team to start organizing employees."}
          </DialogDescription>
        </DialogHeader>
        {open ? (
          <form key={team?.id ?? "create"} className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="team-name">Team name</Label>
              <Input
                id="team-name"
                name="name"
                defaultValue={team?.name ?? ""}
                placeholder="e.g. Engineering"
                disabled={isSubmitting}
                autoFocus
              />
            </div>
            {error ? <p className="text-sm text-red-500">{error}</p> : null}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  onOpenChange(false);
                }}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Saving...
                  </>
                ) : team ? (
                  "Save changes"
                ) : (
                  "Create team"
                )}
              </Button>
            </DialogFooter>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
