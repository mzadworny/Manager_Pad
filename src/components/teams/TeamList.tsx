import { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, Pencil, Plus, Trash2 } from "lucide-react";
import { EmployeeList } from "@/components/employees/EmployeeList";
import { DeleteDialog } from "@/components/shared/DeleteDialog";
import { TeamDialog } from "@/components/teams/TeamDialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Team } from "@/types";

type EmployeeCountByTeamId = Record<string, number>;

function employeesUrlForTeam(team: Team): string {
  return team.isSystem ? "/api/employees" : `/api/employees?teamId=${encodeURIComponent(team.id)}`;
}

export function TeamList() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [employeeCounts, setEmployeeCounts] = useState<EmployeeCountByTeamId>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isTeamDialogOpen, setIsTeamDialogOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | undefined>(undefined);

  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deletingTeam, setDeletingTeam] = useState<Team | undefined>(undefined);

  const handleEmployeeCountChange = useCallback((teamId: string, count: number) => {
    setEmployeeCounts((current) => {
      if (current[teamId] === count) {
        return current;
      }
      return { ...current, [teamId]: count };
    });
  }, []);

  const loadEmployeeCount = useCallback(async (team: Team): Promise<number> => {
    const response = await fetch(employeesUrlForTeam(team));
    if (!response.ok) {
      return 0;
    }
    const payload = (await response.json()) as { employees: unknown[] };
    return payload.employees.length;
  }, []);

  /** Re-fetch sidebar counts for every team after create/edit/delete/reassign. */
  const refreshEmployeeCounts = useCallback(
    async (teamList: Team[]) => {
      const countEntries = await Promise.all(
        teamList.map(async (team) => [team.id, await loadEmployeeCount(team)] as const),
      );
      setEmployeeCounts(Object.fromEntries(countEntries));
    },
    [loadEmployeeCount],
  );

  const handleEmployeesMutated = useCallback(async () => {
    await refreshEmployeeCounts(teams);
  }, [refreshEmployeeCounts, teams]);

  const loadTeams = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/teams");
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Unable to load teams");
      }

      const payload = (await response.json()) as { teams: Team[] };
      const nextTeams = payload.teams;
      setTeams(nextTeams);

      if (nextTeams.length === 0) {
        setSelectedTeamId(null);
        setEmployeeCounts({});
        return;
      }

      setSelectedTeamId((current) => {
        if (current && nextTeams.some((team) => team.id === current)) {
          return current;
        }
        const systemTeam = nextTeams.find((team) => team.isSystem);
        return systemTeam?.id ?? nextTeams[0].id;
      });

      await refreshEmployeeCounts(nextTeams);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load teams");
      setTeams([]);
      setSelectedTeamId(null);
      setEmployeeCounts({});
    } finally {
      setIsLoading(false);
    }
  }, [refreshEmployeeCounts]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadTeams();
  }, [loadTeams]);

  const selectedTeam = useMemo(() => teams.find((team) => team.id === selectedTeamId) ?? null, [selectedTeamId, teams]);
  const filterTeams = useMemo(() => teams.filter((team) => !team.isSystem), [teams]);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 rounded-2xl border border-white/10 bg-white/10 p-6 text-white backdrop-blur-xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="bg-gradient-to-r from-blue-200 to-purple-200 bg-clip-text text-3xl font-bold text-transparent">
            Team Dashboard
          </h1>
          <p className="mt-1 text-sm text-blue-100/70">Manage your teams and employees in one place.</p>
        </div>
        <Button
          type="button"
          onClick={() => {
            setEditingTeam(undefined);
            setIsTeamDialogOpen(true);
          }}
        >
          <Plus className="size-4" />
          Create team
        </Button>
      </div>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      {isLoading ? (
        <p className="text-sm text-blue-100/70">Loading teams...</p>
      ) : teams.length === 0 ? (
        <div className="rounded-lg border border-dashed border-white/20 bg-white/5 p-10 text-center">
          <Building2 className="mx-auto size-10 text-blue-100/60" />
          <h2 className="mt-4 text-xl font-semibold">Unable to load teams</h2>
          <p className="mt-2 text-sm text-blue-100/70">Refresh the page, or try again in a moment.</p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <div className="space-y-3">
            {teams.map((team) => {
              const isActive = selectedTeamId === team.id;
              return (
                <button
                  key={team.id}
                  type="button"
                  onClick={() => {
                    setSelectedTeamId(team.id);
                  }}
                  className={cn(
                    "w-full rounded-lg border p-4 text-left transition",
                    isActive ? "border-purple-300 bg-purple-500/20" : "border-white/10 bg-white/5 hover:bg-white/10",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{team.name}</p>
                      <p className="mt-1 text-xs text-blue-100/70">
                        {employeeCounts[team.id] ?? 0} {(employeeCounts[team.id] ?? 0) === 1 ? "employee" : "employees"}
                      </p>
                    </div>
                    {team.isSystem ? null : (
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={(event) => {
                            event.stopPropagation();
                            setEditingTeam(team);
                            setIsTeamDialogOpen(true);
                          }}
                          aria-label={`Edit ${team.name}`}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={(event) => {
                            event.stopPropagation();
                            setDeletingTeam(team);
                            setIsDeleteOpen(true);
                          }}
                          aria-label={`Delete ${team.name}`}
                        >
                          <Trash2 className="size-4 text-red-300" />
                        </Button>
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="rounded-lg border border-white/10 bg-white/5 p-4">
            {selectedTeam ? (
              <>
                <div className="mb-4">
                  <h2 className="text-xl font-semibold">{selectedTeam.name}</h2>
                  <p className="text-sm text-blue-100/70">
                    {selectedTeam.isSystem
                      ? "Everyone you manage, with or without a filter team."
                      : "Manage employees in this filter team."}
                  </p>
                </div>
                <EmployeeList
                  teamId={selectedTeam.isSystem ? null : selectedTeam.id}
                  countTeamId={selectedTeam.id}
                  teams={filterTeams}
                  onCountChange={handleEmployeeCountChange}
                  onEmployeesMutated={handleEmployeesMutated}
                />
              </>
            ) : (
              <p className="text-sm text-blue-100/70">Select a team to view employees.</p>
            )}
          </div>
        </div>
      )}

      <TeamDialog
        open={isTeamDialogOpen}
        onOpenChange={(nextOpen) => {
          setIsTeamDialogOpen(nextOpen);
        }}
        team={editingTeam}
        onSuccess={loadTeams}
      />
      <DeleteDialog
        open={isDeleteOpen}
        onOpenChange={(nextOpen) => {
          setIsDeleteOpen(nextOpen);
        }}
        title="Delete team?"
        description="This removes the filter team. People stay listed under All people."
        onConfirm={async () => {
          if (!deletingTeam) {
            return;
          }
          const response = await fetch(`/api/teams/${deletingTeam.id}`, {
            method: "DELETE",
          });
          if (!response.ok) {
            const payload = (await response.json().catch(() => null)) as { error?: string } | null;
            throw new Error(payload?.error ?? "Unable to delete team");
          }
          await loadTeams();
        }}
      />
    </div>
  );
}
