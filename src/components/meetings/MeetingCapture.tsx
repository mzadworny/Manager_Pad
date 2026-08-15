import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Trash2 } from "lucide-react";
import { useMeetingAutosave } from "@/components/hooks/useMeetingAutosave";
import { NotesEditor } from "@/components/meetings/NotesEditor";
import { TasksPanel } from "@/components/meetings/TasksPanel";
import { DeleteDialog } from "@/components/shared/DeleteDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Employee, Meeting, MeetingStatus, Task } from "@/types";

const WRAP_UP_MIN_HEIGHT_CLASS = "min-h-[160px]";

function FinalizeButton({
  status,
  disabled,
  onToggle,
}: {
  status: MeetingStatus;
  disabled?: boolean;
  onToggle: () => void;
}) {
  const isCompleted = status === "completed";
  return (
    <Button type="button" variant={isCompleted ? "secondary" : "default"} disabled={disabled} onClick={onToggle}>
      {isCompleted ? "Reopen" : "Mark complete"}
    </Button>
  );
}

interface MeetingCaptureProps {
  meetingId: string;
}

export function MeetingCapture({ meetingId }: MeetingCaptureProps) {
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [topics, setTopics] = useState("");
  const [meetingDate, setMeetingDate] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const autosaveInitial = useMemo(
    () =>
      meeting
        ? {
            topics: meeting.topics,
            meetingDate: meeting.meetingDate,
            notesJson: meeting.notesJson,
            observationsJson: meeting.observationsJson,
            conclusionsJson: meeting.conclusionsJson,
          }
        : null,
    [meeting],
  );

  const autosave = useMeetingAutosave(meetingId, autosaveInitial, {
    frozen: meeting?.status === "completed",
  });

  useEffect(() => {
    let cancelled = false;
    const isActive = () => !cancelled;

    async function load() {
      setIsLoading(true);
      setLoadError(null);
      try {
        const meetingResponse = await fetch(`/api/meetings/${meetingId}`);
        if (!meetingResponse.ok) {
          const payload = (await meetingResponse.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error ?? "Meeting not found");
        }
        const meetingPayload = (await meetingResponse.json()) as { meeting: Meeting };
        if (!isActive()) {
          return;
        }

        setMeeting(meetingPayload.meeting);
        setTopics(meetingPayload.meeting.topics);
        setMeetingDate(meetingPayload.meeting.meetingDate);

        const [tasksResponse, employeeResponse] = await Promise.all([
          fetch(`/api/tasks?meetingId=${encodeURIComponent(meetingId)}`),
          fetch(`/api/employees/${meetingPayload.meeting.employeeId}`),
        ]);

        if (!isActive()) {
          return;
        }

        if (tasksResponse.ok) {
          const tasksPayload = (await tasksResponse.json()) as { tasks: Task[] };
          setTasks(tasksPayload.tasks);
        }

        if (employeeResponse.ok) {
          const employeePayload = (await employeeResponse.json()) as { employee: Employee };
          setEmployee(employeePayload.employee);
        }
      } catch (err) {
        if (isActive()) {
          setLoadError(err instanceof Error ? err.message : "Unable to load meeting");
        }
      } finally {
        if (isActive()) {
          setIsLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [meetingId]);

  if (isLoading) {
    return <p className="text-sm text-blue-100/70">Loading meeting...</p>;
  }

  if (loadError || !meeting) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-red-400">{loadError ?? "Meeting not found"}</p>
        <Button type="button" variant="secondary" asChild>
          <a href="/dashboard">
            <ArrowLeft className="size-4" />
            Back to dashboard
          </a>
        </Button>
      </div>
    );
  }

  const personHref = `/employees/${meeting.employeeId}`;
  const isCompleted = meeting.status === "completed";
  const isSaving = autosave.status === "saving";

  async function handleToggleComplete() {
    if (isSaving) {
      return;
    }
    const nextStatus: MeetingStatus = isCompleted ? "open" : "completed";
    const result = await autosave.flush(nextStatus);
    if (result.ok) {
      setMeeting((current) => (current ? { ...current, status: nextStatus } : current));
    }
  }

  async function handleRetry() {
    const result = await autosave.retry();
    if (!result.ok || !result.status) {
      return;
    }
    const nextStatus = result.status;
    setMeeting((current) => (current ? { ...current, status: nextStatus } : current));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Button type="button" variant="ghost" className="px-0 text-blue-100/70 hover:text-white" asChild>
            <a href={personHref}>
              <ArrowLeft className="size-4" />
              {employee?.name ?? "Back to person"}
            </a>
          </Button>
          <div className="flex flex-wrap items-end gap-4">
            <label className="flex flex-col gap-2 text-sm text-blue-100/80">
              Meeting date
              <Input
                type="date"
                value={meetingDate}
                disabled={isCompleted}
                onChange={(event) => {
                  const value = event.target.value;
                  setMeetingDate(value);
                  autosave.setMeetingDate(value);
                }}
                className="w-auto border-white/20 bg-white/5 text-white"
              />
            </label>
            <p className="pb-2 text-xs text-blue-100/50" aria-live="polite">
              {autosave.status === "saving"
                ? "Saving..."
                : autosave.status === "saved"
                  ? "Saved"
                  : autosave.status === "error"
                    ? "Save failed"
                    : "\u00a0"}
            </p>
            <p className="pb-2 text-sm font-medium text-white">{isCompleted ? "Completed" : "Open"}</p>
            <div className="pb-0.5">
              <FinalizeButton
                status={meeting.status}
                disabled={isSaving}
                onToggle={() => void handleToggleComplete()}
              />
            </div>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Delete meeting"
          onClick={() => {
            setIsDeleteOpen(true);
          }}
        >
          <Trash2 className="size-4 text-red-300" />
        </Button>
      </div>

      {autosave.status === "error" ? (
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-red-400/40 bg-red-950/40 px-4 py-3"
          role="alert"
        >
          <p className="text-sm text-red-300">{autosave.error ?? "Unable to save changes"}</p>
          <Button type="button" variant="secondary" size="sm" onClick={() => void handleRetry()}>
            Retry
          </Button>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-4">
          <label className="flex flex-col gap-2 text-sm text-blue-100/80">
            Topics
            <textarea
              value={topics}
              disabled={isCompleted}
              onChange={(event) => {
                const value = event.target.value;
                setTopics(value);
                autosave.setTopics(value);
              }}
              rows={4}
              placeholder="Prep topics for this 1-on-1"
              className="border-input focus-visible:border-ring focus-visible:ring-ring/50 min-h-24 w-full rounded-md border border-white/20 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-blue-100/40 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50"
            />
          </label>

          <div className="space-y-2">
            <p className="text-sm text-blue-100/80">Notes</p>
            <NotesEditor initialContent={meeting.notesJson} onChange={autosave.setNotesJson} editable={!isCompleted} />
          </div>

          <section className="space-y-4" aria-labelledby="wrap-up-heading">
            <h2 id="wrap-up-heading" className="text-lg font-semibold text-white">
              Wrap-up
            </h2>
            <div className="space-y-2">
              <p className="text-sm text-blue-100/80">Observations</p>
              <NotesEditor
                initialContent={meeting.observationsJson}
                onChange={autosave.setObservationsJson}
                editable={!isCompleted}
                minHeightClass={WRAP_UP_MIN_HEIGHT_CLASS}
              />
            </div>
            <div className="space-y-2">
              <p className="text-sm text-blue-100/80">Conclusions</p>
              <NotesEditor
                initialContent={meeting.conclusionsJson}
                onChange={autosave.setConclusionsJson}
                editable={!isCompleted}
                minHeightClass={WRAP_UP_MIN_HEIGHT_CLASS}
              />
            </div>
            <FinalizeButton status={meeting.status} disabled={isSaving} onToggle={() => void handleToggleComplete()} />
          </section>
        </div>

        <TasksPanel meetingId={meetingId} tasks={tasks} onChange={setTasks} />
      </div>

      <DeleteDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        title="Delete meeting?"
        description="This will soft-delete the meeting and its tasks. You will return to the person page."
        onConfirm={async () => {
          const response = await fetch(`/api/meetings/${meetingId}`, { method: "DELETE" });
          if (!response.ok) {
            const payload = (await response.json().catch(() => null)) as { error?: string } | null;
            throw new Error(payload?.error ?? "Unable to delete meeting");
          }
          window.location.href = personHref;
        }}
      />
    </div>
  );
}
