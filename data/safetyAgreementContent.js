/**
 * Terms & Safety Agreement — shown before signup.
 * Bump TERMS_VERSION in lib/auth.js when this content changes materially.
 */

export const SAFETY_AGREEMENT_INTRO = {
  title: 'Before you enter your private space',
  subtitle: 'Please read through the safety terms to continue',
  checkboxLabel: 'I have read and agree to the Terms & Safety Agreement.',
  acceptLabel: 'I Accept',
}

export const safetyAgreementSections = [
  {
    id: 'not-therapy',
    title: 'Heartstrings Club is not therapy',
    body: [
      'Heartstrings Club is not a therapist, counsellor, mental health clinic, emergency service, or substitute for professional help.',
      'It is a supportive tool to help you process heartbreak, write your thoughts, reflect, and feel less alone — not a medical or clinical service.',
    ],
  },
  {
    id: 'emergency',
    title: 'Emergency and crisis disclaimer',
    body: [
      'If you are in danger, thinking about suicide or self-harm, or worried you might harm someone else, stop using this app and contact emergency services or a trusted person immediately.',
      'In the U.S., you can call or text 988 for the Suicide & Crisis Lifeline. If you are outside the U.S., use your local emergency number or crisis line.',
    ],
  },
  {
    id: 'no-crisis-content',
    title: 'No suicidal or self-harm content',
    body: [
      'Suicidal talk, self-harm planning, threats of harm, or other crisis content is not tolerated in the chatbot. This app is not designed to handle emergencies.',
      'If such content is detected, the chatbot will respond with a safety message and encourage you to seek immediate real-world help instead of continuing a normal conversation.',
    ],
  },
  {
    id: 'no-romantic-ai',
    title: 'No online dating or romantic relationship with the chatbot',
    body: [
      'The AI chatbot is not a romantic partner, dating partner, boyfriend, girlfriend, or emotional replacement for a real person.',
      'You must not use the chatbot for online dating, romantic dependency, sexual conversations, or simulated romantic relationships.',
    ],
  },
  {
    id: 'diary-privacy',
    title: 'Diary privacy',
    body: [
      'Your diary is designed as your private writing space and is not shown in the admin interface.',
      'Entries are only accessible through your logged-in account and are meant for your personal reflection.',
    ],
  },
  {
    id: 'respectful-use',
    title: 'Respectful use',
    body: [
      'You agree not to abuse, exploit, attack, or misuse the platform — including attempts to break into accounts, overload the service, or use it to harm others.',
    ],
  },
  {
    id: 'ai-limits',
    title: 'AI limitations',
    body: [
      'AI responses may not always be accurate, complete, or suitable for every situation. They can be wrong, outdated, or miss important context.',
      'Use your own judgment. Do not rely on the chatbot for decisions that need a qualified professional.',
    ],
  },
  {
    id: 'responsibility',
    title: 'Your responsibility',
    body: [
      'You are responsible for how you use Heartstrings Club and for seeking professional help when you need it.',
      'By creating an account, you confirm you understand these boundaries and agree to use the platform safely and respectfully.',
    ],
  },
]

/** @deprecated Use safetyAgreementSections — kept for /terms page import compatibility */
export const termsSections = safetyAgreementSections.map((s) => ({
  title: s.title,
  body: s.body.join(' '),
}))
