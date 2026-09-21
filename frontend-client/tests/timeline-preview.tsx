// Local visual regression fixture. Does not modify the production CSV.
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { Timeline } from "../src/components/Timeline";
import type { EventIndex } from "../src/types/event";
import "../src/index.css";

const base: EventIndex = {
  id: "ended", title: "Ended mandate with a longer booster", region: "WA", type: "Employment",
  announcement_date: "2021-01-01", start_date: "2021-02-01", enforcement_date: "2021-03-01",
  end_date: "2021-06-01", ongoing: false, visibility_level: 1, date_uncertain: false,
  short_description: null, target: null,
  booster: { id: "boost", title: "Booster", start_date: "2021-05-01", end_date: "2021-10-01", ongoing: false },
};
const events = [base,
  { ...base, id: "ongoing", title: "Ongoing mandate", end_date: null, ongoing: true, booster: null },
  { ...base, id: "ongoing-booster", title: "Ended original, ongoing booster", booster: { ...base.booster!, end_date: null, ongoing: true } },
];
function Preview() {
  const [tail, setTail] = useState(true);
  return <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
    <p>TEST DATA ONLY — finite booster extension, ongoing mandate and ongoing booster</p>
    <button onClick={() => setTail(!tail)}>Ongoing tail {tail ? "on" : "off"}</button>
    <Timeline events={events} activeRegions={new Set(["WA"])}
      onEventClick={() => {}} onGroupClick={() => {}} showOngoingTail={tail}
      windowStart={new Date("2020-12-01T12:00:00Z")} windowEnd={new Date("2021-12-01T12:00:00Z")} />
  </div>;
}
createRoot(document.getElementById("root")!).render(<Preview />);
