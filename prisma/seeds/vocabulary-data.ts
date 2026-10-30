// Vocabulary for the Daily English Gate (B2 Destination, vocabulary units).
// Headwords follow the book's unit lists; the meanings and example sentences are
// short, original ones. Every example contains its `word` exactly as written, so
// the quiz can blank it out (checked by vocabulary-data.spec.ts).
// Run with node --experimental-strip-types, so keep to erasable TypeScript only.

export type Section =
  | 'TOPIC_CONTRAST'
  | 'PHRASAL_VERB'
  | 'PHRASE_COLLOCATION'
  | 'WORD_PATTERN'
  | 'WORD_FORMATION';

export interface Entry {
  word: string;
  meaning: string;
  example: string;
  /** Easily confused words (TOPIC_CONTRAST). */
  contrast?: string;
  /** Derived words (WORD_FORMATION), the first one is the main answer. */
  forms?: string;
  /** Grammar pattern (WORD_PATTERN). */
  pattern?: string;
}

export interface UnitData {
  unitNumber: number;
  topic: string;
  sections: Record<Section, Entry[]>;
}

const contrast = (
  word: string,
  others: string,
  meaning: string,
  example: string,
): Entry => ({ word, contrast: others, meaning, example });
const phrasal = (word: string, meaning: string, example: string): Entry => ({
  word,
  meaning,
  example,
});
const collocation = (
  word: string,
  meaning: string,
  example: string,
): Entry => ({
  word,
  meaning,
  example,
});
const pattern = (
  word: string,
  grammar: string,
  meaning: string,
  example: string,
): Entry => ({ word, pattern: grammar, meaning, example });
const formation = (
  word: string,
  forms: string,
  meaning: string,
  example: string,
): Entry => ({ word, forms, meaning, example });

const emptySections = (): Record<Section, Entry[]> => ({
  TOPIC_CONTRAST: [],
  PHRASAL_VERB: [],
  PHRASE_COLLOCATION: [],
  WORD_PATTERN: [],
  WORD_FORMATION: [],
});

/* -------------------------------------------------------------------------- */
/* Unit 2: Travel and transport                                               */
/* -------------------------------------------------------------------------- */

