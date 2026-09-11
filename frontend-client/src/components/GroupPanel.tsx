import { motion, AnimatePresence } from "framer-motion";
import type { EventIndex } from "../types/event";

interface Props {
  ids: string[] | null;
  events: EventIndex[];
  onSelectEvent: (id: string) => void;
  onClose: () => void;
}

export function GroupPanel({ ids, events, onSelectEvent, onClose }: Props) {
  const groupEvents = ids
    ? (ids.map(id => events.find(e => e.id === id)).filter(Boolean) as EventIndex[])
    : [];

  return (
    <AnimatePresence>
      {ids !== null && (
        <motion.div
          key="group-panel"
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="fixed right-0 top-0 h-full w-96 bg-white shadow-xl z-50 flex flex-col"
        >
          <div className="flex items-center justify-between p-4 border-b">
            <div>
              <h2 className="text-lg font-semibold">
                {groupEvents[0]?.title ?? "Grouped Policies"}
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {groupEvents.length} linked {groupEvents.length === 1 ? "entry" : "entries"}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-700 text-2xl leading-none"
            >
              &times;
            </button>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
            {groupEvents.map(ev => (
              <button
                key={ev.id}
                onClick={() => onSelectEvent(ev.id)}
                className="w-full text-left p-4 hover:bg-gray-50 transition-colors"
              >
                <p className="text-sm font-medium text-gray-800 mb-1">
                  {ev.short_description || "No description"}
                </p>
                <p className="text-xs text-gray-400">
                  {ev.type} · {ev.start_date}
                  {ev.end_date ? ` → ${ev.end_date}` : " (ongoing)"}
                </p>
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
