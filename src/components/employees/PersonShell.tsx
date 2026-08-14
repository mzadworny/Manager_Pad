import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, CalendarPlus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Employee, Meeting } from "@/types";

interface PersonShellProps {
  employeeId: string;
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatMeetingDate(value: string): string {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatMeetingStatus(status: string): string {
  return status === "completed" ? "Completed" : "Open";
}

export function PersonShell({ employeeId }: PersonShellProps) {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [meetingDate, setMeetingDate] = useState(todayDate);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const loadMeetings = useCallback(async () => {
    const response = await fetch(`/api/meetings?employeeId=${encodeURIComponent(employeeId)}`);
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(payload?.error ?? "Unable to load meetings");
    }
    const payload = (await response.json()) as { meetings: Meeting[] };
    setMeetings(payload.meetings);
  }, [employeeId]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/employees/${employeeId}`);
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error ?? "Unable to load employee");
        }
        const payload = (await response.json()) as { employee: Employee };
        if (cancelled) {
          return;
        }
        setEmployee(payload.employee);
        await loadMeetings();
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unable to load employee");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [employeeId, loadMeetings]);

  async function handleCreateMeeting() {
    if (!employee || isCreating || !meetingDate) {
      return;
    }
    setIsCreating(true);
    setError(null);
    try {
      const response = await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: employee.id,
          meetingDate,
        }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Unable to create meeting");
      }
      const payload = (await response.json()) as { meeting: Meeting };
      window.location.href = `/meetings/${payload.meeting.id}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create meeting");
      setIsCreating(false);
    }
  }

  if (isLoading) {
    return <p className="text-sm text-blue-100/70">Loading person...</p>;
  }

  if (!employee && error) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-red-400">{error}</p>
        <Button type="button" variant="secondary" asChild>
          <a href="/dashboard">
            <ArrowLeft className="size-4" />
            Back to dashboard
          </a>
        </Button>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-red-400">Employee not found</p>
        <Button type="button" variant="secondary" asChild>
          <a href="/dashboard">
            <ArrowLeft className="size-4" />
            Back to dashboard
          </a>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Button type="button" variant="ghost" className="px-0 text-blue-100/70 hover:text-white" asChild>
            <a href="/dashboard">
              <ArrowLeft className="size-4" />
              Dashboard
            </a>
          </Button>
          <div>
            <h1 className="text-3xl font-semibold text-white">{employee.name}</h1>
            <p className="text-sm text-blue-100/70">{employee.role || "No role"}</p>
          </div>
        </div>
      </div>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      <section className="space-y-4 rounded-lg border border-white/10 bg-white/5 p-4 md:p-6">
        <div className="flex items-center gap-2 text-white">
          <CalendarPlus className="size-5" />
          <h2 className="text-lg font-semibold">New meeting</h2>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex flex-1 flex-col gap-2 text-sm text-blue-100/80">
            Meeting date
            <Input
              type="date"
              value={meetingDate}
              onChange={(event) => {
                setMeetingDate(event.target.value);
              }}
              className="border-white/20 bg-white/5 text-white"
            />
          </label>
          <Button type="button" onClick={() => void handleCreateMeeting()} disabled={isCreating || !meetingDate}>
            <Plus className="size-4" />
            {isCreating ? "Creating..." : "Create meeting"}
          </Button>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-white">Meetings</h2>
        {meetings.length === 0 ? (
          <div className="rounded-lg border border-dashed border-white/20 bg-white/5 p-6 text-center">
            <p className="text-sm text-blue-100/70">No meetings yet. Create one to start notes and tasks.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {meetings.map((meeting) => (
              <li key={meeting.id}>
                <a
                  href={`/meetings/${meeting.id}`}
                  className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-4 transition-colors hover:bg-white/10"
                >
                  <div>
                    <p className="font-medium text-white">{formatMeetingDate(meeting.meetingDate)}</p>
                    <p className="text-sm text-blue-100/70">
                      {meeting.topics.trim() ? meeting.topics.trim().slice(0, 80) : "No topics yet"}
                    </p>
                  </div>
                  <span className="rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-xs font-medium text-white">
                    {formatMeetingStatus(meeting.status)}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
