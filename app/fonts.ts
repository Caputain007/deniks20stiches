import localFont from 'next/font/local'

// Self-hosted (SIL Open Font License, see the OFL files next to the fonts).
// Forum: an inscriptional Roman serif. Its zero is narrower than its O, so "Deniks20" never reads "Deniks2O".
export const forum = localFont({
  src: './fonts/forum-latin-400-normal.woff2',
  weight: '400',
  variable: '--font-forum',
  display: 'swap',
})

export const mulish = localFont({
  src: './fonts/mulish-latin-wght-normal.woff2',
  weight: '200 1000',
  variable: '--font-mulish',
  display: 'swap',
})

// Extended Latin, including the naira sign (₦), loaded only when a page uses those characters.
export const mulishExt = localFont({
  src: './fonts/mulish-latin-ext-wght-normal.woff2',
  weight: '200 1000',
  variable: '--font-mulish-ext',
  display: 'swap',
  preload: false,
  declarations: [
    {
      prop: 'unicode-range',
      value:
        'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+1E00-1EFF, U+20A0-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF',
    },
  ],
})
