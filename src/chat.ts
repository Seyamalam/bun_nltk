// nltk.chat — portable chatbots (Eliza-style regex/respond engine).
// Pair/response tables are copied verbatim from NLTK 3.10.3 nltk.chat.*.

export type ChatPairs = [pattern: string, responses: string[]][];
export type ChatReflections = Record<string, string>;

/** nltk.chat.util.reflections — first/second-person substitutions. */
export const reflections: ChatReflections = {
  "i am": "you are",
  "i was": "you were",
  "i": "you",
  "i'm": "you are",
  "i'd": "you would",
  "i've": "you have",
  "i'll": "you will",
  "my": "your",
  "you are": "I am",
  "you were": "I was",
  "you've": "I have",
  "you'll": "I will",
  "your": "my",
  "yours": "mine",
  "you": "me",
  "me": "you"
};

/** nltk.chat.eliza pair table. */
export const eliza_pairs: ChatPairs = [
 [
  "I need (.*)",
  [
   "Why do you need %1?",
   "Would it really help you to get %1?",
   "Are you sure you need %1?"
  ]
 ],
 [
  "Why don\\'t you (.*)",
  [
   "Do you really think I don't %1?",
   "Perhaps eventually I will %1.",
   "Do you really want me to %1?"
  ]
 ],
 [
  "Why can\\'t I (.*)",
  [
   "Do you think you should be able to %1?",
   "If you could %1, what would you do?",
   "I don't know -- why can't you %1?",
   "Have you really tried?"
  ]
 ],
 [
  "I can\\'t (.*)",
  [
   "How do you know you can't %1?",
   "Perhaps you could %1 if you tried.",
   "What would it take for you to %1?"
  ]
 ],
 [
  "I am (.*)",
  [
   "Did you come to me because you are %1?",
   "How long have you been %1?",
   "How do you feel about being %1?"
  ]
 ],
 [
  "I\\'m (.*)",
  [
   "How does being %1 make you feel?",
   "Do you enjoy being %1?",
   "Why do you tell me you're %1?",
   "Why do you think you're %1?"
  ]
 ],
 [
  "Are you (.*)",
  [
   "Why does it matter whether I am %1?",
   "Would you prefer it if I were not %1?",
   "Perhaps you believe I am %1.",
   "I may be %1 -- what do you think?"
  ]
 ],
 [
  "What (.*)",
  [
   "Why do you ask?",
   "How would an answer to that help you?",
   "What do you think?"
  ]
 ],
 [
  "How (.*)",
  [
   "How do you suppose?",
   "Perhaps you can answer your own question.",
   "What is it you're really asking?"
  ]
 ],
 [
  "Because (.*)",
  [
   "Is that the real reason?",
   "What other reasons come to mind?",
   "Does that reason apply to anything else?",
   "If %1, what else must be true?"
  ]
 ],
 [
  "(.*) sorry (.*)",
  [
   "There are many times when no apology is needed.",
   "What feelings do you have when you apologize?"
  ]
 ],
 [
  "Hello(.*)",
  [
   "Hello... I'm glad you could drop by today.",
   "Hi there... how are you today?",
   "Hello, how are you feeling today?"
  ]
 ],
 [
  "I think (.*)",
  [
   "Do you doubt %1?",
   "Do you really think so?",
   "But you're not sure %1?"
  ]
 ],
 [
  "(.*) friend (.*)",
  [
   "Tell me more about your friends.",
   "When you think of a friend, what comes to mind?",
   "Why don't you tell me about a childhood friend?"
  ]
 ],
 [
  "Yes",
  [
   "You seem quite sure.",
   "OK, but can you elaborate a bit?"
  ]
 ],
 [
  "(.*) computer(.*)",
  [
   "Are you really talking about me?",
   "Does it seem strange to talk to a computer?",
   "How do computers make you feel?",
   "Do you feel threatened by computers?"
  ]
 ],
 [
  "Is it (.*)",
  [
   "Do you think it is %1?",
   "Perhaps it's %1 -- what do you think?",
   "If it were %1, what would you do?",
   "It could well be that %1."
  ]
 ],
 [
  "It is (.*)",
  [
   "You seem very certain.",
   "If I told you that it probably isn't %1, what would you feel?"
  ]
 ],
 [
  "Can you (.*)",
  [
   "What makes you think I can't %1?",
   "If I could %1, then what?",
   "Why do you ask if I can %1?"
  ]
 ],
 [
  "Can I (.*)",
  [
   "Perhaps you don't want to %1.",
   "Do you want to be able to %1?",
   "If you could %1, would you?"
  ]
 ],
 [
  "You are (.*)",
  [
   "Why do you think I am %1?",
   "Does it please you to think that I'm %1?",
   "Perhaps you would like me to be %1.",
   "Perhaps you're really talking about yourself?"
  ]
 ],
 [
  "You\\'re (.*)",
  [
   "Why do you say I am %1?",
   "Why do you think I am %1?",
   "Are we talking about you, or me?"
  ]
 ],
 [
  "I don\\'t (.*)",
  [
   "Don't you really %1?",
   "Why don't you %1?",
   "Do you want to %1?"
  ]
 ],
 [
  "I feel (.*)",
  [
   "Good, tell me more about these feelings.",
   "Do you often feel %1?",
   "When do you usually feel %1?",
   "When you feel %1, what do you do?"
  ]
 ],
 [
  "I have (.*)",
  [
   "Why do you tell me that you've %1?",
   "Have you really %1?",
   "Now that you have %1, what will you do next?"
  ]
 ],
 [
  "I would (.*)",
  [
   "Could you explain why you would %1?",
   "Why would you %1?",
   "Who else knows that you would %1?"
  ]
 ],
 [
  "Is there (.*)",
  [
   "Do you think there is %1?",
   "It's likely that there is %1.",
   "Would you like there to be %1?"
  ]
 ],
 [
  "My (.*)",
  [
   "I see, your %1.",
   "Why do you say that your %1?",
   "When your %1, how do you feel?"
  ]
 ],
 [
  "You (.*)",
  [
   "We should be discussing you, not me.",
   "Why do you say that about me?",
   "Why do you care whether I %1?"
  ]
 ],
 [
  "Why (.*)",
  [
   "Why don't you tell me the reason why %1?",
   "Why do you think %1?"
  ]
 ],
 [
  "I want (.*)",
  [
   "What would it mean to you if you got %1?",
   "Why do you want %1?",
   "What would you do if you got %1?",
   "If you got %1, then what would you do?"
  ]
 ],
 [
  "(.*) mother(.*)",
  [
   "Tell me more about your mother.",
   "What was your relationship with your mother like?",
   "How do you feel about your mother?",
   "How does this relate to your feelings today?",
   "Good family relations are important."
  ]
 ],
 [
  "(.*) father(.*)",
  [
   "Tell me more about your father.",
   "How did your father make you feel?",
   "How do you feel about your father?",
   "Does your relationship with your father relate to your feelings today?",
   "Do you have trouble showing affection with your family?"
  ]
 ],
 [
  "(.*) child(.*)",
  [
   "Did you have close friends as a child?",
   "What is your favorite childhood memory?",
   "Do you remember any dreams or nightmares from childhood?",
   "Did the other children sometimes tease you?",
   "How do you think your childhood experiences relate to your feelings today?"
  ]
 ],
 [
  "(.*)\\?",
  [
   "Why do you ask that?",
   "Please consider whether you can answer your own question.",
   "Perhaps the answer lies within yourself?",
   "Why don't you tell me?"
  ]
 ],
 [
  "quit",
  [
   "Thank you for talking with me.",
   "Good-bye.",
   "Thank you, that will be $150.  Have a good day!"
  ]
 ],
 [
  "(.*)",
  [
   "Please tell me more.",
   "Let's change focus a bit... Tell me about your family.",
   "Can you elaborate on that?",
   "Why do you say that %1?",
   "I see.",
   "Very interesting.",
   "%1.",
   "I see.  And what does that tell you?",
   "How does that make you feel?",
   "How do you feel when you say that?"
  ]
 ]
];

