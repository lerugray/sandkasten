// The classic MapLibre pages (home, editor, /play?map=legacy) keep IBM Plex
// from Google Fonts. React hoists this stylesheet into <head>; the terminal
// display on /play never renders it, so it makes no remote font requests.
export function ClassicFonts() {
  return (
    <link
      rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=IBM+Plex+Sans:wght@300;400;500;600;700&display=swap"
      precedence="default"
    />
  );
}
