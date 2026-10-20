// The words of every email the app sends. Pure functions (no database, no sending), so they're
// tested; lib/notify.ts picks the recipients and sends them.

import { formatUsd } from './escrow-states';

type Mail = { subject: string; text: string };

const first = (name: string) => name.split(' ')[0];
const when = (d: Date) =>
  d.toLocaleString('en-US', { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
const sign = '\n\nGained';

export function bookedEmail(p: {
  to: 'payer' | 'student' | 'tutor';
  subject: string;
  studentName: string;
  tutorName: string;
  startAt: Date;
  priceCents: number;
  link: string;
}): Mail {
  const at = when(p.startAt);
  if (p.to === 'tutor') {
    return {
      subject: `New booking: ${p.subject} with ${p.studentName}`,
      text: `${p.studentName} booked ${p.subject} with you for ${at}.\n\nThe ${formatUsd(p.priceCents)} is held in PayPal. Open the session room from your home screen when it's time:\n${p.link}${sign}`,
    };
  }
  if (p.to === 'student') {
    return {
      subject: `You're booked: ${p.subject} with ${first(p.tutorName)}`,
      text: `Hi ${first(p.studentName)},\n\nYou have ${p.subject} with ${p.tutorName} on ${at}.\n\nWe'll email you a short warm-up quiz before it starts, so your progress can be measured.${sign}`,
    };
  }
  return {
    subject: `Booked: ${p.subject} with ${p.tutorName}`,
    text: `${p.subject} with ${p.tutorName} is booked for ${at}.\n\n${formatUsd(p.priceCents)} is held in PayPal, not charged. The tutor gets 80% after the session; quizzes decide the rest, and what isn't earned comes back to you.\n\n${p.link}${sign}`,
  };
}

export function quizEmail(p: {
  kind: 'baseline' | 'post' | 'retention';
  studentName: string;
  subject: string;
  tutorName: string;
  link: string;
  closesAt: Date | null;
}): Mail {
  const hi = `Hi ${first(p.studentName)},\n\n`;
  const closes = p.closesAt ? `\n\nIt's open until ${when(p.closesAt)}.` : '';
  if (p.kind === 'baseline') {
    return {
      subject: `Warm-up quiz for ${p.subject}`,
      text: `${hi}Before your ${p.subject} session with ${first(p.tutorName)}, take a 5-question warm-up. It shows where you're starting, so your progress can be measured. Under 5 minutes.\n\n${p.link}${closes}${sign}`,
    };
  }
  if (p.kind === 'post') {
    return {
      subject: `Your ${p.subject} quiz is ready`,
      text: `${hi}Here's your quiz on what you covered with ${first(p.tutorName)}: 5 fresh questions, under 5 minutes.\n\n${p.link}${closes}${sign}`,
    };
  }
  return {
    subject: `48-hour check-in: ${p.subject}`,
    text: `${hi}One last short quiz to show what stuck from your ${p.subject} session.\n\n${p.link}${closes}${sign}`,
  };
}

export function topicsReadyEmail(p: { tutorName: string; studentName: string; subject: string; link: string }): Mail {
  return {
    subject: `Confirm topics: ${p.subject} with ${p.studentName}`,
    text: `Hi ${first(p.tutorName)},\n\nThe topic list from your session with ${p.studentName} is ready. Check it and confirm, so the quiz can be written:\n${p.link}${sign}`,
  };
}

export function confirmHappenedEmail(p: { tutorName: string; subject: string; link: string }): Mail {
  return {
    subject: `Did your ${p.subject} session happen?`,
    text: `${p.tutorName} ended the ${p.subject} session. Confirm it happened to pay the 80% base; it's confirmed automatically after 24 hours.\n\n${p.link}${sign}`,
  };
}

export function settledEmail(p: {
  to: 'payer' | 'tutor';
  subject: string;
  studentName: string;
  tutorName: string;
  baseCents: number;
  bonusCents: number;
  returnedCents: number;
  link: string;
}): Mail {
  if (p.to === 'tutor') {
    return {
      subject: `Paid: ${p.subject} with ${p.studentName}`,
      text: `Your session with ${p.studentName} has settled.\n\nBase: ${formatUsd(p.baseCents)}\nLearning bonus: ${formatUsd(p.bonusCents)}\n\nPayouts go to your PayPal email, minus the platform fee.\n${p.link}${sign}`,
    };
  }
  return {
    subject: `Results: ${p.subject} with ${p.tutorName}`,
    text: `The ${p.subject} session with ${p.tutorName} has settled.\n\nBase to the tutor: ${formatUsd(p.baseCents)}\nLearning bonus: ${formatUsd(p.bonusCents)}\nBack to you: ${formatUsd(p.returnedCents)}\n\nSee ${first(p.studentName)}'s scores and how every answer was graded:\n${p.link}${sign}`,
  };
}

/** Confirms the address after sign-up. */
export function verifyEmailMessage(p: { name: string; link: string }): Mail {
  return {
    subject: 'Confirm your email for Gained',
    text: `Hi ${first(p.name)},\n\nConfirm your email so family members can link to your account:\n${p.link}\n\nThe link works for 3 days. If you didn't create a Gained account, you can ignore this email.${sign}`,
  };
}

/** A link to choose a password. `claim`: first set-up of a child account a parent created. */
export function setPasswordMessage(p: { name: string; link: string; claim: boolean }): Mail {
  if (p.claim) {
    return {
      subject: 'Set your password for Gained',
      text: `Hi ${first(p.name)},\n\nYour account is ready. Choose a password to finish setting it up:\n${p.link}\n\nThe link works for 2 hours. If you didn't ask for this, ignore this email and nothing changes.${sign}`,
    };
  }
  return {
    subject: 'Reset your Gained password',
    text: `Hi ${first(p.name)},\n\nChoose a new password here:\n${p.link}\n\nThe link works for 2 hours, once. If you didn't ask to reset your password, ignore this email; your password stays the same.${sign}`,
  };
}

/** Someone made a family link. `to` is the other person. */
export function familyEmail(p: {
  kind: 'parent-added-you' | 'student-added-you' | 'account-created' | 'invited' | 'parent-joined';
  toName: string;
  byName: string;
  link: string;
}): Mail {
  switch (p.kind) {
    case 'parent-added-you':
      return {
        subject: `${p.byName} added you to their family`,
        text: `Hi ${first(p.toName)},\n\n${p.byName} added you to their family on Gained. They can now book sessions for you and see your results.\n\n${p.link}${sign}`,
      };
    case 'student-added-you':
      return {
        subject: `${p.byName} added you as their parent`,
        text: `${p.byName} added you as their parent on Gained. They're now in your family, so you can book sessions for them.\n\n${p.link}${sign}`,
      };
    case 'account-created':
      return {
        subject: `${p.byName} set up Gained for you`,
        text: `Hi ${first(p.toName)},\n\n${p.byName} added you on Gained, where tutoring is paid for by what you actually learn. Quiz links will come to this email.\n\nTo see your sessions, daily problem and streak, create your password with this email:\n${p.link}${sign}`,
      };
    case 'invited':
      return {
        subject: `${p.byName} added you as their parent on Gained`,
        text: `${p.byName} added you as their parent on Gained, where tutoring is paid for by what they actually learn.\n\nCreate an account with this email and they'll already be in your family:\n${p.link}${sign}`,
      };
    case 'parent-joined':
      return {
        subject: `${p.byName} joined Gained`,
        text: `Hi ${first(p.toName)},\n\n${p.byName} created their account, so you're now in their family. They can book sessions for you.\n\n${p.link}${sign}`,
      };
  }
}
