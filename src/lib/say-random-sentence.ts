import { generateSentence } from "./generate-sentence";
import { say } from "./say-hello";

document.addEventListener("click", () => say(generateSentence()));
