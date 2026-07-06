const titleBackgroundWebpUrl = `${import.meta.env.BASE_URL}assets/title/deduction-hero-bg.webp`
const titleBackgroundPngUrl = `${import.meta.env.BASE_URL}assets/title/deduction-hero-bg.png`
const titleBackgroundImage = `image-set(url(${titleBackgroundWebpUrl}) type("image/webp"), url(${titleBackgroundPngUrl}) type("image/png"))`

export function GameBackdrop() {
  return (
    <div className="fixed inset-0 z-0 overflow-hidden bg-slate-950" aria-hidden="true">
      <div
        className="absolute inset-0 bg-cover bg-center opacity-95"
        style={{ backgroundImage: titleBackgroundImage }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_20%,rgba(251,191,36,0.36),transparent_24%),radial-gradient(circle_at_82%_25%,rgba(244,114,182,0.34),transparent_26%),radial-gradient(circle_at_50%_38%,rgba(34,211,238,0.34),transparent_36%),radial-gradient(circle_at_35%_78%,rgba(134,239,172,0.24),transparent_28%),radial-gradient(circle_at_70%_76%,rgba(168,85,247,0.26),transparent_26%),linear-gradient(180deg,rgba(2,6,23,0.48)_0%,rgba(15,23,42,0.30)_42%,rgba(2,6,23,0.88)_100%)]" />
      <div className="home-whimsy-sky">
        <span className="home-whimsy-rainbow" />
        <span className="home-whimsy-moon" />
        <span className="home-whimsy-cloud home-whimsy-cloud-one" />
        <span className="home-whimsy-cloud home-whimsy-cloud-two" />
        <span className="home-whimsy-orb home-whimsy-orb-one" />
        <span className="home-whimsy-orb home-whimsy-orb-two" />
        <span className="home-whimsy-sparkle home-whimsy-sparkle-one" />
        <span className="home-whimsy-sparkle home-whimsy-sparkle-two" />
        <span className="home-whimsy-sparkle home-whimsy-sparkle-three" />
        <span className="home-whimsy-sparkle home-whimsy-sparkle-four" />
        <span className="home-whimsy-card home-whimsy-card-one" />
        <span className="home-whimsy-card home-whimsy-card-two" />
        <span className="home-whimsy-card home-whimsy-card-three" />
        <span className="home-whimsy-token home-whimsy-token-bird" />
        <span className="home-whimsy-token home-whimsy-token-leaf" />
      </div>
      <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-slate-950 via-slate-950/62 to-transparent" />
    </div>
  )
}
