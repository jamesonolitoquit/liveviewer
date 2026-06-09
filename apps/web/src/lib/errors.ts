const MESSAGES = {
  network: [
    'Hmm, that page did not want to load',
    'Aw man... could not reach that URL',
    'Give us a minute and try again',
    'That site seems to be taking a nap',
  ],
  audit: [
    'Audit hit a snag',
    'Woops! The audit got stuck',
    'Something went wrong during the audit',
    'The audit did not quite finish',
  ],
  export: [
    'Woops! That export slipped away',
    'Aw man... could not generate that file',
    'That export went on a coffee break',
    'The file refused to cooperate',
  ],
  llm: [
    'The AI helper got confused',
    'Brain fart in the AI module',
    'Could not get a fix suggestion right now',
    'The smart helper is taking a break',
  ],
  history: [
    'Could not fetch your audit history',
    'Aw man... the history did not load',
    'Your past audits are hiding right now',
  ],
  share: [
    'Could not create a shareable link',
    'Woops! The link did not generate',
    'Sharing is not working right now',
  ],
}

function pick(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)]
}

export function humanError(category: keyof typeof MESSAGES): string {
  return pick(MESSAGES[category])
}
