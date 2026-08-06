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
import type { Employee } from "@/types";

interface EmployeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: string;
  employee?: Employee;
  onSuccess: () => Promise<void>;
}

export function EmployeeDialog({ open, onOpenChange, teamId, employee, onSuccess }: EmployeeDialogProps) {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const rawName = formData.get("name");
    const rawRole = formData.get("role");
    const trimmedName = (typeof rawName === "string" ? rawName : "").trim();
    const trimmedRole = (typeof rawRole === "string" ? rawRole : "").trim();
    if (!trimmedName) {
      setError("Employee name is required.");
      return;
    }
    if (!trimmedRole) {
      setError("Employee role is required.");
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const endpoint = employee ? `/api/employees/${employee.id}` : "/api/employees";
      const method = employee ? "PATCH" : "POST";
      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: trimmedName, role: trimmedRole, teamId }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Unable to save employee");
      }

      await onSuccess();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save employee");
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
          <DialogTitle>{employee ? "Edit employee" : "Add employee"}</DialogTitle>
          <DialogDescription>
            {employee ? "Update the employee details." : "Add a new employee to this team."}
          </DialogDescription>
        </DialogHeader>
        {open ? (
          <form key={employee?.id ?? "create"} className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="employee-name">Name</Label>
              <Input
                id="employee-name"
                name="name"
                defaultValue={employee?.name ?? ""}
                placeholder="e.g. Alex Johnson"
                disabled={isSubmitting}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="employee-role">Role</Label>
              <Input
                id="employee-role"
                name="role"
                defaultValue={employee?.role ?? ""}
                placeholder="e.g. Product Manager"
                disabled={isSubmitting}
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
                ) : employee ? (
                  "Save changes"
                ) : (
                  "Add employee"
                )}
              </Button>
            </DialogFooter>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