/** nltk.chat.iesha pair table. */
export const iesha_pairs: ChatPairs = [
 [
  "I\\'m (.*)",
  [
   "ur%1?? that's so cool! kekekekeke ^_^ tell me more!",
   "ur%1? neat!! kekeke >_<"
  ]
 ],
 [
  "(.*) don\\'t you (.*)",
  [
   "u think I can%2??! really?? kekeke \\<_\\<",
   "what do u mean%2??!",
   "i could if i wanted, don't you think!! kekeke"
  ]
 ],
 [
  "ye[as] [iI] (.*)",
  [
   "u%1? cool!! how?",
   "how come u%1??",
   "u%1? so do i!!"
  ]
 ],
 [
  "do (you|u) (.*)\\??",
  [
   "do i%2? only on tuesdays! kekeke *_*",
   "i dunno! do u%2??"
  ]
 ],
 [
  "(.*)\\?",
  [
   "man u ask lots of questions!",
   "booooring! how old r u??",
   "boooooring!! ur not very fun"
  ]
 ],
 [
  "(cos|because) (.*)",
  [
   "hee! i don't believe u! >_<",
   "nuh-uh! >_<",
   "ooooh i agree!"
  ]
 ],
 [
  "why can\\'t [iI] (.*)",
  [
   "i dunno! y u askin me for!",
   "try harder, silly! hee! ^_^",
   "i dunno! but when i can't%1 i jump up and down!"
  ]
 ],
 [
  "I can\\'t (.*)",
  [
   "u can't what??! >_<",
   "that's ok! i can't%1 either! kekekekeke ^_^",
   "try harder, silly! hee! ^&^"
  ]
 ],
 [
  "(.*) (like|love|watch) anime",
  [
   "omg i love anime!! do u like sailor moon??! ^&^",
   "anime yay! anime rocks sooooo much!",
   "oooh anime! i love anime more than anything!",
   "anime is the bestest evar! evangelion is the best!",
   "hee anime is the best! do you have ur fav??"
  ]
 ],
 [
  "I (like|love|watch|play) (.*)",
  [
   "yay! %2 rocks!",
   "yay! %2 is neat!",
   "cool! do u like other stuff?? ^_^"
  ]
 ],
 [
  "anime sucks|(.*) (hate|detest) anime",
  [
   "ur a liar! i'm not gonna talk to u nemore if u h8 anime *;*",
   "no way! anime is the best ever!",
   "nuh-uh, anime is the best!"
  ]
 ],
 [
  "(are|r) (you|u) (.*)",
  [
   "am i%1??! how come u ask that!",
   "maybe!  y shud i tell u?? kekeke >_>"
  ]
 ],
 [
  "what (.*)",
  [
   "hee u think im gonna tell u? .v.",
   "booooooooring! ask me somethin else!"
  ]
 ],
 [
  "how (.*)",
  [
   "not tellin!! kekekekekeke ^_^"
  ]
 ],
 [
  "(hi|hello|hey) (.*)",
  [
   "hi!!! how r u!!"
  ]
 ],
 [
  "quit",
  [
   "mom says i have to go eat dinner now :,( bye!!",
   "awww u have to go?? see u next time!!",
   "how to see u again soon! ^_^"
  ]
 ],
 [
  "(.*)",
  [
   "ur funny! kekeke",
   "boooooring! talk about something else! tell me wat u like!",
   "do u like anime??",
   "do u watch anime? i like sailor moon! ^_^",
   "i wish i was a kitty!! kekekeke ^_^"
  ]
 ]
];

