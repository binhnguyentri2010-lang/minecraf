import type { ReactNode } from 'react';

const I = (d: ReactNode) => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d}
  </svg>
);

export const Icons = {
  select: I(<path d="M5 3l14 8-6 2-2 6z" />),
  lasso: I(<><path d="M12 4c-5 0-8 2-8 5s3 5 8 5 8-2 8-5-3-5-8-5z" strokeDasharray="3 2.4" /><path d="M9 14c-1 2 0 4 2 5" /></>),
  cut: I(<><circle cx="6" cy="18" r="2.6" /><circle cx="18" cy="18" r="2.6" /><path d="M7.5 16L17 4M16.5 16L7 4" /></>),
  paste: I(<><rect x="6" y="5" width="12" height="15" rx="2" /><path d="M9.5 5V3.5h5V5" /></>),
  pen: I(<><path d="M4 20l1-4L16 5l3 3L8 19z" /><path d="M14 7l3 3" /></>),
  highlighter: I(<><path d="M9 14l6-6 4 4-6 6H9z" /><path d="M4 20h6" /></>),
  eraser: I(<><path d="M8 20h11" /><path d="M5 15l8-9 6 6-6 6H9z" /></>),
  line: I(<path d="M5 19L19 5" />),
  arrow: I(<><path d="M5 19L19 5" /><path d="M11 5h8v8" /></>),
  circle: I(<circle cx="12" cy="12" r="7.5" />),
  rect: I(<rect x="4.5" y="6.5" width="15" height="11" rx="1" />),
  ruler: I(<><rect x="2.5" y="8" width="19" height="8" rx="1.5" /><path d="M7 8v3M11 8v4M15 8v3M19 8v4" /></>),
  protractor: I(<><path d="M3 18a9 9 0 0118 0z" /><path d="M12 18l4-6" /><path d="M12 9v2" /></>),
  undo: I(<><path d="M9 8L5 12l4 4" /><path d="M5 12h9a5 5 0 010 10" transform="translate(0 -5)" /></>),
  redo: I(<><path d="M15 8l4 4-4 4" /><path d="M19 12h-9a5 5 0 000 10" transform="translate(0 -5)" /></>),
  library: I(<><rect x="4" y="4" width="7" height="7" rx="1" /><path d="M14 20l3.5-7 3.5 7z" /><circle cx="7.5" cy="17.5" r="3.5" /><path d="M14 7.5h7" /></>),
  graph: I(<><path d="M4 4v16h16" /><path d="M6 17c3-9 6-9 8-4s3 4 5 0" /></>),
  text: I(<><path d="M5 6h14M12 6v13" /><path d="M9 19h6" /></>),
  boards: I(<><rect x="4" y="5" width="13" height="10" rx="1.5" /><path d="M7 19h13V9" /></>),
  export: I(<><path d="M12 15V4M8 8l4-4 4 4" /><path d="M5 14v5h14v-5" /></>),
  dash: I(<path d="M4 12h3M10.5 12h3M17 12h3" />),
  smooth: I(<><path d="M3 15c3-8 5 6 9-2s6 4 9-3" /></>),
  snap: I(<><path d="M5 17c2-8 6-12 14-11-1 8-5 12-11 11" /><path d="M5 19l4-4" /></>),
  hand: I(<><path d="M8 13V6a1.5 1.5 0 013 0v5M11 11V4.5a1.5 1.5 0 013 0V11M14 11V6a1.5 1.5 0 013 0v8a6 6 0 01-6 6h-1a5 5 0 01-4-2l-3-4a1.5 1.5 0 012.3-1.9L8 15" /></>),
  home: I(<path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z" />),
  sidebar: I(<><rect x="3.5" y="5" width="17" height="14" rx="2" /><path d="M9.5 5v14" /></>),
  more: I(<><circle cx="6" cy="12" r="1.2" fill="currentColor" /><circle cx="12" cy="12" r="1.2" fill="currentColor" /><circle cx="18" cy="12" r="1.2" fill="currentColor" /></>),
  star: I(<path d="M12 4l2.4 5 5.4.7-4 3.8 1 5.4L12 16.3 7.2 18.9l1-5.4-4-3.8 5.4-.7z" />),
  fit: I(<><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></>),
  shapes: I(<><rect x="4" y="4" width="8" height="8" rx="1.5" /><circle cx="16.5" cy="16.5" r="4" /><path d="M6 20l3-5 3 5z" /></>),
  chevron: I(<path d="M7 10l5 5 5-5" />),
  add: I(<path d="M12 5v14M5 12h14" />),
  share: I(<><path d="M12 15V4M8 8l4-4 4 4" /><path d="M5 13v6h14v-6" /></>),
  close: I(<path d="M6 6l12 12M18 6L6 18" />),
  copy: I(<><rect x="8" y="8" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 012-2h9" /></>),
  trash: I(<><path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13" /></>),
  plus: I(<path d="M12 5v14M5 12h14" />),
};
