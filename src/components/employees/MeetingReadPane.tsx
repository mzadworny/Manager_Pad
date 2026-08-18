import { useState, type ReactNode } from "react";
import { ChevronDown, ExternalLink } from "lucide-react";
import { NotesEditor } from "@/components/meetings/NotesEditor";
import { Button } from "@/components/ui/button";
import { cn, formatMeetingDate } from "@/lib/utils";
import { isEmptyNotesJson, type Meeting } from "@/types";

const COMPACT_MAX_HEIGHT_CLASS = "max-h-24 overflow-hidden";
const READ_ONLY_MIN_HEIGHT_CLASS = "min-h-0";

interface MeetingReadPaneProps {
  meeting: Meeting;
}

function formatMeetingStatus(status: Meeting["status"]): string {
  return status === "completed" ? "Completed" : "Open";
}

function ExpandableField({
  title,
  empty,
  emptyLabel,
  children,
}: {
  title: string;
  empty: boolean;
  emptyLabel: string;
  children: ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-white/10 bg-white/5">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => {
          setExpanded((current) => !current);
        }}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm font-medium text-white"
      >
        {title}
        <ChevronDown
          className={cn("size-4 shrink-0 text-blue-100/70 transition-transform", expanded && "rotate-180")}
        />
      </button>
      <div className={cn("px-3 pb-3", !expanded && COMPACT_MAX_HEIGHT_CLASS)}>
        {empty ? <p className="text-sm text-blue-100/50">{emptyLabel}</p> : children}
      </div>
    </div>
  );
}

export function MeetingReadPane({ meeting }: MeetingReadPaneProps) {
  const topics = meeting.topics.trim();
  const notesEmpty = isEmptyNotesJson(meeting.notesJson);
  const observationsEmpty = isEmptyNotesJson(meeting.observationsJson);
  const conclusionsEmpty = isEmptyNotesJson(meeting.conclusionsJson);
  const meetingHref = `/meetings/${meeting.id}`;

  return (
    <section className="space-y-4" aria-label="Selected meeting">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">{formatMeetingDate(meeting.meetingDate)}</h2>
          <p className="text-sm text-blue-100/70">{formatMeetingStatus(meeting.status)}</p>
        </div>
        <Button type="button" variant="secondary" size="sm" asChild>
          <a href={meetingHref}>
            <ExternalLink className="size-4" />
            Open meeting
          </a>
        </Button>
      </div>

      <ExpandableField title="Topics" empty={!topics} emptyLabel="No topics yet">
        <p className="text-sm whitespace-pre-wrap text-blue-100/90">{topics}</p>
      </ExpandableField>

      <ExpandableField title="Notes" empty={notesEmpty} emptyLabel="No notes yet">
        <NotesEditor
          key={`${meeting.id}-notes`}
          initialContent={meeting.notesJson}
          onChange={() => undefined}
          editable={false}
          minHeightClass={READ_ONLY_MIN_HEIGHT_CLASS}
        />
      </ExpandableField>

      <ExpandableField title="Observations" empty={observationsEmpty} emptyLabel="No observations yet">
        <NotesEditor
          key={`${meeting.id}-observations`}
          initialContent={meeting.observationsJson}
          onChange={() => undefined}
          editable={false}
          minHeightClass={READ_ONLY_MIN_HEIGHT_CLASS}
        />
      </ExpandableField>

      <ExpandableField title="Conclusions" empty={conclusionsEmpty} emptyLabel="No conclusions yet">
        <NotesEditor
          key={`${meeting.id}-conclusions`}
          initialContent={meeting.conclusionsJson}
          onChange={() => undefined}
          editable={false}
          minHeightClass={READ_ONLY_MIN_HEIGHT_CLASS}
        />
      </ExpandableField>
    </section>
  );
}
