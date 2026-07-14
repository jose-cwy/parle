/**
 * Terms & Safety Agreement — shown before signup.
 * Bump TERMS_VERSION in lib/termsVersion.js when this content changes materially.
 */

export const SAFETY_AGREEMENT_INTRO = {
  title: 'Before you enter your private space',
  subtitle: 'Please read through the safety terms to continue',
  checkboxLabel: 'I have read and agree to the Terms & Safety Agreement.',
  acceptLabel: 'I Accept',
  signupConsentNote:
    "By creating an account you agree to parlé's Terms and Conditions, including the use of anonymised conversation data to improve our AI.",
}

export const safetyAgreementSections = [
  {
    id: 'not-therapy',
    title: 'parlé is not therapy',
    body: [
      'parlé is not a therapist, counsellor, mental health clinic, emergency service, or substitute for professional help.',
      'It is a supportive tool to help you process heartbreak, write your thoughts, reflect, and feel less alone — not a medical or clinical service.',
    ],
  },
  {
    id: 'emergency',
    title: 'Emergency and crisis disclaimer',
    body: [
      'If you are in danger, thinking about suicide or self-harm, or worried you might harm someone else, stop using this app and reach out to someone you trust or contact emergency services immediately.',
      'In Singapore, you can reach:',
      '- Samaritans of Singapore (SOS): 1-767 (24 hours)',
      '- Institute of Mental Health (IMH) Crisis Line: 6389 2222 (24 hours)',
      '- Chat Safespace (for youth): chat.mentalhealth.sg',
      'If you are outside Singapore, please contact your local emergency number or crisis line.',
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
    id: 'journal-privacy',
    title: 'Journal privacy',
    body: [
      'Your journal is designed as your private writing space and is not shown in the admin interface.',
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
      'You are responsible for how you use parlé and for seeking professional help when you need it.',
      'By creating an account, you confirm you understand these boundaries and agree to use the platform safely and respectfully.',
    ],
  },
  {
    id: 'what-we-collect',
    title: 'What we collect',
    body: [
      'Guests: You can chat without an account. Chats are not saved to a parlé profile, but messages are processed by our servers and AI provider to generate replies. Anonymised excerpts may be used to improve parlé. A hashed IP address is also used to enforce daily limits.',
      'Logged-in users: We store your account details, chat history, journal entries, and saved quotes so the service works. Anonymised conversation excerpts may also be used to improve parlé.',
      'Guest email: If you provide an email, we store it only to send an optional follow-up.',
    ],
  },
  {
    id: 'how-we-use-conversations',
    title: 'How we use your conversations',
    body: [
      'We may use anonymised conversation excerpts to improve Parlé’s AI and make its responses more supportive.',
      'Trusted service providers may process data to run the platform, including AI replies, email, and hosting. We never sell your data or share it with advertisers.',
      'What we do:',
      '- Remove common identifying details',
      '- Encrypt saved chats and journal entries',
      '- Never sell your data',
      '- Never share data with advertisers',
      '- Use providers only to operate Parlé',
      'What this means for you:',
      'By using Parlé, you agree that anonymised excerpts may be used to improve the service. You can clear chat history anytime or request account deletion through the contact page.',
    ],
  },
  {
    id: 'your-choices',
    title: 'Your choices',
    body: [
      'You can manage your privacy settings at any time:',
      '1. Conversation memory - lets Parlé remember your previous session',
      '2. Personalisation - lets Parlé learn how you prefer to communicate',
      'Turning personalisation off stops further preference learning immediately.',
    ],
  },
]

/** @deprecated Use safetyAgreementSections — kept for /terms page import compatibility */
export const termsSections = safetyAgreementSections.map((s) => ({
  title: s.title,
  body: s.body.join(' '),
}))
