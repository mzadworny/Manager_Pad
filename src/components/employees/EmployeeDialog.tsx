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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Employee, Team } from "@/types";

/** Radix SelectItem values must be non-null strings; map to API `teamId: null`. */
const ALL_PEOPLE_VALUE = "__all_people__";

function toSelectValue(teamId: string | null): string {
  return teamId ?? ALL_PEOPLE_VALUE;
}

function fromSelectValue(value: string): string | null {
  return value === ALL_PEOPLE_VALUE ? null : value;
}

interface EmployeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Filter team UUID, or null when creating under All people. */
  teamId: string | null;
  /** Non-system filter teams for the Team select. */
  teams: Team[];
  employee?: Employee;
  onSuccess: () => Promise<void>;
}

interface EmployeeDialogFormProps {
  /** List-context team for create default; ignored when editing. */
  listTeamId: string | null;
  teams: Team[];
  employee?: Employee;
  isSubmitting: boolean;
  error: string | null;
  onCancel: () => void;
  onSubmit: (payload: { name: string; role: string; teamId: string | null }) => Promise<void>;
  onValidationError: (message: string) => void;
}

function EmployeeDialogForm({
  listTeamId,
  teams,
  employee,
  isSubmitting,
  error,
  onCancel,
  onSubmit,
  onValidationError,
}: EmployeeDialogFormProps) {
  const [selectedTeamValue, setSelectedTeamValue] = useState(() =>
    toSelectValue(employee ? employee.teamId : listTeamId),
  );

  async function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const rawName = formData.get("name");
    const rawRole = formData.get("role");
    const trimmedName = (typeof rawName === "string" ? rawName : "").trim();
    const trimmedRole = (typeof rawRole === "string" ? rawRole : "").trim();
    if (!trimmedName) {
      onValidationError("Employee name is required.");
      return;
    }
    if (!trimmedRole) {
      onValidationError("Employee role is required.");
      return;
    }

    await onSubmit({
      name: trimmedName,
      role: trimmedRole,
      teamId: fromSelectValue(selectedTeamValue),
    });
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
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
      <div className="space-y-2">
        <Label htmlFor="employee-team">Team</Label>
        <Select value={selectedTeamValue} onValueChange={setSelectedTeamValue} disabled={isSubmitting}>
          <SelectTrigger id="employee-team" className="w-full">
            <SelectValue placeholder="Select a team" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_PEOPLE_VALUE}>No assigned team</SelectItem>
            {teams.map((team) => (
              <SelectItem key={team.id} value={team.id}>
                {team.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {error ? <p className="text-sm text-red-500">{error}</p> : null}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
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
  );
}

export function EmployeeDialog({ open, onOpenChange, teamId, teams, employee, onSuccess }: EmployeeDialogProps) {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(payload: { name: string; role: string; teamId: string | null }) {
    setError(null);
    setIsSubmitting(true);

    try {
      const endpoint = employee ? `/api/employees/${employee.id}` : "/api/employees";
      const method = employee ? "PATCH" : "POST";
      const body = { name: payload.name, role: payload.role, teamId: payload.teamId };
      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const responsePayload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(responsePayload?.error ?? "Unable to save employee");
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
            {employee
              ? "Update the employee details."
              : teamId === null
                ? "Add a new employee under All people."
                : "Add a new employee to this filter team."}
          </DialogDescription>
        </DialogHeader>
        {open ? (
          <EmployeeDialogForm
            key={employee?.id ?? `create-${teamId ?? "all"}`}
            listTeamId={teamId}
            teams={teams}
            employee={employee}
            isSubmitting={isSubmitting}
            error={error}
            onCancel={() => {
              onOpenChange(false);
            }}
            onValidationError={setError}
            onSubmit={handleSubmit}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
