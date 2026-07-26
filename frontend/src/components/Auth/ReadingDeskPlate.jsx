// frontend/src/components/Auth/ReadingDeskPlate.jsx
// The tipped-in plate on the auth screen. The design leaves this as an image
// slot ("a photograph of an open book or reading desk"); until a licensed
// photograph is supplied it is drawn as a gold line engraving so the page
// ships self-contained — no network request, no layout shift, and it grades
// the same way a photograph would under the plate's sepia filter.
//
// Swap in a photograph by replacing this component's markup with an <img>;
// the .auth-plate wrapper already supplies the mat, outline and grade.
export default function ReadingDeskPlate() {
  return (
    <svg viewBox='0 0 400 300' role='img' aria-label='An open book on a reading desk' preserveAspectRatio='xMidYMid slice'>
      <defs>
        <linearGradient id='plate-ground' x1='0' y1='0' x2='0' y2='1'>
          <stop offset='0%' stopColor='#231d17' />
          <stop offset='100%' stopColor='#15110d' />
        </linearGradient>
        <radialGradient id='plate-lamp' cx='0.5' cy='0.62' r='0.55'>
          <stop offset='0%' stopColor='#b68235' stopOpacity='0.34' />
          <stop offset='100%' stopColor='#b68235' stopOpacity='0' />
        </radialGradient>
      </defs>

      <rect width='400' height='300' fill='url(#plate-ground)' />
      <rect width='400' height='300' fill='url(#plate-lamp)' />

      <g stroke='#c9973f' fill='none' strokeLinecap='round' strokeLinejoin='round'>
        {/* Desk edge */}
        <path d='M28 236h344' strokeWidth='1' opacity='0.5' />
        <path d='M52 248h296' strokeWidth='1' opacity='0.22' />

        {/* Open book — two leaves rising from a centre gutter */}
        <path d='M200 96c-26-16-58-22-88-20v130c30-2 62 4 88 20z' strokeWidth='1.6' opacity='0.9' />
        <path d='M200 96c26-16 58-22 88-20v130c-30-2-62 4-88 20z' strokeWidth='1.6' opacity='0.9' />
        <path d='M200 96v130' strokeWidth='1.2' opacity='0.55' />

        {/* Page block thickness */}
        <path d='M112 206c30-2 62 4 88 20' strokeWidth='0.9' opacity='0.4' />
        <path d='M288 206c-30-2-62 4-88 20' strokeWidth='0.9' opacity='0.4' />

        {/* Ruled lines of type */}
        <g strokeWidth='0.9' opacity='0.34'>
          <path d='M130 122h54M130 136h50M130 150h56M130 164h44M130 178h52' />
          <path d='M216 118h54M216 132h50M216 146h56M216 160h44M216 174h52' />
        </g>

        {/* Ribbon marker */}
        <path d='M176 100v58l8-10 8 10v-62' strokeWidth='1.2' opacity='0.65' />

        {/* Lamp, off to the right */}
        <path d='M330 236v-52' strokeWidth='1.3' opacity='0.7' />
        <path d='M310 184h40l-12-26h-16z' strokeWidth='1.3' opacity='0.7' />
        <path d='M316 236h28' strokeWidth='1.3' opacity='0.7' />

        {/* Stacked volumes, off to the left */}
        <path d='M40 236v-14h52v14' strokeWidth='1.2' opacity='0.55' />
        <path d='M46 222v-13h52v13' strokeWidth='1.2' opacity='0.42' />
        <path d='M52 209v-12h52v12' strokeWidth='1.2' opacity='0.3' />
      </g>
    </svg>
  )
}