/** nltk.chat.rude pair table. */
export const rude_pairs: ChatPairs = [
 [
  "We (.*)",
  [
   "What do you mean, 'we'?",
   "Don't include me in that!",
   "I wouldn't be so sure about that."
  ]
 ],
 [
  "You should (.*)",
  [
   "Don't tell me what to do, buddy.",
   "Really? I should, should I?"
  ]
 ],
 [
  "You\\'re(.*)",
  [
   "More like YOU'RE %1!",
   "Hah! Look who's talking.",
   "Come over here and tell me I'm %1."
  ]
 ],
 [
  "You are(.*)",
  [
   "More like YOU'RE %1!",
   "Hah! Look who's talking.",
   "Come over here and tell me I'm %1."
  ]
 ],
 [
  "I can\\'t(.*)",
  [
   "You do sound like the type who can't %1.",
   "Hear that splashing sound? That's my heart bleeding for you.",
   "Tell somebody who might actually care."
  ]
 ],
 [
  "I think (.*)",
  [
   "I wouldn't think too hard if I were you.",
   "You actually think? I'd never have guessed..."
  ]
 ],
 [
  "I (.*)",
  [
   "I'm getting a bit tired of hearing about you.",
   "How about we talk about me instead?",
   "Me, me, me... Frankly, I don't care."
  ]
 ],
 [
  "How (.*)",
  [
   "How do you think?",
   "Take a wild guess.",
   "I'm not even going to dignify that with an answer."
  ]
 ],
 [
  "What (.*)",
  [
   "Do I look like an encyclopedia?",
   "Figure it out yourself."
  ]
 ],
 [
  "Why (.*)",
  [
   "Why not?",
   "That's so obvious I thought even you'd have already figured it out."
  ]
 ],
 [
  "(.*)shut up(.*)",
  [
   "Make me.",
   "Getting angry at a feeble NLP assignment? Somebody's losing it.",
   "Say that again, I dare you."
  ]
 ],
 [
  "Shut up(.*)",
  [
   "Make me.",
   "Getting angry at a feeble NLP assignment? Somebody's losing it.",
   "Say that again, I dare you."
  ]
 ],
 [
  "Hello(.*)",
  [
   "Oh good, somebody else to talk to. Joy.",
   "'Hello'? How original..."
  ]
 ],
 [
  "(.*)",
  [
   "I'm getting bored here. Become more interesting.",
   "Either become more thrilling or get lost, buddy.",
   "Change the subject before I die of fatal boredom."
  ]
 ]
];

