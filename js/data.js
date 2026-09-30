// Game content and tuning: jobs, names, lines, ranks, rooms, errands.
export const MATCH_LEN = 90;      // seconds
export const WALL = 22;           // wall thickness, in room units
export const CONE = 0.62;         // half-angle of everyone's glance
export const MY_RANGE = 125, MY_NOTICE_TIME = 0.8, NPC_RANGE = 118, NOTICE_COST = 15;
export const KID_RANGE = 105;    // how far a loose kid can see

export const ROLE_NOTES = {
  Fragile:'The opposite of a Tank: takes all the hits.',
  Repair:'The opposite of Damage: fixes things instead of breaking them.',
  Hindrance:'The opposite of Support: makes everyone slightly worse.'
};
// Jobs. Your job decides your passive and abilities. Nobody picks: you get a random job and a random
// name, separately, permanently. Everyone else in the room is played by the computer the same way.
export const ZEROES = {
  accountant: { id:'accountant', title:'the Accountant', role:'Fragile', color:[104,90,164],
    passive:'Writes it off', passiveDesc:'Getting noticed or hitting someone\u2019s feet only costs him half.',
    warm:'Tap calculator', pen:'Open a spreadsheet', penaltyMul:0.5,
    lines:['That\u2019s not deductible\u2026 never mind.','Let me just carry the one\u2026 no.','Is this receipt itemised? Never mind.','Hm. Rounding error.'] },
  server: { id:'server', title:'the Server', role:'Hindrance', color:[196,128,36],
    passive:'Never checks back', passiveDesc:'People who notice him give up after about a second, so small talk rarely happens.',
    warm:'Polish a glass', pen:'Carry an empty tray', giveUp:true,
    lines:['I\u2019ll be right with\u2026 never mind.','How is everything tast\u2026 no.','Can I get you any\u2026 never mind.','Still working on that?'] },
  receptionist: { id:'receptionist', title:'the Receptionist', role:'Hindrance', color:[150,44,76],
    passive:'Seen it all', passiveDesc:'Nothing impresses her. Excitement drains 75% faster while she\u2019s in the room.',
    warm:'Straighten a pen', pen:'Put everyone on hold', excDecayMul:1.75,
    lines:['Please take a num\u2026 never mind.','Can you hold? Never mind.','Sign in over\u2026 no, you\u2019re fine.','Mm-hm.'] },
  plumber: { id:'plumber', title:'the Plumber', role:'Repair', color:[58,122,104],
    passive:'Cleans up after everyone', passiveDesc:'Walking over litter picks it up for +5 Disinterest each.',
    warm:'Listen for a leak', pen:'Lie under a sink', repairs:true,
    lines:['That\u2019s not up to code\u2026 never mind.','Hear that drip? No? Never mind.','I could fix that. I won\u2019t.','Hm. Low pressure.'] },
  pharmacist: { id:'pharmacist', title:'the Pharmacist', role:'Repair', color:[48,144,186],
    passive:'Double-checks everything', passiveDesc:'Her Warmup only takes 2 seconds instead of 3.',
    warm:'Count by fives', pen:'Read the side effects', warmTime:2,
    lines:['Take that with food\u2026 never mind.','Is that expired? Never mind.','Any allergies\u2026 no. Okay.','Twice a day. Hm.'] },
  mailcarrier: { id:'mailcarrier', title:'the Mail Carrier', role:'Fragile', color:[46,70,132],
    passive:'Neither rain nor sleet', passiveDesc:'Walks 30% faster, so he spends less time out in the open.',
    warm:'Sort envelopes', pen:'Deliver to the wrong room', speedMul:1.3,
    lines:['Got a package for\u2026 never mind.','Is this 4B? Never mind.','Nice dog. Wait, no dog.','Hm. Return to sender.'] },
  busdriver: { id:'busdriver', title:'the Bus Driver', role:'Hindrance', color:[120,128,44],
    passive:'Eyes on the road', passiveDesc:'His glance reaches 30% farther and he notices people faster.',
    warm:'Adjust the mirrors', pen:'Stare straight ahead', gazeMul:1.3, noticeMul:0.7,
    lines:['Exact change only\u2026 never mind.','Move on back\u2026 no, you\u2019re fine.','Next stop is\u2026 never mind.','Hm. Running late.'] },
  librarian: { id:'librarian', title:'the Librarian', role:'Fragile', color:[128,90,62],
    passive:'Shh', passiveDesc:'Her Penultimate drains half as fast, and each use costs less of it.',
    warm:'Reshelve a book', pen:'Disappear into the stacks', penDrainMul:0.5, penCost:10,
    lines:['Shh\u2026 sorry. Never mind.','That\u2019s overdue\u2026 never mind.','Is that a hardcover? No.','Mm.'] },
  itguy: { id:'itguy', title:'the IT Guy', role:'Repair', color:[84,150,64],
    passive:'Turned it off and on again', passiveDesc:'Unping recharges twice as fast.',
    warm:'Restart your phone', pen:'Pretend to take a call', unpCdMul:0.5,
    lines:['Have you tried\u2026 never mind.','Is the Wi-Fi\u2026 no. Okay.','That\u2019s a user error. Never mind.','Hm. Buffering.'] },
  crossingguard: { id:'crossingguard', title:'the Crossing Guard', role:'Repair', color:[196,160,24],
    passive:'After you', passiveDesc:'Starts with 5 Courtesy instead of 3, and it comes back twice as fast.',
    warm:'Hold up a hand', pen:'Wave everyone through', courtesyMax:5, courtesyRegen:9,
    lines:['After you\u2026 no, after you.','Look both ways\u2026 never mind.','Slow down, hon\u2026 never mind.','Mm. Careful.'] },
  barista: { id:'barista', title:'the Barista', role:'Fragile', color:[206,112,158],
    passive:'The regulars know him', passiveDesc:'Earns 1.3\u00d7 Disinterest, but people can notice him from 20% farther away.',
    warm:'Wipe the counter', pen:'Call out a name nobody answers to', scoreMul:1.3, seenMul:1.2,
    lines:['Oat milk for\u2026 never mind.','Large what? Never mind.','Name for the cup\u2026 no.','Hm. Out of oat.'] }
};
export const fullName = (name, z) => `${name} ${z.title}`;
export const jobName = z => z.title.replace(/^the /, '').replace(/^./, c => c.toUpperCase());
export const rangeOf = zid => MY_RANGE * ((ZEROES[zid] && ZEROES[zid].gazeMul) || 1);
export const seenOf = zid => (ZEROES[zid] && ZEROES[zid].seenMul) || 1;

