import { useEffect, useRef } from "react";
import type { EventIndex, MandateField } from "../types/event";
import { MANDATE_FIELDS } from "../types/event";
import { REGION_COLOR } from "./Timeline";
interface Props {
  event: EventIndex | null;
  events: EventIndex[];
  onClose: () => void;
  onSelect: (id: string) => void;
}
const groups: { title: string; fields: MandateField[] }[] = [
  {
    title: "Policy overview",
    fields: ["id", "jurisdiction", "name", "type", "target", "booster_id"],
  },
  {
    title: "Key dates",
    fields: [
      "announcement_date",
      "effective_date",
      "enforcement_date",
      "removal_date",
      "duration_days",
    ],
  },
  {
    title: "Requirements & enforcement",
    fields: [
      "compliance",
      "exemptions",
      "executive_orders",
      "enforcement_measures",
      "authority",
    ],
  },
  { title: "Removal", fields: ["removal_method", "removal_details"] },
  {
    title: "Vaccination context",
    fields: [
      "communications",
      "vaccine_eligibility_info",
      "vaccine_availability_info",
      "ATAGI",
      "uptake",
      "popu_info",
    ],
  },
  {
    title: "Notes & sources",
    fields: ["notes", "source", "ref_code", "ref_no"],
  },
];
const labels = Object.fromEntries(MANDATE_FIELDS);
export function EventDetail({ event, events, onClose, onSelect }: Props) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    panel.current?.scrollTo({ top: 0 });
  }, [event?.id]);
  return (
    <div className="detail-content" ref={panel}>
      <div className="panel-heading">
        <h2>Mandate details</h2>
        <button
          onClick={onClose}
          aria-label="Close details"
          className="icon-button"
        >
          ×
        </button>
      </div>
      {!event ? (
        <div className="detail-empty">
          <span aria-hidden="true">↖</span>
          <h3>A closer look at each policy</h3>
          <p>
            Select a timeline bar or search result to explore dates,
            requirements and source information.
          </p>
        </div>
      ) : (
        <>
          <div
            className="detail-intro"
            style={{ borderTopColor: REGION_COLOR[event.region] }}
          >
            <p className="eyebrow">
              {event.region} / #{event.id} /{" "}
              {event.isBooster ? "BOOSTER MANDATE" : "ORIGINAL MANDATE"}
            </p>
            <h3>{event.title}</h3>
            <p>{event.target}</p>
          </div>
          {!event.segments.length && (
            <p className="notice">
              Dates are incomplete for this record. No timeline interval has
              been inferred.
            </p>
          )}
          {(event.boosterIds.length > 0 || event.parentIds.length > 0) && (
            <section className="related-records">
              <h3>
                {event.isBooster
                  ? "Linked original mandates"
                  : "Linked booster mandates"}
              </h3>
              {(event.isBooster ? event.parentIds : event.boosterIds).map(
                (id) => {
                  const linked = events.find((item) => item.id === id);
                  return (
                    <button
                      key={id}
                      className="related-record"
                      onClick={() => onSelect(id)}
                    >
                      #{id} · {linked?.target || linked?.title || "View record"}
                      <span aria-hidden="true">↗</span>
                    </button>
                  );
                },
              )}
            </section>
          )}
          {groups.map((group) => {
            const fields = group.fields.filter((field) => event.record[field]);
            return fields.length ? (
              <section className="detail-section" key={group.title}>
                <h3>{group.title}</h3>
                <dl>
                  {fields.map((field) => (
                    <div key={field} data-field={field}>
                      <dt>{labels[field]}</dt>
                      <dd>{event.record[field]}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ) : null;
          })}
        </>
      )}
    </div>
  );
}