const unit2: UnitData = {
  unitNumber: 2,
  topic: 'Travel and transport',
  sections: {
    TOPIC_CONTRAST: [
      contrast(
        'voyage',
        'journey / trip / travel / excursion',
        'a long journey by sea or in space',
        'The voyage across the Atlantic took nearly two weeks.',
      ),
      contrast(
        'fare',
        'ticket / fee',
        'the money you pay to travel by bus, train or plane',
        'The bus fare into the city centre is two pounds.',
      ),
      contrast(
        'stay',
        'live',
        'to spend a short time in a place as a guest or visitor',
        'We will stay in a small hotel near the beach.',
      ),
      contrast(
        'sight',
        'view',
        'something interesting that tourists go to see',
        'The Eiffel Tower is the most famous sight in Paris.',
      ),
      contrast(
        'miss',
        'lose',
        'to arrive too late to catch a bus, train or plane',
        'If we do not hurry, we will miss the last train.',
      ),
      contrast(
        'border',
        'edge / line',
        'the official line between two countries',
        'You need a passport to cross the border.',
      ),
      contrast(
        'world',
        'earth',
        'all the countries and people on the planet',
        'She dreams of travelling round the world.',
      ),
      contrast(
        'take',
        'bring / go',
        'to carry or accompany someone to another place',
        'Can you take me to the airport tomorrow morning?',
      ),
      contrast(
        'distance',
        'length',
        'the amount of space between two places',
        'The distance from Paris to Lyon is about 460 kilometres.',
      ),
      contrast(
        'territory',
        'area',
        'land that belongs to a particular country',
        'The island is British territory.',
      ),
      contrast(
        'book',
        'keep',
        'to arrange in advance to have a seat or a room',
        'We booked our flights three months ago, so book early too.',
      ),
      contrast(
        'guide',
        'lead',
        'to show tourists the way and tell them about a place',
        'A local woman will guide us through the old town.',
      ),
      contrast(
        'season',
        'period',
        'one of the parts of the year, such as summer',
        'Summer is the busiest tourist season on the coast.',
      ),
      contrast(
        'reach',
        'arrive',
        'to get to a place (no preposition follows)',
        'We hope to reach the hotel before midnight.',
      ),
      contrast(
        'native',
        'home',
        'born in a particular place or country',
        'She is a native of Vienna but lives in Rome.',
      ),
    ],
    PHRASAL_VERB: [
      phrasal(
        'catch up with',
        'to reach someone who is ahead of you',
        'Walk slowly and I will catch up with you at the station.',
      ),
      phrasal(
        'check in',
        'to register on arrival at a hotel or airport',
        'You must check in two hours before the flight.',
      ),
      phrasal(
        'check out',
        'to pay your bill and leave a hotel',
        'Guests have to check out before eleven.',
      ),
      phrasal(
        'drop off',
        'to take someone or something somewhere by car',
        'Could you drop off the children at school?',
      ),
      phrasal(
        'get back',
        'to return to a place',
        'We usually get back from holiday on Sunday night.',
      ),
      phrasal(
        'go away',
        'to leave home for a holiday',
        'We want to go away for a few days in May.',
      ),
      phrasal(
        'keep up with',
        'to stay at the same speed or level as someone',
        'It was hard to keep up with the guide on the steep path.',
      ),
      phrasal(
        'make for',
        'to move in the direction of a place',
        'After lunch we will make for the mountains.',
      ),
      phrasal(
        'pick up',
        'to collect someone or something',
        'I will pick up the tickets on my way home.',
      ),
      phrasal(
        'pull in',
        'to stop at the side of the road or at a station',
        'The train will pull in at platform four.',
      ),
      phrasal(
        'run over',
        'to hit someone or something with a vehicle',
        'Be careful not to run over the cat.',
      ),
      phrasal(
        'see off',
        'to go to a station or airport to say goodbye',
        'We went to the station to see off our friends.',
      ),
      phrasal(
        'set off',
        'to start a journey (also set out)',
        'We plan to set off at six in the morning.',
      ),
      phrasal(
        'take off',
        'when a plane leaves the ground',
        'The plane is about to take off.',
      ),
      phrasal(
        'turn round',
        'to go back the way you came',
        'We took a wrong road and had to turn round.',
      ),
    ],
    PHRASE_COLLOCATION: [
      collocation(
        'have an accident',
        'to be in an accident',
        'Drive carefully, or you may have an accident.',
      ),
      collocation(
        'in advance',
        'before something happens',
        'You should book your tickets in advance.',
      ),
      collocation(
        'go straight ahead',
        'to continue forward without turning',
        'Go straight ahead and turn left at the lights.',
      ),
      collocation(
        'ask for directions',
        'to ask how to get somewhere',
        'We got lost, so we had to ask for directions.',
      ),
      collocation(
        'head for',
        'to go towards a place',
        'We decided to head for the coast.',
      ),
      collocation(
        'on holiday',
        'away from home for a holiday',
        'They are on holiday in Greece this week.',
      ),
      collocation(
        'turn left',
        'to change direction to the left',
        'Turn left at the end of the street.',
      ),
      collocation(
        'scenic route',
        'a road chosen for its views',
        'We took the scenic route along the coast.',
      ),
      collocation(
        'see the sights',
        'to visit the interesting places of a town',
        'We spent the day trying to see the sights of Rome.',
      ),
      collocation(
        'go sightseeing',
        'to visit places of interest as a tourist',
        'Let us go sightseeing in the afternoon.',
      ),
      collocation(
        'speed limit',
        'the fastest legal speed on a road',
        'He was fined for breaking the speed limit.',
      ),
      collocation(
        'guided tour',
        'a visit led by a guide',
        'We went on a guided tour of the castle.',
      ),
      collocation(
        'go on a trip',
        'to make a short journey',
        'The class will go on a trip to the mountains.',
      ),
      collocation(
        'on the way',
        'during a journey to somewhere',
        'We bought some food on the way.',
      ),
    ],
    WORD_PATTERN: [
      pattern(
        'afraid',
        'afraid of sth/doing; afraid to do',
        'feeling fear',
        'She is afraid of flying.',
      ),
      pattern(
        'appear',
        'appear to do; appear + adjective',
        'to seem',
        'He appears to be lost.',
      ),
      pattern(
        'arrange',
        'arrange to do; arrange for sb to do',
        'to plan and organise',
        'I arranged to meet her at the station.',
      ),
      pattern(
        'arrive',
        'arrive at (a place); arrive in (a town or country)',
        'to reach a place',
        'We arrived in Paris at noon.',
      ),
      pattern(
        'continue',
        'continue to do / doing; continue with sth',
        'to keep going',
        'We continued walking until dark.',
      ),
      pattern(
        'differ',
        'differ from sth; differ in sth; differ about sth',
        'to be unlike',
        'Prices differ from shop to shop.',
      ),
      pattern(
        'dream',
        'dream of/about sth/doing',
        'to imagine something you want',
        'She dreams of living abroad.',
      ),
      pattern(
        'invite',
        'invite sb to + place or event; invite sb to do',
        'to ask someone to come',
        'They invited us to their wedding.',
      ),
      pattern(
        'keen',
        'keen on sth/doing; keen to do',
        'enthusiastic',
        'He is keen on sailing.',
      ),
      pattern(
        'live',
        'live in/at/on; live on sth; live with sb',
        'to have your home somewhere',
        'They live in a small village.',
      ),
      pattern(
        'regret',
        'regret doing; regret to say/inform',
        'to feel sorry about something',
        'I regret not buying the ticket earlier.',
      ),
      pattern(
        'think',
        'think of/about sth/doing; think that',
        'to have an idea or opinion',
        'I am thinking of going to Spain.',
      ),
      pattern(
        'write',
        'write to sb; write about sth; write sb sth',
        'to put words on paper',
        'I will write to you when I arrive.',
      ),
    ],
    WORD_FORMATION: [
      formation(
        'arrange',
        'arrangement (noun)',
        'to plan something in advance',
        'The arrangement was made two weeks ago.',
      ),
      formation(
        'arrive',
        'arrival (noun)',
        'to reach a place',
        'The arrival of the train was delayed.',
      ),
      formation(
        'broad',
        'breadth (noun); broaden (verb)',
        'wide',
        'Travel can broaden your mind.',
      ),
      formation(
        'culture',
        'cultural (adjective)',
        'the customs and arts of a society',
        'We visited several cultural sites.',
      ),
      formation(
        'differ',
        'difference (noun); different (adjective)',
        'to be unlike',
        'There is a big difference between the two cities.',
      ),
      formation(
        'direct',
        'direction (noun); directly (adverb)',
        'straight, without stopping',
        'We took a wrong direction at the crossroads.',
      ),
      formation(
        'distant',
        'distance (noun)',
        'far away',
        'The distance between the two towns is short.',
      ),
      formation(
        'enter',
        'entrance (noun); entry (noun)',
        'to go into a place',
        'The entrance to the museum is on the left.',
      ),
      formation(
        'inhabit',
        'inhabitant (noun)',
        'to live in a place',
        'The village has only fifty inhabitants.',
      ),
      formation(
        'photograph',
        'photographer (noun); photographic (adjective)',
        'a picture taken with a camera',
        'The photographer waited for the sunrise.',
      ),
      formation(
        'recognise',
        'recognition (noun)',
        'to know someone or something you have seen before',
        'The singer won recognition around the world.',
      ),
      formation(
        'time',
        'timely (adjective)',
        'a point or period',
        'They gave us timely warning of the storm.',
      ),
      formation(
        'tour',
        'tourist (noun); tourism (noun)',
        'a journey to visit several places',
        'Tourism is the main industry on the island.',
      ),
      formation(
        'world',
        'worldwide (adjective/adverb)',
        'the earth and all its countries',
        'The airline has a worldwide network of flights.',
      ),
    ],
  },
};