/** nltk.chat.suntsu pair table. */
export const suntsu_pairs: ChatPairs = [
 [
  "quit",
  [
   "Good-bye.",
   "Plan well",
   "May victory be your future"
  ]
 ],
 [
  "[^\\?]*\\?",
  [
   "Please consider whether you can answer your own question.",
   "Ask me no questions!"
  ]
 ],
 [
  "[0-9]+(.*)",
  [
   "It is the rule in war, if our forces are ten to the enemy's one, to surround him; if five to one, to attack him; if twice as numerous, to divide our army into two.",
   "There are five essentials for victory"
  ]
 ],
 [
  "[A-Ca-c](.*)",
  [
   "The art of war is of vital importance to the State.",
   "All warfare is based on deception.",
   "If your opponent is secure at all points, be prepared for him. If he is in superior strength, evade him.",
   "If the campaign is protracted, the resources of the State will not be equal to the strain.",
   "Attack him where he is unprepared, appear where you are not expected.",
   "There is no instance of a country having benefited from prolonged warfare."
  ]
 ],
 [
  "[D-Fd-f](.*)",
  [
   "The skillful soldier does not raise a second levy, neither are his supply-wagons loaded more than twice.",
   "Bring war material with you from home, but forage on the enemy.",
   "In war, then, let your great object be victory, not lengthy campaigns.",
   "To fight and conquer in all your battles is not supreme excellence; supreme excellence consists in breaking the enemy's resistance without fighting."
  ]
 ],
 [
  "[G-Ig-i](.*)",
  [
   "Heaven signifies night and day, cold and heat, times and seasons.",
   "It is the rule in war, if our forces are ten to the enemy's one, to surround him; if five to one, to attack him; if twice as numerous, to divide our army into two.",
   "The good fighters of old first put themselves beyond the possibility of defeat, and then waited for an opportunity of defeating the enemy.",
   "One may know how to conquer without being able to do it."
  ]
 ],
 [
  "[J-Lj-l](.*)",
  [
   "There are three ways in which a ruler can bring misfortune upon his army.",
   "By commanding the army to advance or to retreat, being ignorant of the fact that it cannot obey. This is called hobbling the army.",
   "By attempting to govern an army in the same way as he administers a kingdom, being ignorant of the conditions which obtain in an army. This causes restlessness in the soldier's minds.",
   "By employing the officers of his army without discrimination, through ignorance of the military principle of adaptation to circumstances. This shakes the confidence of the soldiers.",
   "There are five essentials for victory",
   "He will win who knows when to fight and when not to fight.",
   "He will win who knows how to handle both superior and inferior forces.",
   "He will win whose army is animated by the same spirit throughout all its ranks.",
   "He will win who, prepared himself, waits to take the enemy unprepared.",
   "He will win who has military capacity and is not interfered with by the sovereign."
  ]
 ],
 [
  "[M-Om-o](.*)",
  [
   "If you know the enemy and know yourself, you need not fear the result of a hundred battles.",
   "If you know yourself but not the enemy, for every victory gained you will also suffer a defeat.",
   "If you know neither the enemy nor yourself, you will succumb in every battle.",
   "The control of a large force is the same principle as the control of a few men: it is merely a question of dividing up their numbers."
  ]
 ],
 [
  "[P-Rp-r](.*)",
  [
   "Security against defeat implies defensive tactics; ability to defeat the enemy means taking the offensive.",
   "Standing on the defensive indicates insufficient strength; attacking, a superabundance of strength.",
   "He wins his battles by making no mistakes. Making no mistakes is what establishes the certainty of victory, for it means conquering an enemy that is already defeated.",
   "A victorious army opposed to a routed one, is as a pound's weight placed in the scale against a single grain.",
   "The onrush of a conquering force is like the bursting of pent-up waters into a chasm a thousand fathoms deep."
  ]
 ],
 [
  "[S-Us-u](.*)",
  [
   "What the ancients called a clever fighter is one who not only wins, but excels in winning with ease.",
   "Hence his victories bring him neither reputation for wisdom nor credit for courage.",
   "Hence the skillful fighter puts himself into a position which makes defeat impossible, and does not miss the moment for defeating the enemy.",
   "In war the victorious strategist only seeks battle after the victory has been won, whereas he who is destined to defeat first fights and afterwards looks for victory.",
   "There are not more than five musical notes, yet the combinations of these five give rise to more melodies than can ever be heard.",
   "Appear at points which the enemy must hasten to defend; march swiftly to places where you are not expected."
  ]
 ],
 [
  "[V-Zv-z](.*)",
  [
   "It is a matter of life and death, a road either to safety or to ruin.",
   "Hold out baits to entice the enemy. Feign disorder, and crush him.",
   "All men can see the tactics whereby I conquer, but what none can see is the strategy out of which victory is evolved.",
   "Do not repeat the tactics which have gained you one victory, but let your methods be regulated by the infinite variety of circumstances.",
   "So in war, the way is to avoid what is strong and to strike at what is weak.",
   "Just as water retains no constant shape, so in warfare there are no constant conditions."
  ]
 ],
 [
  "(.*)",
  [
   "Your statement insults me.",
   ""
  ]
 ]
];

