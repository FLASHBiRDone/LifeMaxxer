export type Essential = {
  id: string;
  label: string;
  emoji: string;
};

/**
 * Common non-food household staples we prompt the user about when
 * generating a shopping list from a meal plan.
 */
export const HOUSEHOLD_ESSENTIALS: Essential[] = [
  { id: 'toilet_paper', label: 'Toalettpapir', emoji: '🧻' },
  { id: 'kitchen_roll', label: 'Kjøkkenrull', emoji: '🧻' },
  { id: 'hand_soap', label: 'Håndsåpe', emoji: '🧼' },
  { id: 'dish_soap', label: 'Oppvaskmiddel', emoji: '🍽️' },
  { id: 'laundry_detergent', label: 'Vaskemiddel', emoji: '🧺' },
  { id: 'toothpaste', label: 'Tannkrem', emoji: '🦷' },
  { id: 'dental_floss', label: 'Tanntråd', emoji: '🦷' },
  { id: 'shampoo', label: 'Sjampo', emoji: '🧴' },
  { id: 'conditioner', label: 'Balsam', emoji: '🧴' },
  { id: 'deodorant', label: 'Deodorant', emoji: '🌿' },
  { id: 'menstrual', label: 'Menstruasjonsprodukter', emoji: '🩸' },
  { id: 'razor', label: 'Barberblader', emoji: '🪒' },
  { id: 'trash_bags', label: 'Søppelposer', emoji: '🗑️' },
  { id: 'wipes', label: 'Kjøkkenkluter', emoji: '🧽' },
];