/* -------------------------------------------------------------------------- */
/* Unit 4: Hobbies, sport and games                                           */
/* -------------------------------------------------------------------------- */

const unit4: UnitData = {
  unitNumber: 4,
  topic: 'Hobbies, sport and games',
  sections: {
    TOPIC_CONTRAST: [
      contrast(
        'pitch',
        'track / court / course / ring / rink',
        'an area marked out for football or rugby',
        'The players ran onto the pitch.',
      ),
      contrast(
        'win',
        'beat / score',
        'to be the best in a competition',
        'Our team hopes to win the match.',
      ),
      contrast(
        'game',
        'play',
        'an activity with rules, played for fun',
        'Chess is a very old game.',
      ),
      contrast(
        'spectator',
        'viewer',
        'a person who watches a sports event',
        'Every spectator stood up to cheer the winner.',
      ),
      contrast(
        'umpire',
        'referee',
        'an official who controls a game such as tennis or cricket',
        'The umpire said the ball was out.',
      ),
      contrast(
        'final',
        'finale / end / ending',
        'the last match of a competition',
        'She played in the final of the tennis tournament.',
      ),
      contrast(
        'racket',
        'bat / stick / rod',
        'equipment with strings, used in tennis',
        'He bought a new tennis racket.',
      ),
      contrast(
        'amateur',
        'professional',
        'someone who does a sport for pleasure, not money',
        'She is an amateur golfer.',
      ),
      contrast(
        'sport',
        'athletics',
        'a physical activity with rules',
        'Football is the most popular sport in the world.',
      ),
      contrast(
        'half time',
        'interval',
        'the break in the middle of a match',
        'The score at half time was one all.',
      ),
      contrast(
        'draw',
        'equal',
        'a game that ends with the same score',
        'The match ended in a draw.',
      ),
      contrast(
        'opponent',
        'competitor',
        'the person or team you play against',
        'She beat her opponent in straight sets.',
      ),
    ],
    PHRASAL_VERB: [
      phrasal(
        'bring forward',
        'to move an event to an earlier time',
        'They decided to bring forward the final to Saturday.',
      ),
      phrasal(
        'carry on',
        'to continue',
        'Carry on playing until the whistle blows.',
      ),
      phrasal(
        'get round to',
        'to find time to do something',
        'I never get round to going to the gym.',
      ),
      phrasal(
        'get up to',
        'to do something, often something naughty',
        'What did you get up to at the weekend?',
      ),
      phrasal(
        'go in for',
        'to enter a competition',
        'She wants to go in for the swimming race.',
      ),
      phrasal(
        'go off',
        'to stop liking something; (an alarm) to ring',
        'The alarm will go off at six.',
      ),
      phrasal(
        'join in',
        'to take part in an activity',
        'Come and join in the game.',
      ),
      phrasal(
        'knock out',
        'to defeat someone so they leave the competition',
        'Our team hopes to knock out the champions.',
      ),
      phrasal('look out', 'to be careful', 'Look out! The ball is coming!'),
      phrasal(
        'pull out',
        'to withdraw from a competition',
        'The injured player had to pull out of the race.',
      ),
      phrasal(
        'put off',
        'to postpone; to discourage',
        'We had to put off the match because of the rain.',
      ),
      phrasal(
        'put up with',
        'to tolerate',
        'I cannot put up with the noise at the stadium.',
      ),
      phrasal(
        'take up',
        'to start a new hobby or activity',
        'I want to take up photography.',
      ),
      phrasal(
        'take to',
        'to begin to like',
        'I did not take to tennis at first.',
      ),
    ],
    PHRASE_COLLOCATION: [
      collocation(
        'do your best',
        'to try as hard as you can',
        'Do your best and do not worry about winning.',
      ),
      collocation(
        'stand a chance',
        'to have a possibility of success',
        'Our team does not stand a chance of winning.',
      ),
      collocation(
        'have a go',
        'to try something',
        'Let me have a go at the climbing wall.',
      ),
      collocation(
        'at the height of',
        'at the most successful point of',
        'He retired at the height of his career.',
      ),
      collocation(
        'mad about',
        'very enthusiastic about',
        'She is mad about basketball.',
      ),
      collocation(
        'take pleasure in',
        'to enjoy',
        'You should take pleasure in every small victory.',
      ),
      collocation(
        'popular with',
        'liked by many people',
        'Skateboarding is popular with teenagers.',
      ),
      collocation(
        'on the same side',
        'in the same team',
        'We played on the same side.',
      ),
      collocation(
        'talent for',
        'a natural ability to do something',
        'She has a talent for music.',
      ),
      collocation(
        'spare time',
        'time when you are not working',
        'In my spare time I play chess.',
      ),
      collocation(
        'take turns',
        'to do something one after another',
        'Players must take turns to serve.',
      ),
    ],
    WORD_PATTERN: [
      pattern(
        'compete',
        'compete with/against sb for sth; compete in sth',
        'to try to win',
        'Six teams compete for the cup.',
      ),
      pattern(
        'concentrate',
        'concentrate on sth/doing',
        'to give all your attention',
        'Concentrate on the ball.',
      ),
      pattern(
        'difficult',
        'difficult to do; it is difficult for sb to do',
        'not easy',
        'It is difficult to learn to ski.',
      ),
      pattern(
        'fond',
        'fond of sth/sb/doing',
        'liking',
        'He is fond of cycling.',
      ),
      pattern(
        'free',
        'free to do; free of/from sth',
        'allowed to; without',
        'You are free to join the club.',
      ),
      pattern(
        'interested',
        'interested in sth/doing',
        'wanting to know or do',
        'She is interested in chess.',
      ),
      pattern(
        'involve',
        'involve sb in sth; involve doing',
        'to include',
        'The game involves running a lot.',
      ),
      pattern(
        'listen',
        'listen to sb/sth',
        'to pay attention to a sound',
        'Listen to the coach.',
      ),
      pattern(
        'love',
        'love sth/doing/to do',
        'to like very much',
        'I love playing tennis.',
      ),
      pattern(
        'mean',
        'mean to do; mean doing (= involve)',
        'to intend; to involve',
        'I did not mean to hit the ball so hard.',
      ),
      pattern(
        'prefer',
        'prefer sth to sth; prefer doing to doing; prefer to do rather than do',
        'to like better',
        'I prefer swimming to running.',
      ),
      pattern(
        'stop',
        'stop doing; stop to do',
        'to end an action; to pause in order to',
        'We stopped to rest.',
      ),
      pattern(
        'sure',
        'sure of/about sth; sure to do; certain that',
        'having no doubt',
        'He is sure to win.',
      ),
    ],
    WORD_FORMATION: [
      formation(
        'allow',
        'allowance (noun)',
        'to let someone do something',
        'The weekly allowance is spent on sports gear.',
      ),
      formation(
        'associate',
        'association (noun)',
        'to connect in your mind',
        'She joined the local football association.',
      ),
      formation(
        'compete',
        'competition (noun); competitor (noun); competitive (adjective)',
        'to try to win',
        'He is a very competitive player.',
      ),
      formation(
        'enjoy',
        'enjoyment (noun); enjoyable (adjective)',
        'to get pleasure from',
        'It was an enjoyable match.',
      ),
      formation(
        'equip',
        'equipment (noun)',
        'to provide with what is needed',
        'The gym has modern equipment.',
      ),
      formation(
        'fortune',
        'fortunate (adjective); unfortunately (adverb)',
        'luck',
        'We were fortunate to win the final.',
      ),
      formation(
        'interest',
        'interested (adjective); interesting (adjective)',
        'a feeling of wanting to know more',
        'Chess is an interesting game.',
      ),
      formation(
        'know',
        'knowledge (noun)',
        'to have information in your mind',
        'He has a good knowledge of the rules.',
      ),
      formation(
        'lose',
        'loser (noun); loss (noun)',
        'to fail to win',
        'The loser shook hands with the winner.',
      ),
      formation(
        'maintain',
        'maintenance (noun)',
        'to keep in good condition',
        'The pitch needs regular maintenance.',
      ),
      formation(
        'medal',
        'medallist (noun)',
        'a prize given to a winner',
        'She is an Olympic medallist.',
      ),
      formation(
        'oppose',
        'opposition (noun); opponent (noun)',
        'to be against',
        'The opposition scored in the last minute.',
      ),
      formation(
        'practice',
        'practise (verb)',
        'repeating an activity to improve',
        'You must practise every day.',
      ),
      formation(
        'train',
        'trainer (noun); training (noun)',
        'to prepare for a sport',
        'Her trainer sets hard training sessions.',
      ),
    ],
  },
};

