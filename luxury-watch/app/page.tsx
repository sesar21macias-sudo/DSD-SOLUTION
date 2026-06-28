import ScrollHero from './components/ScrollHero'
import TransitionBand from './components/TransitionBand'
import FeaturesSection from './components/FeaturesSection'
import SpecsSection from './components/SpecsSection'
import ClosingCTA from './components/ClosingCTA'

export default function Home() {
  return (
    <main style={{ background: '#000' }}>
      <ScrollHero />
      <TransitionBand />
      <FeaturesSection />
      <SpecsSection />
      <ClosingCTA />
    </main>
  )
}
