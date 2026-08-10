import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { NotesEditor } from "@/components/meetings/NotesEditor";
import { TasksPanel } from "@/components/meetings/TasksPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getMeeting, listTasksByMeeting, updateMeeting } from "@/lib/meeting-mock-store";
import type { Employee, Meeting, NotesJson, Task } from "@/types";

type SaveStatus = "idle" | "saving" | "saved";

interface MeetingCaptureProps {
  meetingId: string;
}

const DEBOUNCE_MS = 600;

export function MeetingCapture({ meetingId }: MeetingCaptureProps) {
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [topics, setTopics] = useState("");
  const [meetingDate, setMeetingDate] = useState("");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const topicsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notesTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveClearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const markSaved = useCallback(() => {
    setSaveStatus("saved");
    if (saveClearTimer.current) {
      clearTimeout(saveClearTimer.current);
    }
    saveClearTimer.current = setTimeout(() => {
      setSaveStatus("idle");
    }, 1500);
  }, []);

  const persistPatch = useCallback(
    (
      patch: Partial<Pick<Meeting, "meetingDate" | "topics" | "notesJson">>,
      delayMs: number,
      timer: {
        current: ReturnType<typeof setTimeout> | null;
      },
    ) => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
      setSaveStatus("saving");
      timer.current = setTimeout(() => {
        const updated = updateMeeting(meetingId, patch);
        if (updated) {
          setMeeting(updated);
          markSaved();
        }
      }, delayMs);
    },
    [markSaved, meetingId],
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      const localMeeting = getMeeting(meetingId);
      if (!localMeeting) {
        if (!cancelled) {
          setError("Meeting not found in this browser session");
          setIsLoading(false);
        }
        return;
      }

      setMeeting(localMeeting);
      setTopics(localMeeting.topics);
      setMeetingDate(localMeeting.meetingDate);
      setTasks(listTasksByMeeting(meetingId));

      try {
        const response = await fetch(`/api/employees/${localMeeting.employeeId}`);
        if (response.ok) {
          const payload = (await response.json()) as { employee: Employee };
          if (!cancelled) {
            setEmployee(payload.employee);
          }
        }
      } catch {
        // Person label is optional for the capture shell.
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void load();

    const topicsHandle = topicsTimer;
    const notesHandle = notesTimer;
    const dateHandle = dateTimer;
    const saveClearHandle = saveClearTimer;

    return () => {
      cancelled = true;
      if (topicsHandle.current) {
        clearTimeout(topicsHandle.current);
      }
      if (notesHandle.current) {
        clearTimeout(notesHandle.current);
      }
      if (dateHandle.current) {
        clearTimeout(dateHandle.current);
      }
      if (saveClearHandle.current) {
        clearTimeout(saveClearHandle.current);
      }
    };
  }, [meetingId]);

  function handleTopicsChange(value: string) {
    setTopics(value);
    persistPatch({ topics: value }, DEBOUNCE_MS, topicsTimer);
  }

  function handleMeetingDateChange(value: string) {
    setMeetingDate(value);
    persistPatch({ meetingDate: value }, DEBOUNCE_MS, dateTimer);
  }

  function handleNotesChange(content: NotesJson) {
    persistPatch({ notesJson: content }, DEBOUNCE_MS, notesTimer);
  }

  if (isLoading) {
    return <p className="text-sm text-blue-100/70">Loading meeting...</p>;
  }

  if (error || !meeting) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-red-400">{error ?? "Meeting not found"}</p>
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
                onChange={(event) => {
                  handleMeetingDateChange(event.target.value);
                }}
                className="w-auto border-white/20 bg-white/5 text-white"
              />
            </label>
            <p className="pb-2 text-xs text-blue-100/50" aria-live="polite">
              {saveStatus === "saving" ? "Saving..." : saveStatus === "saved" ? "Saved" : "\u00a0"}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-4">
          <label className="flex flex-col gap-2 text-sm text-blue-100/80">
            Topics
            <textarea
              value={topics}
              onChange={(event) => {
                handleTopicsChange(event.target.value);
              }}
              rows={4}
              placeholder="Prep topics for this 1-on-1"
              className="border-input focus-visible:border-ring focus-visible:ring-ring/50 min-h-24 w-full rounded-md border border-white/20 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-blue-100/40 focus-visible:ring-[3px]"
            />
          </label>

          <div className="space-y-2">
            <p className="text-sm text-blue-100/80">Notes</p>
            <NotesEditor initialContent={meeting.notesJson} onChange={handleNotesChange} />
          </div>
        </div>

        <TasksPanel meetingId={meetingId} tasks={tasks} onChange={setTasks} />
      </div>
    </div>
  );
}