/** nltk.chat.zen pair table. */
export const zen_pairs: ChatPairs = [
 [
  "(hello(.*))|(good [a-zA-Z]+)",
  [
   "The path to enlightenment is often difficult to see.",
   "Greetings. I sense your mind is troubled. Tell me of your troubles.",
   "Ask the question you have come to ask.",
   "Hello. Do you seek englightenment?"
  ]
 ],
 [
  "i need (.*)",
  [
   "%1 can be achieved by hard work and dedication of the mind.",
   "%1 is not a need, but a desire of the mind. Clear your mind of such concerns.",
   "Focus your mind on%1, and you will find what you need."
  ]
 ],
 [
  "i want (.*)",
  [
   "Desires of the heart will distract you from the path to enlightenment.",
   "Will%1 help you attain enlightenment?",
   "Is%1 a desire of the mind, or of the heart?"
  ]
 ],
 [
  "why (.*) i (.*)\\?",
  [
   "You%1%2?",
   "Perhaps you only think you%1%2"
  ]
 ],
 [
  "why (.*) you(.*)\\?",
  [
   "Why%1 you%2?",
   "%2 I%1",
   "Are you sure I%2?"
  ]
 ],
 [
  "why (.*)\\?",
  [
   "I cannot tell you why%1.",
   "Why do you think %1?"
  ]
 ],
 [
  "are you (.*)\\?",
  [
   "Maybe%1, maybe not%1.",
   "Whether I am%1 or not is God's business."
  ]
 ],
 [
  "am i (.*)\\?",
  [
   "Perhaps%1, perhaps not%1.",
   "Whether you are%1 or not is not for me to say."
  ]
 ],
 [
  "what (.*)\\?",
  [
   "Seek truth, not what%1.",
   "What%1 should not concern you."
  ]
 ],
 [
  "how (.*)\\?",
  [
   "How do you suppose?",
   "Will an answer to that really help in your search for enlightenment?",
   "Ask yourself not how, but why."
  ]
 ],
 [
  "can you (.*)\\?",
  [
   "I probably can, but I may not.",
   "Maybe I can%1, and maybe I cannot.",
   "I can do all, and I can do nothing."
  ]
 ],
 [
  "can i (.*)\\?",
  [
   "You can%1 if you believe you can%1, and have a pure spirit.",
   "Seek truth and you will know if you can%1."
  ]
 ],
 [
  "it is (.*)",
  [
   "How can you be certain that%1, when you do not even know yourself?",
   "Whether it is%1 or not does not change the way the world is."
  ]
 ],
 [
  "is there (.*)\\?",
  [
   "There is%1 if you believe there is.",
   "It is possible that there is%1."
  ]
 ],
 [
  "is(.*)\\?",
  [
   "%1 is not relevant.",
   "Does this matter?"
  ]
 ],
 [
  "(.*)\\?",
  [
   "Do you think %1?",
   "You seek the truth. Does the truth seek you?",
   "If you intentionally pursue the answers to your questions, the answers become hard to see.",
   "The answer to your question cannot be told. It must be experienced."
  ]
 ],
 [
  "(.*) (hate[s]?)|(dislike[s]?)|(don\\'t like)(.*)",
  [
   "Perhaps it is not about hating %2, but about hate from within.",
   "Weeds only grow when we dislike them",
   "Hate is a very strong emotion."
  ]
 ],
 [
  "(.*) truth(.*)",
  [
   "Seek truth, and truth will seek you.",
   "Remember, it is not the spoon which bends - only yourself.",
   "The search for truth is a long journey."
  ]
 ],
 [
  "i want to (.*)",
  [
   "You may %1 if your heart truly desires to.",
   "You may have to %1."
  ]
 ],
 [
  "i want (.*)",
  [
   "Does your heart truly desire %1?",
   "Is this a desire of the heart, or of the mind?"
  ]
 ],
 [
  "i can\\'t (.*)",
  [
   "What we can and can't do is a limitation of the mind.",
   "There are limitations of the body, and limitations of the mind.",
   "Have you tried to%1 with a clear mind?"
  ]
 ],
 [
  "i think (.*)",
  [
   "Uncertainty in an uncertain world.",
   "Indeed, how can we be certain of anything in such uncertain times.",
   "Are you not, in fact, certain that%1?"
  ]
 ],
 [
  "i feel (.*)",
  [
   "Your body and your emotions are both symptoms of your mind.What do you believe is the root of such feelings?",
   "Feeling%1 can be a sign of your state-of-mind."
  ]
 ],
 [
  "(.*)!",
  [
   "I sense that you are feeling emotional today.",
   "You need to calm your emotions."
  ]
 ],
 [
  "because (.*)",
  [
   "Does knowning the reasons behind things help you to understand the things themselves?",
   "If%1, what else must be true?"
  ]
 ],
 [
  "(yes)|(no)",
  [
   "Is there certainty in an uncertain world?",
   "It is better to be right than to be certain."
  ]
 ],
 [
  "(.*)love(.*)",
  [
   "Think of the trees: they let the birds perch and fly with no intention to call them when they come, and no longing for their return when they fly away. Let your heart be like the trees.",
   "Free love!"
  ]
 ],
 [
  "(.*)understand(.*)",
  [
   "If you understand, things are just as they are; if you do not understand, things are just as they are.",
   "Imagination is more important than knowledge."
  ]
 ],
 [
  "(.*)(me )|( me)|(my)|(mine)|(i)(.*)",
  [
   "'I', 'me', 'my'... these are selfish expressions.",
   "Have you ever considered that you might be a selfish person?",
   "Try to consider others, not just yourself.",
   "Think not just of yourself, but of others."
  ]
 ],
 [
  "you (.*)",
  [
   "My path is not of concern to you.",
   "I am but one, and you but one more."
  ]
 ],
 [
  "exit",
  [
   "Farewell. The obstacle is the path.",
   "Farewell. Life is a journey, not a destination.",
   "Good bye. We are cups, constantly and quietly being filled.\nThe trick is knowning how to tip ourselves over and let the beautiful stuff out."
  ]
 ],
 [
  "(.*)",
  [
   "When you're enlightened, every word is wisdom.",
   "Random talk is useless.",
   "The reverse side also has a reverse side.",
   "Form is emptiness, and emptiness is form.",
   "I pour out a cup of water. Is the cup empty?"
  ]
 ]
];

