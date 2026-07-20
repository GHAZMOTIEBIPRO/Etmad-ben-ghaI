export function SignatureMark() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed bottom-3 left-3 z-30 select-none opacity-60 sm:bottom-5 sm:left-5"
    >
      <div className="signature-mark relative px-2 pb-2">
        <span>غازي بن متعب</span>
        <svg
          className="absolute -bottom-1 left-0 h-4 w-full overflow-visible opacity-70"
          viewBox="0 0 220 28"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M5 20C42 26 72 7 108 13C139 18 158 25 214 7"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <path
            d="M157 19C175 22 191 19 210 11"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </svg>
      </div>
    </div>
  );
}
