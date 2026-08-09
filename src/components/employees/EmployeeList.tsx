import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Trash2, Users } from "lucide-react";
import { DeleteDialog } from "@/components/shared/DeleteDialog";
import { EmployeeDialog } from "@/components/employees/EmployeeDialog";
import { Button } from "@/components/ui/button";
import type { Employee, Team } from "@/types";

interface EmployeeListProps {
  /** Filter team UUID, or null for All people (unfiltered list/create). */
  teamId: string | null;
  /** Selected team row id used for sidebar count updates. */
  countTeamId: string;
  /** Non-system filter teams for the employee dialog Team select. */
  teams: Team[];
  onCountChange?: (teamId: string, count: number) => void;
  /** Refresh all sidebar team counts after create/edit/delete/reassign. */
  onEmployeesMutated?: () => Promise<void>;
}

function employeesFetchUrl(teamId: string | null): string {
  return teamId === null ? "/api/employees" : `/api/employees?teamId=${encodeURIComponent(teamId)}`;
}

export function EmployeeList({ teamId, countTeamId, teams, onCountChange, onEmployeesMutated }: EmployeeListProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isEmployeeDialogOpen, setIsEmployeeDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | undefined>(undefined);

  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deletingEmployee, setDeletingEmployee] = useState<Employee | undefined>(undefined);

  const loadEmployees = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(employeesFetchUrl(teamId));
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Unable to load employees");
      }
      const payload = (await response.json()) as { employees: Employee[] };
      setEmployees(payload.employees);
      onCountChange?.(countTeamId, payload.employees.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load employees");
      onCountChange?.(countTeamId, 0);
    } finally {
      setIsLoading(false);
    }
  }, [countTeamId, onCountChange, teamId]);

  const handleMutationSuccess = useCallback(async () => {
    await loadEmployees();
    await onEmployeesMutated?.();
  }, [loadEmployees, onEmployeesMutated]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadEmployees();
  }, [loadEmployees]);

  const showFilterSubtitle = teamId === null;
  const teamNameById = useMemo(() => new Map(teams.map((team) => [team.id, team.name])), [teams]);

  function filterLabelFor(employee: Employee): string {
    if (employee.teamId === null) {
      return "No team";
    }
    return teamNameById.get(employee.teamId) ?? "No team";
  }

  const emptyState = useMemo(
    () => (
      <div className="rounded-lg border border-dashed border-white/20 bg-white/5 p-6 text-center">
        <p className="text-sm text-blue-100/70">No employees yet.</p>
        <Button
          type="button"
          className="mt-4"
          onClick={() => {
            setEditingEmployee(undefined);
            setIsEmployeeDialogOpen(true);
          }}
        >
          <Plus className="size-4" />
          Add employee
        </Button>
      </div>
    ),
    [],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-lg font-semibold text-white">
          <Users className="size-5" />
          Employees
        </h3>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setEditingEmployee(undefined);
            setIsEmployeeDialogOpen(true);
          }}
        >
          <Plus className="size-4" />
          Add employee
        </Button>
      </div>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      {isLoading ? (
        <p className="text-sm text-blue-100/70">Loading employees...</p>
      ) : employees.length === 0 ? (
        emptyState
      ) : (
        <ul className="space-y-3">
          {employees.map((employee) => (
            <li
              key={employee.id}
              className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-4"
            >
              <div>
                <p className="font-medium text-white">{employee.name}</p>
                <p className="text-sm text-blue-100/70">{employee.role}</p>
                {showFilterSubtitle ? <p className="text-xs text-blue-100/50">{filterLabelFor(employee)}</p> : null}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setEditingEmployee(employee);
                    setIsEmployeeDialogOpen(true);
                  }}
                  aria-label={`Edit ${employee.name}`}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setDeletingEmployee(employee);
                    setIsDeleteOpen(true);
                  }}
                  aria-label={`Delete ${employee.name}`}
                >
                  <Trash2 className="size-4 text-red-300" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <EmployeeDialog
        open={isEmployeeDialogOpen}
        onOpenChange={(nextOpen) => {
          setIsEmployeeDialogOpen(nextOpen);
        }}
        teamId={teamId}
        teams={teams}
        employee={editingEmployee}
        onSuccess={handleMutationSuccess}
      />
      <DeleteDialog
        open={isDeleteOpen}
        onOpenChange={(nextOpen) => {
          setIsDeleteOpen(nextOpen);
        }}
        title="Delete employee?"
        description="This will soft-delete the employee from your dashboard."
        onConfirm={async () => {
          if (!deletingEmployee) {
            return;
          }
          const response = await fetch(`/api/employees/${deletingEmployee.id}`, {
            method: "DELETE",
          });
          if (!response.ok) {
            const payload = (await response.json().catch(() => null)) as { error?: string } | null;
            throw new Error(payload?.error ?? "Unable to delete employee");
          }
          await handleMutationSuccess();
        }}
      />
    </div>
  );
}
