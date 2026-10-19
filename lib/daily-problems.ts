// The problem of the day on the student home. One per local calendar day, cycling through this list,
// interleaved so consecutive days land on different subjects. Use $...$ for KaTeX.
// `answer` is the index of the correct option.

export type DailyProblem = {
  topic: string;
  question: string;
  options: string[];
  answer: number;
  solution: string;
};

export const DAILY_PROBLEMS: DailyProblem[] = [
  {
    topic: 'Biology · Cells',
    question: 'Which organelle produces most of a cell’s ATP?',
    options: ['Nucleus', 'Ribosome', 'Mitochondrion', 'Golgi apparatus'],
    answer: 2,
    solution: 'Mitochondria run cellular respiration, turning glucose and oxygen into ATP.',
  },
  {
    topic: 'Algebra · Quadratics',
    question: 'What is the larger root of $x^2 - 5x + 6 = 0$?',
    options: ['$1$', '$2$', '$3$', '$6$'],
    answer: 2,
    solution: '$x^2 - 5x + 6 = (x-2)(x-3)$, so the roots are $2$ and $3$.',
  },
  {
    topic: 'Spanish · Vocabulary',
    question: 'What does “la biblioteca” mean?',
    options: ['The bookstore', 'The library', 'The Bible', 'The ballot'],
    answer: 1,
    solution: '“Biblioteca” is a false friend: a bookstore is “la librería”.',
  },
  {
    topic: 'History · U.S.',
    question: 'In what year was the Declaration of Independence adopted?',
    options: ['1765', '1776', '1787', '1791'],
    answer: 1,
    solution: 'July 4, 1776. The Constitution came later, in 1787.',
  },
  {
    topic: "Physics · Newton's laws",
    question: 'What net force accelerates a $5\\ \\text{kg}$ box at $4\\ \\text{m/s}^2$?',
    options: ['$1.25\\ \\text{N}$', '$9\\ \\text{N}$', '$20\\ \\text{N}$', '$25\\ \\text{N}$'],
    answer: 2,
    solution: '$F = ma = 5 \\times 4 = 20\\ \\text{N}$',
  },
  {
    topic: 'English · Figurative language',
    question: 'Which sentence uses a simile?',
    options: [
      'The classroom was a zoo.',
      'Her laugh was like a bell.',
      'The wind whispered through the trees.',
      'I’ve told you a million times.',
    ],
    answer: 1,
    solution: 'A simile compares with “like” or “as”. The others are a metaphor, personification and hyperbole.',
  },
  {
    topic: 'Chemistry · Balancing',
    question: 'Balance it: $2\\text{H}_2 + \\text{O}_2 \\rightarrow\\ ?\\ \\text{H}_2\\text{O}$',
    options: ['$1$', '$2$', '$3$', '$4$'],
    answer: 1,
    solution: 'Four H atoms and two O atoms on the left make $2\\,\\text{H}_2\\text{O}$ on the right.',
  },
  {
    topic: 'Computer Science · Binary',
    question: 'What is the binary number $1010_2$ in decimal?',
    options: ['$5$', '$10$', '$12$', '$1010$'],
    answer: 1,
    solution: '$1\\cdot8 + 0\\cdot4 + 1\\cdot2 + 0\\cdot1 = 10$',
  },
  {
    topic: 'Economics · Basics',
    question: 'You skip a $20 shift to study. What is the opportunity cost of studying?',
    options: ['Nothing, studying is free', 'The $20 you didn’t earn', 'The cost of your textbooks', 'Your tuition'],
    answer: 1,
    solution: 'Opportunity cost is the value of the best alternative you gave up: the $20.',
  },
  {
    topic: 'Calculus · Derivatives',
    question: 'If $f(x) = x^3$, what is $f\'(2)$?',
    options: ['$6$', '$8$', '$12$', '$24$'],
    answer: 2,
    solution: "$f'(x) = 3x^2$, so $f'(2) = 3 \\times 4 = 12$.",
  },
  {
    topic: 'French · Phrases',
    question: 'What does “Je ne sais pas” mean?',
    options: ['I am not hungry', 'I don’t know', 'I can’t see', 'I’m not sure yet'],
    answer: 1,
    solution: '“Savoir” is to know, so “je ne sais pas” is “I don’t know”.',
  },
  {
    topic: 'Biology · Genetics',
    question: 'In DNA, adenine pairs with which base?',
    options: ['Cytosine', 'Guanine', 'Thymine', 'Uracil'],
    answer: 2,
    solution: 'A pairs with T and C pairs with G. Uracil replaces thymine only in RNA.',
  },
  {
    topic: 'Physics · Energy',
    question: 'What is the kinetic energy of a $2\\ \\text{kg}$ ball moving at $3\\ \\text{m/s}$?',
    options: ['$3\\ \\text{J}$', '$6\\ \\text{J}$', '$9\\ \\text{J}$', '$18\\ \\text{J}$'],
    answer: 2,
    solution: '$E = \\tfrac12 mv^2 = \\tfrac12 \\times 2 \\times 3^2 = 9\\ \\text{J}$',
  },
  {
    topic: 'Writing · Vocabulary',
    question: 'Which word means the same as “ephemeral”?',
    options: ['Eternal', 'Short-lived', 'Mysterious', 'Delicate'],
    answer: 1,
    solution: 'From the Greek for “lasting a day”: ephemeral things don’t last.',
  },
  {
    topic: 'History · World',
    question: 'In what year did the Berlin Wall fall?',
    options: ['1961', '1979', '1989', '1991'],
    answer: 2,
    solution: 'November 9, 1989. It went up in 1961; the Soviet Union dissolved in 1991.',
  },
  {
    topic: 'Chemistry · Elements',
    question: 'What is the chemical symbol for sodium?',
    options: ['S', 'So', 'Sd', 'Na'],
    answer: 3,
    solution: 'Na, from its Latin name “natrium”. S is sulfur.',
  },
  {
    topic: 'Geometry · Pythagoras',
    question: 'A right triangle has legs of $6$ and $8$. How long is the hypotenuse?',
    options: ['$10$', '$12$', '$14$', '$48$'],
    answer: 0,
    solution: '$c = \\sqrt{6^2 + 8^2} = \\sqrt{100} = 10$',
  },
  {
    topic: 'Computer Science · Python',
    question: 'What does print(len("hello")) output?',
    options: ['4', '5', '6', 'hello'],
    answer: 1,
    solution: 'len counts the characters in the string: h, e, l, l, o is 5.',
  },
  {
    topic: 'English · Grammar',
    question: 'Choose the correct word: “Each of the students ___ a laptop.”',
    options: ['have', 'has', 'are having', 'were having'],
    answer: 1,
    solution: '“Each” is singular, so the verb is singular: “Each … has”.',
  },
  {
    topic: 'Physics · Circuits',
    question: 'A $12\\ \\text{V}$ battery drives current through a $4\\ \\Omega$ resistor. What is the current?',
    options: ['$0.33\\ \\text{A}$', '$3\\ \\text{A}$', '$16\\ \\text{A}$', '$48\\ \\text{A}$'],
    answer: 1,
    solution: '$I = \\dfrac{V}{R} = \\dfrac{12}{4} = 3\\ \\text{A}$',
  },
  {
    topic: 'Economics · Markets',
    question: 'The price of concert tickets rises and fewer people buy them. Which idea does this show?',
    options: ['The law of demand', 'Inflation', 'The law of supply', 'A monopoly'],
    answer: 0,
    solution: 'The law of demand: as price goes up, the quantity people want to buy goes down.',
  },
  {
    topic: 'Spanish · Verbs',
    question: 'Complete it: “Ayer yo ___ al cine.” (Yesterday I went to the movies.)',
    options: ['voy', 'iba', 'fui', 'iré'],
    answer: 2,
    solution: 'A single finished action in the past takes the preterite: “fui”.',
  },
  {
    topic: 'Algebra · Logarithms',
    question: 'What is $\\log_2 32$?',
    options: ['$4$', '$5$', '$6$', '$16$'],
    answer: 1,
    solution: '$2^5 = 32$, so $\\log_2 32 = 5$.',
  },
  {
    topic: 'Biology · Ecology',
    question: 'In a food chain, what are plants called?',
    options: ['Consumers', 'Decomposers', 'Producers', 'Predators'],
    answer: 2,
    solution: 'Plants make their own food by photosynthesis, so they are producers.',
  },
  {
    topic: 'Test Prep · SAT Reading',
    question: 'A passage calls a plan “quixotic.” The author most likely sees the plan as…',
    options: ['Practical and cheap', 'Idealistic but unrealistic', 'Dangerous and illegal', 'Old-fashioned'],
    answer: 1,
    solution: 'From Don Quixote, who tilted at windmills: noble in spirit, impractical in fact.',
  },
  {
    topic: 'Calculus · Integrals',
    question: 'Evaluate $\\displaystyle\\int_0^2 2x\\,dx$.',
    options: ['$2$', '$4$', '$8$', '$16$'],
    answer: 1,
    solution: '$\\int 2x\\,dx = x^2$, and $2^2 - 0^2 = 4$.',
  },
];