/* -------------------------------------------------------------------------- */
/* Unit 6: Science and technology                                             */
/* -------------------------------------------------------------------------- */

const unit6: UnitData = {
  unitNumber: 6,
  topic: 'Science and technology',
  sections: {
    TOPIC_CONTRAST: [
      contrast(
        'artificial',
        'false',
        'made by people, not natural',
        'The room is lit by artificial light.',
      ),
      contrast(
        'natural',
        'physical',
        'existing in nature, not made by people',
        'Wool is a natural material.',
      ),
      contrast(
        'accurate',
        'true',
        'exactly correct',
        'The clock gives an accurate time.',
      ),
      contrast(
        'method',
        'way',
        'a planned, systematic way of doing something',
        'Scientists use a new method to test the water.',
      ),
      contrast(
        'engine',
        'machine / motor',
        'the part of a vehicle that produces power',
        'The car has a powerful engine.',
      ),
      contrast(
        'aim',
        'cause / reason',
        'what you are trying to achieve',
        'The aim of the experiment is to measure speed.',
      ),
      contrast(
        'estimate',
        'calculate',
        'to guess a size or cost from the facts you have',
        'Engineers estimate that the bridge will cost two million.',
      ),
      contrast(
        'electronic',
        'electric',
        'using small parts such as chips to control a flow of electricity',
        'He bought an electronic dictionary.',
      ),
      contrast(
        'discover',
        'invent',
        'to find something that already existed',
        'Marie Curie helped to discover radium.',
      ),
      contrast(
        'experiment',
        'research',
        'a scientific test to see what happens',
        'The students did an experiment in the laboratory.',
      ),
      contrast(
        'progress',
        'development',
        'improvement as time passes',
        'The patient is making good progress.',
      ),
      contrast(
        'modern',
        'new',
        'of the present time; using the latest methods',
        'The hospital has modern equipment.',
      ),
      contrast(
        'factory',
        'industry',
        'a building where goods are made',
        'The factory produces five hundred cars a week.',
      ),
      contrast(
        'award',
        'reward',
        'a prize for an achievement',
        'The scientist received an award for her work.',
      ),
      contrast(
        'take place',
        'occur',
        'to happen as planned',
        'The experiment will take place on Monday.',
      ),
    ],
    PHRASAL_VERB: [
      phrasal(
        'break down',
        'to stop working',
        'The machine tends to break down in cold weather.',
      ),
      phrasal(
        'carry out',
        'to do or perform a task or test',
        'Scientists will carry out the test next week.',
      ),
      phrasal(
        'come off',
        'to succeed; to become separated',
        'The plan did not come off.',
      ),
      phrasal(
        'come on',
        'to start (a machine or light)',
        'The heating will come on at six.',
      ),
      phrasal(
        'come up with',
        'to think of an idea or answer',
        'She managed to come up with a clever solution.',
      ),
      phrasal(
        'cut off',
        'to stop the supply of something',
        'They will cut off the electricity for an hour.',
      ),
      phrasal(
        'find out',
        'to discover a fact',
        'We need to find out what caused the fault.',
      ),
      phrasal(
        'give off',
        'to produce heat, light or a smell',
        'The fire will give off a lot of smoke.',
      ),
      phrasal(
        'narrow down',
        'to reduce the number of possibilities',
        'We must narrow down the list of suspects.',
      ),
      phrasal(
        'plug in',
        'to connect a machine to the electricity supply',
        'Plug in the laptop before the battery dies.',
      ),
      phrasal(
        'put through',
        'to connect a caller by telephone',
        'The operator will put through the call to the laboratory.',
      ),
      phrasal('turn into', 'to change and become', 'Water can turn into ice.'),
      phrasal(
        'turn off',
        'to stop a machine or light',
        'Remember to turn off the computer.',
      ),
      phrasal(
        'work out',
        'to find the answer by thinking or calculating',
        'It took me an hour to work out the problem.',
      ),
    ],
    PHRASE_COLLOCATION: [
      collocation(
        'make an attempt',
        'to try to do something',
        'The team will make an attempt to repair the satellite.',
      ),
      collocation(
        'on average',
        'typically, taking all cases together',
        'On average, the battery lasts ten hours.',
      ),
      collocation(
        'at the beginning',
        'at the start',
        'At the beginning of the lesson we watched a film.',
      ),
      collocation(
        'at the bottom',
        'at the lowest part',
        'The results are listed at the bottom of the page.',
      ),
      collocation(
        'cause damage',
        'to harm something',
        'The storm could cause damage to the equipment.',
      ),
      collocation(
        'come to a conclusion',
        'to decide after thinking',
        'They hope to come to a conclusion by Friday.',
      ),
      collocation(
        'carry out an experiment',
        'to do a scientific test',
        'The class will carry out an experiment on light.',
      ),
      collocation(
        'in fact',
        'in reality',
        'In fact, the machine was invented in 1950.',
      ),
      collocation(
        'an introduction to',
        'a first presentation of a subject',
        'This book is an introduction to physics.',
      ),
      collocation(
        'make a phone call',
        'to telephone someone',
        'I need to make a phone call to the lab.',
      ),
      collocation(
        'take a photograph',
        'to make a picture with a camera',
        'Please do not take a photograph of the screen.',
      ),
      collocation(
        'do research',
        'to study a subject in detail',
        'Students must do research before the lab.',
      ),
    ],
    WORD_PATTERN: [
      pattern(
        'cause',
        'cause sth; cause sb to do; cause sb sth',
        'to make something happen',
        'The fault caused the machine to stop.',
      ),
      pattern(
        'consider',
        'consider sth/doing; consider sb/sth to be',
        'to think carefully about',
        'We are considering buying a new computer.',
      ),
      pattern(
        'discuss',
        'discuss sth (with sb)',
        'to talk about',
        'They discussed the results with the professor.',
      ),
      pattern(
        'explain',
        'explain sth (to sb); explain that/how/why',
        'to make clear',
        'She explained the idea to the class.',
      ),
      pattern(
        'intend',
        'intend to do / doing; intend sth for sb',
        'to plan',
        'They intend to launch the rocket in May.',
      ),
      pattern(
        'know',
        'know about/of sth; know how to do',
        'to have information',
        'Do you know how to use this microscope?',
      ),
      pattern(
        'look',
        'look at sth; look for sth; look like sth',
        'to direct your eyes',
        'Look at this graph.',
      ),
      pattern(
        'manage',
        'manage to do',
        'to succeed in doing',
        'He managed to fix the robot.',
      ),
      pattern(
        'plan',
        'plan to do; plan on doing; plan for sth',
        'to decide what to do',
        'We plan to build a new laboratory.',
      ),
      pattern(
        'possible',
        'it is possible (for sb) to do; possible that',
        'able to happen',
        'It is possible to travel to Mars.',
      ),
      pattern(
        'result',
        'result in sth; result from sth',
        'to be the effect or consequence',
        'The experiment resulted in a new discovery.',
      ),
      pattern(
        'wonder',
        'wonder if/whether/why; wonder at sth',
        'to want to know',
        'I wonder if the engine will start.',
      ),
    ],
    WORD_FORMATION: [
      formation(
        'appear',
        'appearance (noun); disappear (verb)',
        'to become visible',
        'The appearance of the comet surprised everyone.',
      ),
      formation(
        'build',
        'builder (noun); building (noun)',
        'to make by putting parts together',
        'The builder finished the lab in June.',
      ),
      formation(
        'discover',
        'discovery (noun); discoverer (noun)',
        'to find something new',
        'The discovery changed medicine.',
      ),
      formation(
        'explain',
        'explanation (noun); explanatory (adjective)',
        'to make something clear',
        'She gave a clear explanation of the theory.',
      ),
      formation(
        'important',
        'importance (noun)',
        'having great value or effect',
        'The importance of clean water is clear.',
      ),
      formation(
        'introduce',
        'introduction (noun); introductory (adjective)',
        'to bring in for the first time',
        'The introduction of email changed offices.',
      ),
      formation(
        'invent',
        'invention (noun); inventor (noun)',
        'to create something new',
        'The telephone was a great invention.',
      ),
      formation(
        'observe',
        'observation (noun); observer (noun)',
        'to watch carefully',
        'Careful observation led to the answer.',
      ),
      formation(
        'possible',
        'possibility (noun); impossible (adjective)',
        'able to happen',
        'There is a possibility of rain.',
      ),
      formation(
        'psychology',
        'psychologist (noun); psychological (adjective)',
        'the study of the mind',
        'She is a famous psychologist.',
      ),
      formation(
        'research',
        'researcher (noun)',
        'detailed study of a subject',
        'The researcher published her findings.',
      ),
      formation(
        'revolution',
        'revolutionary (adjective)',
        'a complete change',
        'The computer was a revolutionary invention.',
      ),
      formation(
        'science',
        'scientist (noun); scientific (adjective)',
        'the study of the natural world',
        'The scientist explained the results.',
      ),
      formation(
        'technology',
        'technological (adjective); technician (noun)',
        'practical use of scientific knowledge',
        'Technological change is fast.',
      ),
      formation(
        'wood',
        'wooden (adjective)',
        'the hard material from trees',
        'They built a wooden bridge.',
      ),
    ],
  },
};

