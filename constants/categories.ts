export const ITEM_CATEGORIES = [
  'Cash',
  'Wallet',
  'ID/Cards',
  'Phone/Gadgets',
  'Bags',
  'Clothing',
  'Books/School Supplies',
  'Keys',
  'Others',
] as const;

export type ItemCategory = (typeof ITEM_CATEGORIES)[number];

/** Categories that disable photo upload and require office pickup */
export const SENSITIVE_CATEGORIES: readonly ItemCategory[] = [
  'Cash',
  'Wallet',
  'ID/Cards',
] as const;

export const CATEGORY_ICONS: Record<ItemCategory, any> = {
  Cash: 'cash-outline',
  Wallet: 'wallet-outline',
  'ID/Cards': 'card-outline',
  'Phone/Gadgets': 'phone-portrait-outline',
  Bags: 'bag-handle-outline',
  Clothing: 'shirt-outline',
  'Books/School Supplies': 'book-outline',
  Keys: 'key-outline',
  Others: 'cube-outline',
};

export const CAMPUS_LOCATIONS = [
  'Library',
  'Cafeteria',
  'Gym',
  'Admin Building',
  'Classrooms',
  'Other',
] as const;

export type CampusLocation = (typeof CAMPUS_LOCATIONS)[number];

export const COLLEGES = [
  'College of Arts and Sciences',
  'College of Business and Accountancy',
  'College of Education',
  'College of Engineering',
  'College of Fisheries and Aquatic Sciences',
  'College of Industrial Technology',
  'College of Information and Computing Sciences',
  'College of Agriculture and Forestry',
  'Graduate School',
] as const;

export type College = (typeof COLLEGES)[number];
