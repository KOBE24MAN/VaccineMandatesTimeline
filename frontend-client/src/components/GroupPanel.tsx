import { motion, AnimatePresence } from "framer-motion";
import type { EventIndex } from "../types/event";
import { MandateDetails } from "./MandateDetails";
import { REGION_COLOR } from "./Timeline";
import { mandateHeading } from "../utils/mandateDetails";

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
                Grouped Policies
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {groupEvents.length} linked {groupEvents.length === 1 ? "entry" : "entries"}
              </p>
            </div>
            <button
              onClick={onClose}
              aria-label="Close grouped policies"
              className="text-gray-400 hover:text-gray-700 text-2xl leading-none"
            >
              &times;
            </button>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
            {groupEvents.map(ev => (
              <div key={ev.id} className="p-3 space-y-2">
                <MandateDetails event={ev} color={REGION_COLOR[ev.region] ?? "#5a84ff"} />
                <button
                  onClick={() => onSelectEvent(ev.id)}
                  aria-label={`Select ${mandateHeading(ev.id, ev.title)}`}
                  className="w-full text-right px-3 py-1.5 rounded border border-gray-200 text-xs font-semibold hover:bg-gray-50"
                  style={{ color: REGION_COLOR[ev.region] ?? "#5a84ff" }}
                >Select this mandate →</button>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