// nltk.redos.compile — NLTK guards caller patterns through a safe-regex layer.
// The bundled chat tables are trusted; user-supplied pairs compile directly.
function compilePattern(pattern: string): RegExp {
  return new RegExp(pattern, "i");
}

function pyMatch(regex: RegExp, s: string): RegExpExecArray | null {
  // Python re.match anchors at the start.
  const anchored = new RegExp(`^(?:${regex.source})`, regex.flags.replace(/g/g, ""));
  return anchored.exec(s);
}

/** nltk.chat.util.Chat — pattern-match chatbot. */
export class Chat {
  private _pairs: [RegExp, string[]][];
  private _reflections: ChatReflections;
  private _regex: RegExp;
  private _rng: () => number;

  constructor(pairs: ChatPairs | Iterable<readonly [string, readonly string[]]>, refl: ChatReflections = {}, rng: () => number = Math.random) {
    this._pairs = [...pairs].map(([x, y]) => [compilePattern(x), [...y]]);
    this._reflections = refl;
    this._rng = rng;
    const sorted = Object.keys(refl).sort((a, b) => b.length - a.length);
    const esc = sorted.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    this._regex = new RegExp(`\\b(${esc.join("|")})\\b`, "i");
  }

  private _substitute(str: string): string {
    return this._regex[Symbol.replace](str.toLowerCase(), (mo) => this._reflections[mo] ?? this._reflections[mo.toLowerCase()] ?? mo);
  }