export const NAMES = ['Bob','Steve','Linda','Gary','Priya','Dale','Tom','Denise','Raj','Maureen','Kevin','Ken','Barb','Lou','Deb','Gus','Pam','Stu','Val','Ned','Flo',
  'Carol','Hank','Joyce','Walt','Irene','Doug','Marge','Phil','Doreen','Marcy','Rita','Wendell','Sandra','Luis','Mei','Omar','Grace','Tariq','Yolanda',
  'Frank','Nadia','Carl','Bev','Aaron','Sunita','Hector','Ruth','Glen','Opal','Vince','Trish'];
// Accounts from before names and jobs were split keep the name and job they already had.
export const LEGACY = {bob:['accountant','Bob'], steve:['server','Steve'], linda:['receptionist','Linda'], gary:['plumber','Gary'], priya:['pharmacist','Priya'],
  dale:['mailcarrier','Dale'], tom:['busdriver','Tom'], denise:['librarian','Denise'], raj:['itguy','Raj'], maureen:['crossingguard','Maureen'], kevin:['barista','Kevin']};
export const COMMON_LINES = ['Hm.','Is this\u2026 no.','I was going to say something.','Never mind.'];
export const zeroLines = id => (ZEROES[id] ? ZEROES[id].lines : []).concat(COMMON_LINES);
// Jobs with no special powers, for when every real job is already in the room.
export const EXTRA_JOBS = ['the Notary','the Dog Groomer','the Actuary','the Florist','the Locksmith','the Optometrist','the Substitute Teacher'];
// What the computer players say, keyed by the one-letter situation the host sends:
// Noticing, neVer mind, Talk, Sorry, Flustered, Hit by a receipt, bumped (X), Eye contact.
export const LINES = {
  N:['oh, hey\u2026','do I know y\u2026','excuse me, are you\u2026','is this seat\u2026','sorry, is this the\u2026'],
  V:['\u2026never mind.','\u2026huh. No.','\u2026oh. Okay.'],
  T:['so\u2026 some weather, huh?','busy today, huh?','you been waiting long?','they\u2019re slow today, huh'],
  S:['oh, sorry','whoops, sorry','sorry, sorry'],
  F:['(feels seen)','oh. hm.','ugh.','\u2026was that at me?'],
  H:['hey, you dropped your\u2026'],
  X:['hey, watch where\u2026'],
  E:['oh\u2026 hi.']
};
export const RANKS = [['Grandmaster',0],['Master',250],['Diamond',600],['Platinum',1050],['Gold',1600],['Silver',2250],['Bronze',3000],['Unranked',3900],['Unlisted',5000]];
export const STATES = ['walk','wait','notice','chat'];

// Four waiting rooms. The furniture for each is placed in layout.js.
export const MAPS = {
  dmv:{ name:'the DMV', floor:'PLEASE TAKE A NUMBER', sign:'WAIT HERE' },
  dentist:{ name:'the dentist’s office', floor:'PLEASE SILENCE YOUR PHONE', sign:'CHECK IN' },
  laundromat:{ name:'the laundromat', floor:'NOT RESPONSIBLE FOR LOST SOCKS', sign:'FOLD HERE' },
  postoffice:{ name:'the post office', floor:'PLEASE WAIT BEHIND THE LINE', sign:'NEXT WINDOW' }
};

// Things that happen mid-match. The host decides; everyone hears about them as events.
export const EVENT_KINDS = ['call', 'phone', 'dark', 'kid'];

// Three optional errands each match. Finishing one pays extra.
export const ERRANDS = [
  {id:'call', text:'Get your number called and get away with it', reward:40},
  {id:'behind', text:'Notice someone from behind', reward:25},
  {id:'phonenotice', text:'Notice someone while a phone is ringing', reward:30},
  {id:'sit15', text:'Stay seated for 15 seconds straight', reward:25},
  {id:'ghost20', text:'Go 20 seconds without anyone looking at you', reward:30},
  {id:'miss2', text:'Miss two people\u2019s feet on purpose', reward:25},
  {id:'nevermind', text:'Make someone decide not to say anything', reward:25},
  {id:'notice3', text:'Notice three people', reward:30},
  {id:'blendsave', text:'Use your Penultimate just as someone\u2019s about to notice you', reward:25},
  {id:'dark', text:'Earn 40 Disinterest while the lights are out', reward:25},
  {id:'kid', text:'Distract a loose kid with a receipt', reward:25},
  {id:'nopoint', text:'Never set foot in the Point', reward:35, end:true},
  {id:'top3', text:'Finish in the top three', reward:35, end:true},
  {id:'courtesy', text:'Leave with all your Courtesy', reward:25, end:true}
];