/* -------------------------------------------------------------------------- */
/* Unit 8: The media                                                          */
/* -------------------------------------------------------------------------- */

const unit8: UnitData = {
  unitNumber: 8,
  topic: 'The media',
  sections: {
    TOPIC_CONTRAST: [
      contrast(
        'deny',
        'refuse',
        'to say that something is not true',
        'The minister will deny that he lied.',
      ),
      contrast(
        'accept',
        'agree',
        'to take an offer or invitation',
        'She decided to accept the invitation to appear on the show.',
      ),
      contrast(
        'headline',
        'heading',
        'the title of a newspaper story',
        'The headline said that the president had resigned.',
      ),
      contrast(
        'article',
        'feature',
        'a piece of writing in a newspaper or magazine',
        'I read an interesting article about robots.',
      ),
      contrast(
        'quiz show',
        'talk show / game show',
        'a programme where people answer questions to win prizes',
        'My family watches the quiz show every Friday.',
      ),
      contrast(
        'commentator',
        'announcer',
        'someone who describes a sports event as it happens',
        'The commentator described the final goal.',
      ),
      contrast(
        'tabloid',
        'broadsheet',
        'a newspaper with small pages and short, lively stories',
        'The tabloid printed a photo of the singer.',
      ),
      contrast(
        'columnist',
        'journalist',
        'a writer with a regular article in a newspaper',
        'The columnist writes about politics every Monday.',
      ),
      contrast(
        'press',
        'media',
        'newspapers and magazines, and the people who write them',
        'The press gathered outside the court.',
      ),
      contrast(
        'programme',
        'program',
        'a show on television or radio (British spelling)',
        'This programme is shown on Thursday evenings.',
      ),
      contrast(
        'channel',
        'broadcast',
        'a television station',
        'Which channel is the film on?',
      ),
      contrast(
        'bulletin',
        'newsflash',
        'a short report of the latest news on television or radio',
        'We heard the weather in the news bulletin.',
      ),
    ],
    PHRASAL_VERB: [
      phrasal(
        'bring up',
        'to raise a subject; to raise a child',
        'She did not want to bring up the subject again.',
      ),
      phrasal(
        'come on',
        'to start (a programme)',
        'The news will come on at nine.',
      ),
      phrasal(
        'come out',
        'to be published or released',
        'Her new book will come out in June.',
      ),
      phrasal(
        'fill in',
        'to write the required information on a form',
        'Please fill in the form.',
      ),
      phrasal(
        'flick through',
        'to turn the pages of a magazine quickly',
        'I like to flick through the magazine in the waiting room.',
      ),
      phrasal(
        'go into',
        'to examine or describe in detail',
        'The report does not go into detail.',
      ),
      phrasal(
        'hand out',
        'to give to each person in a group',
        'The teacher will hand out the newspapers.',
      ),
      phrasal(
        'look up',
        'to search for information in a book or online',
        'I had to look up the word in a dictionary.',
      ),
      phrasal(
        'make out',
        'to see or understand with difficulty',
        'I cannot make out what the reporter is saying.',
      ),
      phrasal(
        'make up',
        'to invent a story or excuse',
        'The newspaper had to make up a story.',
      ),
      phrasal(
        'put forward',
        'to suggest for consideration',
        'He wants to put forward a new idea.',
      ),
      phrasal(
        'see through',
        'to realise that something is false',
        'Readers can usually see through false stories.',
      ),
      phrasal(
        'stand out',
        'to be easy to notice',
        'A bright headline will stand out on the page.',
      ),
      phrasal(
        'turn over',
        'to change to another television channel; to turn a page',
        'Please turn over to the next page.',
      ),
    ],
    PHRASE_COLLOCATION: [
      collocation(
        'under control',
        'managed so that nothing goes wrong',
        'The situation is now under control.',
      ),
      collocation(
        'give a description',
        'to say what someone or something is like',
        'Please give a description of the missing man.',
      ),
      collocation(
        'make a difference',
        'to have an effect',
        'A good review can make a difference to sales.',
      ),
      collocation(
        'take for granted',
        'to expect without being grateful',
        'We often take for granted the news we receive every day.',
      ),
      collocation(
        'have an influence on',
        'to affect how people think or act',
        'Advertising can have an influence on what we buy.',
      ),
      collocation(
        'surf the Internet',
        'to look at different websites',
        'He likes to surf the Internet in the evening.',
      ),
      collocation(
        'break the news',
        'to tell someone important news',
        'She had to break the news to her parents.',
      ),
      collocation(
        'take place',
        'to happen',
        'The interview will take place on Tuesday.',
      ),
      collocation(
        'ask a question',
        'to put a question to someone',
        'You may ask a question at the end.',
      ),
      collocation(
        'point of view',
        'a personal opinion',
        'From my point of view, the programme was boring.',
      ),
      collocation(
        'watch the news',
        'to view news on television',
        'We watch the news every evening.',
      ),
    ],
    WORD_PATTERN: [
      pattern(
        'according',
        'according to sb/sth',
        'as said by',
        'According to the report, prices will rise.',
      ),
      pattern(
        'announce',
        'announce sth (to sb); announce that',
        'to say publicly',
        'The company announced a new channel.',
      ),
      pattern(
        'believe',
        'believe in sth; believe sb; believe that',
        'to think something is true',
        'I do not believe everything I read.',
      ),
      pattern(
        'comment',
        'comment on sth; comment that',
        'to give an opinion',
        'The minister refused to comment on the story.',
      ),
      pattern(
        'confuse',
        'confuse sth with sth; be confused about sth',
        'to mix up',
        'People often confuse the two actors.',
      ),
      pattern(
        'correspond',
        'correspond with sb; correspond to sth',
        'to write letters; to match',
        'She corresponds with a journalist in Rome.',
      ),
      pattern(
        'describe',
        'describe sth to sb; describe sb as',
        'to say what something is like',
        'He described the accident to the police.',
      ),
      pattern(
        'hear',
        'hear about/of sth; hear from sb; hear sb do/doing',
        'to receive news',
        'Have you heard about the new magazine?',
      ),
      pattern(
        'inform',
        'inform sb of/about sth; inform sb that',
        'to tell',
        'Please inform us of any changes.',
      ),
      pattern(
        'likely',
        'likely to do; it is likely that',
        'probable',
        'The film is likely to win an award.',
      ),
      pattern(
        'persuade',
        'persuade sb to do; persuade sb that',
        'to make someone agree by reasons',
        'The advert persuaded me to buy the magazine.',
      ),
      pattern(
        'point',
        'point at/to sth; there is no point in doing',
        'to show with your finger; purpose',
        'There is no point in watching this show.',
      ),
      pattern(
        'send',
        'send sth to sb; send sb sth',
        'to cause to go',
        'I sent an email to the editor.',
      ),
      pattern(
        'surprise',
        'surprise sb; be surprised at/by sth; be surprised to do',
        'to cause a feeling of shock',
        'She was surprised to see her name in the paper.',
      ),
      pattern(
        'tell',
        'tell sb about sth; tell sb to do; tell sb that',
        'to give information',
        'The announcer told us about the delay.',
      ),
    ],
    WORD_FORMATION: [
      formation(
        'announce',
        'announcement (noun); announcer (noun)',
        'to say publicly',
        'The announcement was made at noon.',
      ),
      formation(
        'belief',
        'believe (verb); believable (adjective)',
        'a feeling that something is true',
        'The story is not believable.',
      ),
      formation(
        'communicate',
        'communication (noun); communicative (adjective)',
        'to share information',
        'Good communication is essential in the media.',
      ),
      formation(
        'convince',
        'convincing (adjective); conviction (noun)',
        'to make someone believe',
        'The reporter gave a convincing argument.',
      ),
      formation(
        'discuss',
        'discussion (noun)',
        'to talk about',
        'There was a long discussion on the radio.',
      ),
      formation(
        'edit',
        'editor (noun); edition (noun); editorial (noun)',
        'to prepare a text for publication',
        'The editor corrected the article.',
      ),
      formation(
        'humour',
        'humorous (adjective)',
        'the quality of being funny',
        'It was a humorous programme.',
      ),
      formation(
        'inform',
        'information (noun); informative (adjective)',
        'to tell facts',
        'The leaflet is very informative.',
      ),
      formation(
        'journal',
        'journalist (noun); journalism (noun)',
        'a serious newspaper or magazine',
        'She studied journalism at university.',
      ),
      formation(
        'politics',
        'political (adjective); politician (noun)',
        'the work of government',
        'The politician gave an interview.',
      ),
      formation(
        'power',
        'powerful (adjective)',
        'strength or influence',
        'The press is a powerful force.',
      ),
      formation(
        'ridicule',
        'ridiculous (adjective)',
        'to make fun of',
        'The story was ridiculous.',
      ),
      formation(
        'second',
        'secondly (adverb); secondary (adjective)',
        'coming after the first',
        'Secondly, the report is too long.',
      ),
      formation(
        'write',
        'writer (noun); writing (noun)',
        'to put words on paper',
        'The writer works for a magazine.',
      ),
    ],
  },
};

