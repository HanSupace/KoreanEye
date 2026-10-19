export function DetectiveMark() {
  return <svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M9 10h22v27H9z" stroke="currentColor" strokeWidth="2"/><path d="M15 8v31M6 17h6M6 24h6M6 31h6M21 16h5" stroke="currentColor" strokeWidth="2"/><circle cx="31" cy="29" r="9" fill="var(--paper)" stroke="currentColor" strokeWidth="2.5"/><path d="m37 36 7 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/></svg>;
}

export function NotebookArt() {
  return <svg className="notebook-art" viewBox="0 0 300 230" fill="none" aria-hidden="true">
    <circle cx="147" cy="111" r="100" fill="#faf5ef"/>
    <ellipse cx="155" cy="205" rx="105" ry="10" fill="#eadfd7" opacity=".65"/>
    <g transform="rotate(-9 135 110)"><rect x="54" y="27" width="157" height="177" rx="23" fill="#c59b7d"/><rect x="64" y="31" width="12" height="169" rx="6" fill="#ae7f62"/><rect x="88" y="52" width="101" height="70" rx="14" fill="#fffdf8"/><text x="138" y="92" textAnchor="middle" fill="#805c46" fontSize="19" fontFamily="sans-serif" fontWeight="bold">탐정 수첩</text><circle cx="119" cy="151" r="4" fill="#704831"/><circle cx="157" cy="151" r="4" fill="#704831"/><path d="M130 160q8 9 16 0" stroke="#704831" strokeWidth="3" strokeLinecap="round"/><ellipse cx="107" cy="161" rx="8" ry="4" fill="#e8b6a6"/><ellipse cx="169" cy="161" rx="8" ry="4" fill="#e8b6a6"/><path d="M174 27v26l9-6 9 6V27" fill="#dfb18e"/></g>
    <g transform="rotate(13 216 125)"><path d="m213 154 0 41" stroke="#ae7f62" strokeWidth="18" strokeLinecap="round"/><circle cx="213" cy="111" r="42" fill="#f4ece5" fillOpacity=".9" stroke="#cfaa80" strokeWidth="11"/><path d="M190 100q7-15 23-15" stroke="#fff" strokeWidth="6" strokeLinecap="round"/></g>
    <g stroke="#bc765b" strokeWidth="4" strokeLinecap="round"><path d="M36 65v12M30 71h12M254 39v12M248 45h12"/></g><circle cx="257" cy="168" r="5" fill="#cfbaa7"/>
    <path d="m38 177 68-52 5 7-69 51-13 4z" fill="#ed9b81"/><path d="m38 177 4 6-13 4z" fill="#eed2a3"/>
  </svg>;
}

export function NavIcon({ name }: { name: string }) {
    const paths: Record<string,string> = { today:"M4 4h16v16H4z M8 4v16 M12 9h5 M12 13h5", quests:"M12 3 14.7 8.3 20.5 9.1 16.3 13.2 17.3 19 12 16.2 6.7 19 7.7 13.2 3.5 9.1 9.3 8.3z", ranking:"M8 21h8 M12 17v4 M5 4h14v12H5z M8 8h8 M8 12h5", questions:"m5 16 11-11 3 3-11 11-4 1z M14 7l3 3", write:"M13 4H4v16h16v-9 M10 14l1-4 8-8 3 3-8 8z", review:"M15 15l6 6 M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0", addStudent:"M8 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M2 21v-2a6 6 0 0 1 12 0v2 M19 10v8 M15 14h8", mypage:"M12 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6 M5 21a7 7 0 0 1 14 0 M4 4h2 M18 4h2 M4 12h2 M18 12h2" };
  return <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]??paths.today}/></svg>;
}
