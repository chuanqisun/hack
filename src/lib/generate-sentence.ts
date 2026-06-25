export function generateSentence() {
  const subjects = ["i", "we", "you", "it"];
  const verbs = ["be", "are", "am", "is"];
  const adjs = ["good", "bad", "happy", "sad"];

  const randomFromArray = (input: any[]) => input.at(Math.floor(Math.random() * input.length));

  return `${randomFromArray(subjects)} ${randomFromArray(verbs)} ${randomFromArray(adjs)}`;
}
