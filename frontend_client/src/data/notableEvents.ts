import type { NotableEvent } from "../types/event";

// Client-supplied historical events from the existing project dataset.
const sourceEvents = [
  {
    id: 1,
    event_date: "2021-08-01",
    date_end: "2021-08-15",
    date_approximate: true,
    title: "Delta becomes dominant variant",
    description:
      "Delta variant becomes the dominant COVID-19 strain circulating in Australia, driving a significant increase in case numbers and prompting stricter mandate responses across multiple jurisdictions.",
    source: "Client",
  },
  {
    id: 2,
    event_date: "2021-10-15",
    date_end: "2021-10-31",
    date_approximate: true,
    title: "Extended lockdowns end in ACT, NSW and VIC",
    description:
      "Following extended Delta-driven lockdowns, ACT, NSW, and Victoria lift stay-at-home orders as vaccination targets are reached, transitioning to living-with-COVID frameworks.",
    source: "Client",
  },
  {
    id: 3,
    event_date: "2021-10-29",
    date_end: "2021-11-07",
    date_approximate: true,
    title: "ATAGI recommends booster dose for high-risk populations",
    description:
      "The Australian Technical Advisory Group on Immunisation (ATAGI) recommends a booster dose of COVID-19 vaccine for high-risk populations including aged care residents, healthcare workers, and the immunocompromised.",
    source: "Client",
  },
  {
    id: 4,
    event_date: "2021-12-01",
    date_end: "2021-12-15",
    date_approximate: true,
    title: "Omicron begins spreading across Australia",
    description:
      "The Omicron variant is detected and begins spreading across Australian states, triggering renewed concern and prompting several jurisdictions to reimpose or extend mandate coverage.",
    source: "Client",
  },
  {
    id: 5,
    event_date: "2022-03-03",
    date_end: null,
    date_approximate: false,
    title: "WA hard border removed for fully vaccinated travellers",
    description:
      "Western Australia removes its hard border, allowing fully vaccinated interstate and international travellers to enter without quarantine requirements, ending one of the last remaining state border closures in Australia.",
    source: "Client",
  },
];

export const NOTABLE_EVENTS: NotableEvent[] = sourceEvents.map((event) => ({
  ...event,
  display_date:
    event.date_approximate && event.date_end
      ? new Date(
          (Date.parse(event.event_date) + Date.parse(event.date_end)) / 2,
        )
          .toISOString()
          .slice(0, 10)
      : event.event_date,
}));