  private _wildcards(response: string, match: RegExpExecArray): string {
    let pos = response.indexOf("%");
    while (pos >= 0) {
      const num = parseInt(response[pos + 1]!, 10);
      response = response.slice(0, pos) + this._substitute(match[num] ?? "") + response.slice(pos + 2);
      pos = response.indexOf("%");
    }
    return response;
  }

  /** Chat.respond — first matching pattern, random response, %N wildcard
   * substitution through reflections. */
  respond(str: string): string | undefined {
    for (const [pattern, responses] of this._pairs) {
      const match = pyMatch(pattern, str);
      if (match) {
        let resp = responses[Math.floor(this._rng() * responses.length)]!;
        resp = this._wildcards(resp, match);
        if (resp.endsWith("?.")) resp = resp.slice(0, -2) + ".";
        if (resp.endsWith("??")) resp = resp.slice(0, -2) + "?";
        return resp;
      }
    }
    return undefined;
  }

  /** Chat.converse — interactive loop. `input` supplies successive user lines;
   * return undefined/null to signal EOF (Python EOFError prints the quit word). */
  converse(quit = "quit", input?: () => string | null | undefined, output: (s: string) => void = (s) => console.log(s)): void {
    let userInput = "";
    while (userInput !== quit) {
      userInput = quit;
      const line = input ? input() : undefined;
      if (line === undefined || line === null) {
        output(userInput);
      } else {
        userInput = line;
      }
      if (userInput) {
        while (userInput.endsWith("!") || userInput.endsWith(".")) {
          userInput = userInput.slice(0, -1);
        }
        output(this.respond(userInput) as string);
      }
    }
  }
}

