// Profile links can be added when the official Voxsi account URLs are supplied.
// Until then these are decorative brand marks, not inactive link controls.
export function SocialLogos({ label }: { label: string }) {
  return (
    <div className="footer-socials">
      <span className="footer-socials-label">{label}</span>
      <ul className="social-logo-list" aria-label={label}>
        <li>
          <span className="social-logo" role="img" aria-label="X" title="X">
            <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
              <path d="M18.9 2H22l-6.8 7.8L23.2 22h-6.3L12 14.6 5.5 22H2.4l8.1-9.3L.8 2h6.5l4.5 6.8L18.9 2Zm-1.1 18h1.7L6.4 3.9H4.6L17.8 20Z" />
            </svg>
          </span>
        </li>
        <li>
          <span
            className="social-logo"
            role="img"
            aria-label="Instagram"
            title="Instagram"
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <rect x="3" y="3" width="18" height="18" rx="5" />
              <circle cx="12" cy="12" r="4" />
              <circle
                cx="17.5"
                cy="6.5"
                r="1"
                fill="currentColor"
                stroke="none"
              />
            </svg>
          </span>
        </li>
        <li>
          <span
            className="social-logo"
            role="img"
            aria-label="YouTube"
            title="YouTube"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
              <path d="M21.6 6.4c-.2-.9-.9-1.6-1.8-1.8C18.2 4.2 12 4.2 12 4.2s-6.2 0-7.8.4c-.9.2-1.6.9-1.8 1.8C2 8 2 12 2 12s0 4 .4 5.6c.2.9.9 1.6 1.8 1.8 1.6.4 7.8.4 7.8.4s6.2 0 7.8-.4c.9-.2 1.6-.9 1.8-1.8C22 16 22 12 22 12s0-4-.4-5.6ZM10 15.5v-7l6 3.5-6 3.5Z" />
            </svg>
          </span>
        </li>
        <li>
          <span
            className="social-logo"
            role="img"
            aria-label="Discord"
            title="Discord"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
              <path d="M20.32 4.37a19.8 19.8 0 0 0-4.89-1.52l-.6 1.23a18.5 18.5 0 0 0-5.66 0l-.6-1.23a19.7 19.7 0 0 0-4.9 1.52C.58 8.94-.26 13.4.16 17.8a19.8 19.8 0 0 0 6 3.03l1.22-1.98a12.8 12.8 0 0 1-1.92-.92l.47-.36a14.1 14.1 0 0 0 12.14 0l.47.36c-.61.36-1.25.67-1.92.92l1.22 1.98a19.8 19.8 0 0 0 6-3.03c.5-5.1-.85-9.52-3.52-13.43ZM8.02 15.12c-1.18 0-2.14-1.09-2.14-2.42s.94-2.43 2.14-2.43 2.16 1.1 2.14 2.43c0 1.33-.94 2.42-2.14 2.42Zm7.96 0c-1.18 0-2.14-1.09-2.14-2.42s.94-2.43 2.14-2.43 2.16 1.1 2.14 2.43c0 1.33-.94 2.42-2.14 2.42Z" />
            </svg>
          </span>
        </li>
      </ul>
    </div>
  );
}
