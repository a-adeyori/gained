// Two rows of subjects drifting in opposite directions; pauses on hover.

import styles from './landing.module.css';

const ROW_A = [
  'Algebra',
  'Essay writing',
  'Chemistry',
  'Spanish',
  'U.S. History',
  'Calculus',
  'Biology',
  'Python',
  'SAT & ACT prep',
  'Physics',
  'French',
  'Economics',
];
const ROW_B = [
  'Reading comprehension',
  'Geometry',
  'Organic chemistry',
  'World History',
  'AP Biology',
  'Java',
  'Grammar',
  'Statistics',
  'Spanish conversation',
  'Kinematics',
  'Macroeconomics',
  'Literature',
];

function Row({ items, reverse }: { items: string[]; reverse?: boolean }) {
  const track = (hidden: boolean) => (
    <ul className={styles.marqueeTrack} aria-hidden={hidden || undefined}>
      {items.map((item) => (
        <li
          key={item}
          className="whitespace-nowrap rounded-full border border-line-strong bg-card/50 px-4 py-2 text-sm text-ink-soft backdrop-blur"
        >
          {item}
        </li>
      ))}
    </ul>
  );
  return (
    <div className={`${styles.marquee} ${reverse ? styles.marqueeReverse : ''}`}>
      {track(false)}
      {track(true)}
    </div>
  );
}

export function TopicMarquee() {
  return (
    <div className="space-y-3" role="group" aria-label="Subjects tutors cover">
      <Row items={ROW_A} />
      <Row items={ROW_B} reverse />
    </div>
  );
}
