import { useEffect, useState } from "react";
import type { EventIndex, EventDetail as EventDetailType } from "../types/event";
import { REGION_COLOR } from "./Timeline";
import { MandateDetails, MandateSummary } from "./MandateDetails";

interface Props {
  eventId: string | null;
  groupIds: string[] | null;
  events: EventIndex[];
  fetchDetail: (id: string) => Promise<EventDetailType>;
  onClose: () => void;
  onSelectFromGroup: (id: string) => void;
}

export function EventDetail({ eventId, groupIds, events, fetchDetail, onClose, onSelectFromGroup }: Props) {
  const [detail, setDetail] = useState<EventDetailType | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (eventId === null) { setDetail(null); return; }
    let cancelled = false;
    setDetail(null);
    setLoading(true);
    setError(null);
    fetchDetail(eventId)
      .then(data => { if (!cancelled) { setDetail(data); setLoading(false); } })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load event");
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [eventId, fetchDetail]);

  const isEmpty = eventId === null && !groupIds;
  const groupEvents = groupIds
    ? (groupIds.map(id => events.find(e => e.id === id)).filter(Boolean) as EventIndex[])
    : [];

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-gray-200 sticky top-0 bg-white z-10">
        <div>
          <h2 className="text-base font-bold text-gray-800">Information bar</h2>
          {groupIds && (
            <p className="text-xs text-gray-400 mt-0.5">
              {groupEvents.length} linked {groupEvents.length === 1 ? "mandate" : "mandates"}
            </p>
          )}
          {!groupIds && !isEmpty && (
            <p className="text-xs text-gray-400 mt-0.5">Click a bar to explore</p>
          )}
        </div>
        {!isEmpty && (
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none" title="Clear selection" aria-label="Clear selection">
            &times;
          </button>
        )}
      </div>

      <div className="p-3 flex flex-col gap-3">
        {isEmpty && (
          <div className="flex-1 flex items-center justify-center text-gray-300 text-sm text-center">
            Click a mandate bar to see details
          </div>
        )}

        {/* Group view — compact cards, with full records available on selection. */}
        {groupIds && groupEvents.map(ev => (
          <MandateSummary key={ev.id} event={ev} color={REGION_COLOR[ev.region] ?? "#5a84ff"}
            onSelect={() => onSelectFromGroup(ev.id)} />
        ))}

        {/* Single event view — full detail card */}
        {eventId && (
          <>
            {loading && <p className="text-gray-500 text-sm">Loading…</p>}
            {error   && <p className="text-red-500 text-sm">{error}</p>}
            {detail  && <MandateDetails event={detail} color={REGION_COLOR[detail.region] ?? "#5a84ff"} />}
          </>
        )}
      </div>
    </div>
  );
}
