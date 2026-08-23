import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Plus } from "lucide-react";
import { MeetingReadPane } from "@/components/employees/MeetingReadPane";
import { TasksPanel } from "@/components/meetings/TasksPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatMeetingDate } from "@/lib/utils";
import type { Employee, Meeting, Task } from "@/types";

interface PersonShellProps {
  employeeId: string;
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatMeetingStatus(status: Meeting["status"]): string {
  return status === "completed" ? "Completed" : "Open";
}

function replaceMeetingQuery(meetingId: string | null): void {
  const url = new URL(window.location.href);
  if (meetingId) {
    url.searchParams.set("meeting", meetingId);
  } else {
    url.searchParams.delete("meeting");
  }
  history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}

function resolveSelectedMeetingId(meetings: Meeting[]): string | null {
  if (meetings.length === 0) {
    return null;
  }
  const param = new URLSearchParams(window.location.search).get("meeting");
  if (param && meetings.some((meeting) => meeting.id === param)) {
    return param;
  }
  return meetings[0]?.id ?? null;
}

export function PersonShell({ employeeId }: PersonShellProps) {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);
  const [meetingDate, setMeetingDate] = useState(todayDate);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const loadPerson = useCallback(async () => {
    const [employeeResponse, meetingsResponse, tasksResponse] = await Promise.all([
      fetch(`/api/employees/${employeeId}`),
      fetch(`/api/meetings?employeeId=${encodeURIComponent(employeeId)}`),
      fetch(`/api/tasks?employeeId=${encodeURIComponent(employeeId)}`),
    ]);

    if (!employeeResponse.ok) {
      const payload = (await employeeResponse.json().catch(() => null)) as { error?: string } | null;
      throw new Error(payload?.error ?? "Unable to load employee");
    }
    if (!meetingsResponse.ok) {
      const payload = (await meetingsResponse.json().catch(() => null)) as { error?: string } | null;
      throw new Error(payload?.error ?? "Unable to load meetings");
    }
    if (!tasksResponse.ok) {
      const payload = (await tasksResponse.json().catch(() => null)) as { error?: string } | null;
      throw new Error(payload?.error ?? "Unable to load tasks");
    }

    const employeePayload = (await employeeResponse.json()) as { employee: Employee };
    const meetingsPayload = (await meetingsResponse.json()) as { meetings: Meeting[] };
    const tasksPayload = (await tasksResponse.json()) as { tasks: Task[] };
    const nextMeetings = meetingsPayload.meetings;

    return {
      employee: employeePayload.employee,
      meetings: nextMeetings,
      selectedMeetingId: resolveSelectedMeetingId(nextMeetings),
      tasks: tasksPayload.tasks,
    };
  }, [employeeId]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const loaded = await loadPerson();
        if (cancelled) {
          return;
        }
        setEmployee(loaded.employee);
        setMeetings(loaded.meetings);
        setSelectedMeetingId(loaded.selectedMeetingId);
        setTasks(loaded.tasks);
        replaceMeetingQuery(loaded.selectedMeetingId);
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
  }, [loadPerson]);

  function handleSelectMeeting(meetingId: string) {
    setSelectedMeetingId(meetingId);
    replaceMeetingQuery(meetingId);
  }

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

  const selectedMeeting = meetings.find((meeting) => meeting.id === selectedMeetingId) ?? null;

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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex flex-col gap-2 text-sm text-blue-100/80">
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
            {isCreating ? "Creating..." : "New meeting"}
          </Button>
        </div>
      </div>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,16rem)_minmax(0,1fr)_minmax(0,20rem)]">
        <section className="space-y-3" aria-label="Meetings">
          <h2 className="text-lg font-semibold text-white">Meetings</h2>
          {meetings.length === 0 ? (
            <div className="rounded-lg border border-dashed border-white/20 bg-white/5 p-6 text-center">
              <p className="text-sm text-blue-100/70">No meetings yet. Create one to start notes.</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {meetings.map((meeting) => {
                const selected = meeting.id === selectedMeetingId;
                return (
                  <li key={meeting.id}>
                    <button
                      type="button"
                      aria-pressed={selected}
                      onClick={() => {
                        handleSelectMeeting(meeting.id);
                      }}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 rounded-lg border p-3 text-left transition-colors",
                        selected ? "border-sky-400 bg-white/15" : "border-white/10 bg-white/5 hover:bg-white/10",
                      )}
                    >
                      <span className="min-w-0">
                        <span className="block font-medium text-white">{formatMeetingDate(meeting.meetingDate)}</span>
                        <span className="block truncate text-xs text-blue-100/70">
                          {meeting.topics.trim() ? meeting.topics.trim() : "No topics yet"}
                        </span>
                      </span>
                      <span className="shrink-0 rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-xs font-medium text-white">
                        {formatMeetingStatus(meeting.status)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {selectedMeeting ? (
          <MeetingReadPane key={selectedMeeting.id} meeting={selectedMeeting} />
        ) : (
          <section
            className="rounded-lg border border-dashed border-white/20 bg-white/5 p-6"
            aria-label="Selected meeting"
          >
            <p className="text-sm text-blue-100/70">Create a meeting to read topics, notes, and wrap-up here.</p>
          </section>
        )}

        <TasksPanel employeeId={employee.id} meetings={meetings} tasks={tasks} onChange={setTasks} />
      </div>
    </div>
  );
}
