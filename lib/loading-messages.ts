/**
 * Context-specific phrase sets shown during LLM waits. The UI cycles
 * through them at a steady interval so the user has a sense of what
 * the model is working on instead of a single static label.
 */

export type LoadingContext = 'briefing' | 'meal_plan' | 'training_plan';

export const LOADING_MESSAGES: Record<LoadingContext, string[]> = {
  briefing: [
    'Leser kalenderen din…',
    'Sjekker hvilke vaner som venter…',
    'Finner dagens hovedoppdrag…',
    'Velger en rolig åpning…',
    'Setter sammen dagens brief…',
  ],
  meal_plan: [
    'Leser allergier og diett…',
    'Plukker variasjon for uken…',
    'Skalerer mengder til husstanden…',
    'Finner hverdagsretter under 45 min…',
    'Setter ingredienser på plass…',
    'Skriver fremgangsmåter…',
  ],
  training_plan: [
    'Tolker målene dine…',
    'Matcher øvelser til utstyret…',
    'Tilpasser pauser til hvert mål…',
    'Fordeler push, pull og bein…',
    'Legger inn hviledager og mobility…',
    'Setter sammen ukens program…',
  ],
};
