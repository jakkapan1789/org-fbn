import { OrgChart } from "./orgchart/OrgChart";

// Query-param routes only — they survive static hosting with zero server config, unlike a
// path-based route which needs SPA-fallback rewrites. Read-only is the default: stripping
// params off a shared link must land on a preview, never the editor.
//   ?mode=edit                      the editable Admin page — the ONLY editable route.
//   ?source=jsonfile&title=<title>  a published Export served from public/orgs/<title>.json —
//                                   the shareable one: any visitor sees it, no localStorage.
//                                   Read-only even if mode=edit is also present.
//   anything else (incl. bare URL)  read-only preview: ?org=<id> renders this browser's own
//                                   Export from localStorage (or, absent one, live data).
function App() {
  const params = new URLSearchParams(window.location.search);
  const readOnly = params.get("mode") !== "edit" || params.get("source") === "jsonfile";
  return <OrgChart readOnly={readOnly} />;
}

export default App;
