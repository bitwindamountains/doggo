// English copy. Every string must pass the copy rules in docs/PRD.md §7 (copyRules.test.ts):
// the dog asks or invites, never blames. `{name}` is the dog's name.

export const en = {
  // §10 Lines (speech/caption under the dog)
  'leash.0': '{name} brought you the leash.',
  'leash.1': '{name} is sitting by the door, tail going.',
  'playBow.0': '{name} did a little play bow. Stretch?',
  'playBow.1': '{name} is wiggling, ready for a quick stretch.',
  'ball.0': '{name} dropped a ball by your phone.',
  'ball.1': '{name} nudged a ball toward you.',
  'bored.0': '{name} flopped down with a big sigh.',
  'bored.1': '{name} is lying by the toy box, chin on paws.',
  'water.0': "{name}'s bowl is getting low. Drink together?",
  'water.1': '{name} is peeking at the water bowl. Glass of water?',
  'bedtime.0': '{name} is yawning and heading to bed.',
  'bedtime.1': '{name} picked up their blanket. Bedtime soon.',
  'sleeping.0': 'Shh. {name} is asleep.',
  'sleeping.1': '{name} is curled up, dreaming.',
  'resting.0': '{name} is napping in a sunny spot.',
  'resting.1': '{name} is resting, one ear up.',
  'sniffing.0': '{name} is sniffing around the room.',
  'sniffing.1': '{name} found something interesting under the couch.',
  'excited.0': '{name} is bouncing around the room!',
  'excited.1': '{name} has the zoomies!',
  'idle.0': '{name} is looking at you.',
  'greetBig.0': "You're back!",
  'greetBig.1': "{name} is spinning in circles. You're home!",
  'greetSmall.0': "{name}'s tail is wagging.",
  'greetSmall.1': '{name} trotted over to say hi.',
  'headRest.0': '{name} came over and rested their head on you.',
  'rung1.0': "{name}'s ears perked up.",

  // §9 Push notifications (body max 60 characters with a 24-character name)
  'push.leash.0': '{name} brought you the leash.',
  'push.leash.1': '{name} is by the door with the leash.',
  'push.playBow.0': '{name} did a little play bow. Stretch?',
  'push.playBow.1': '{name} wants a quick stretch with you.',
  'push.ball.0': '{name} dropped a ball by your phone.',
  'push.ball.1': '{name} has a ball and a hopeful look.',
  'push.bored.0': '{name} flopped down with a big sigh.',
  'push.bedtime.0': '{name} is yawning and heading to bed.',
  'push.bedtime.1': '{name} is curling up. Bedtime soon.',
  'push.action.leash': "Let's walk",
  'push.action.playBow': 'Stretch',
  'push.action.ball': 'Put phone down',
  'push.action.bedtime': 'Goodnight',

  // Screen-reader descriptions of the dog (PRD F2)
  'a11y.leash': '{name} is holding the leash and looking at you',
  'a11y.playBow': '{name} is doing a play bow, inviting you to stretch',
  'a11y.ball': '{name} dropped a ball near your phone and is waiting',
  'a11y.bored': '{name} is lying down with a big sigh',
  'a11y.water': '{name} is looking at a water bowl that is getting low',
  'a11y.bedtime': '{name} is yawning and walking to bed',
  'a11y.sleeping': '{name} is asleep',
  'a11y.resting': '{name} is resting',
  'a11y.idle': '{name} is looking at you',
  'a11y.sniffing': '{name} is sniffing around the room',
  'a11y.excited': '{name} is bouncing around, full of energy',

  // §9 Back-off question after 3 ignored days
  'nudges.frequencyQuestion': 'Should I check in less often?',
} as const;

export type CopyKey = keyof typeof en;
