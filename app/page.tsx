// Public landing page: hero, subjects, how it works, an optional pilot voice clip and the closing
// call to action. Few words, lots of motion. The daily problem lives on the student home.

import type { Metadata } from 'next';
import { FinalCta, SiteFooter } from '@/components/landing/final-cta';
import { Hero, SiteHeader } from '@/components/landing/hero';
import { HowItWorks } from '@/components/landing/how-it-works';
import { SubjectBento } from '@/components/landing/subject-bento';
import { VoiceClip } from '@/components/landing/voice-clip';

export const metadata: Metadata = {
  title: { absolute: 'Gained · Learning that pays off' },
  description:
    'Online tutoring in any subject where your payment is held through PayPal until a short quiz shows real progress. What isn’t earned comes back to you.',
};

export default function LandingPage() {
  return (
    <div className="flex-1 overflow-x-clip">
      <SiteHeader />
      <main>
        <Hero />
        <SubjectBento />
        <HowItWorks />
        <VoiceClip />
        <FinalCta />
      </main>
      <SiteFooter />
    </div>
  );
}