/* -------------------------------------------------------------------------- */
/* Units 10-28: topics only, words still to be added                          */
/* -------------------------------------------------------------------------- */

const placeholder = (unitNumber: number, topic: string): UnitData => ({
  unitNumber,
  topic,
  sections: emptySections(),
});

export const UNITS: UnitData[] = [
  unit2,
  unit4,
  unit6,
  unit8,
  // TODO: Extract from PDF pages 60-61
  placeholder(10, 'People and society'),
  // TODO: Extract from PDF pages 72-73
  placeholder(12, 'Law and crime'),
  // TODO: Extract from PDF pages 84-85
  placeholder(14, 'Health and fitness'),
  // TODO: Extract from PDF pages 96-97
  placeholder(16, 'Food and drink'),
  // TODO: Extract from PDF pages 108-109
  placeholder(18, 'Education'),
  // TODO: Extract from PDF pages 120-121
  placeholder(20, 'Weather and environment'),
  // TODO: Extract from PDF pages 132-133
  placeholder(22, 'Money and shopping'),
  // TODO: Extract from PDF pages 144-145
  placeholder(24, 'Entertainment'),
  // TODO: Extract from PDF pages 156-157
  placeholder(26, 'Fashion and design'),
  // TODO: Extract from PDF pages 168-169
  placeholder(28, 'Work and business'),
];

export const SECTIONS: Section[] = [
  'TOPIC_CONTRAST',
  'PHRASAL_VERB',
  'PHRASE_COLLOCATION',
  'WORD_PATTERN',
  'WORD_FORMATION',
];