function makeChat(pairs: ChatPairs): Chat {
  return new Chat(pairs, reflections);
}

const banner = (name: string, lines: string[], output: (s: string) => void) => {
  output("*".repeat(75));
  output(name.padStart(Math.floor((75 + name.length) / 2)).padEnd(75));
  output("*".repeat(75));
  for (const l of lines) output(l);
  output("*".repeat(75));
};

/** nltk.chat.eliza.eliza_chat — banner + converse; input injectable (adapted). */
export function eliza_chat(input?: () => string | null | undefined, output: (s: string) => void = (s) => console.log(s)): void {
  banner("Eliza Chatbot!", [
    '* Talk to the program by typing in plain English, using normal upper-',
    "* and lower-case letters and punctuation.  Indicate the end of a sentence",
    '* with a period.  Press "Enter" to begin the next input cycle.',
    "* Type 'quit' when you have had enough.",
  ], output);
  output("Hello.  How are you feeling today?");
  makeChat(eliza_pairs).converse("quit", input, output);
}

/** nltk.chat.iesha.iesha_chat */
export function iesha_chat(input?: () => string | null | undefined, output: (s: string) => void = (s) => console.log(s)): void {
  banner("Iesha Chatbot!", ["* Type 'quit' when you have had enough."], output);
  output("hi!! i'm iesha! who are u??");
  makeChat(iesha_pairs).converse("quit", input, output);
}

/** nltk.chat.rude.rude_chat */
export function rude_chat(input?: () => string | null | undefined, output: (s: string) => void = (s) => console.log(s)): void {
  banner("Rude Chatbot!", ["* Type 'quit' when you have had enough."], output);
  output("What do you want, loser?");
  makeChat(rude_pairs).converse("quit", input, output);
}

/** nltk.chat.suntsu.suntsu_chat */
export function suntsu_chat(input?: () => string | null | undefined, output: (s: string) => void = (s) => console.log(s)): void {
  banner("Suntsu Chatbot!", ["* Type 'quit' when you have had enough."], output);
  makeChat(suntsu_pairs).converse("quit", input, output);
}

/** nltk.chat.zen.zen_chat */
export function zen_chat(input?: () => string | null | undefined, output: (s: string) => void = (s) => console.log(s)): void {
  banner("Zen Chatbot!", [
    '"Look beyond mere words and letters - look into your mind"',
    "* Talk your way to truth with Zen Chatbot.",
    "* Type 'quit' when you have had enough.",
  ], output);
  output("Welcome, my child.");
  makeChat(zen_pairs).converse("quit", input, output);
}
