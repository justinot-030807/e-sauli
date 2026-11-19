import { supabase } from '@/lib/supabase';
import type { ImageSourcePropType } from 'react-native';
import type { Item, ItemType, OfficeSettings } from '@/types/database';
import { SENSITIVE_CATEGORIES, type ItemCategory, type CampusLocation } from '@/constants/categories';
import { getSignedPhotoUrl } from './storage';
import { getStoredLocalSession } from './auth';

export interface FeedFilterParams {
  type?: 'all' | 'lost' | 'found';
  category?: ItemCategory | 'All';
  location?: CampusLocation | 'All';
  searchQuery?: string;
  sortBy?: 'newest' | 'oldest';
  page?: number;
  pageSize?: number;
}

export interface ItemWithMeta extends Item {
  signedPhotoUrl?: string | null;
  posterNickname?: string;
  posterCollege?: string;
  localImage?: ImageSourcePropType;
}

export interface ItemDetailResponse {
  item: ItemWithMeta;
  officeSettings?: OfficeSettings | null;
  isOwner: boolean;
  secretQuestions?: { id: string; question: string }[];
}

export interface CreateItemInput {
  type: ItemType;
  title: string;
  description: string;
  category: ItemCategory;
  location: CampusLocation;
  dateHappened: string;
  photoPath?: string | null;
  privateDetails?: string;
  secretQuestions?: { question: string; answerHmac: string }[];
}

export function sanitizePublicItem<T extends Item>(item: T): T {
  const isFound = item.type === 'found';
  if (!isFound) return item;

  if (item.category === 'Cash') {
    return {
      ...item,
      title: 'Cash found',
      description: 'Cash found on campus. Claimant must verify the exact amount at the Lost & Found office.',
    };
  }

  if (item.category === 'Wallet') {
    return {
      ...item,
      title: 'Wallet found',
      description: 'Wallet found on campus. Claimant must verify contents and distinctive characteristics to claim.',
    };
  }

  if (item.category === 'ID/Cards') {
    return {
      ...item,
      title: 'ID/Card found',
      description: 'Identification card found. Claimant must present identity proof matching the school records to claim.',
    };
  }

  return item;
}

export const FALLBACK_ITEMS: ItemWithMeta[] = [
  {
    id: '00000000-0000-0000-0000-000000000101',
    user_id: '00000000-0000-0000-0000-000000000002',
    type: 'found',
    title: 'Cute Pink Scientific Calculator',
    description: 'Naiwan sa Room 304 matapos ang Calculus class. Kulay pink at nasa maayos na kundisyon.',
    category: 'Phone/Gadgets',
    location: 'Classrooms',
    date_happened: new Date(Date.now() - 86400000).toISOString().split('T')[0],
    photo_path: null,
    localImage: require('@/assets/items/calculator.jpg'),
    status: 'open',
    is_hidden: false,
    requires_office_pickup: false,
    released_at: null,
    auto_confirm_at: null,
    expires_at: new Date(Date.now() + 2592000000).toISOString(),
    created_at: new Date(Date.now() - 3600000 * 3).toISOString(),
    deleted_at: null,
    posterNickname: 'MariaS',
    posterCollege: 'College of Information and Computing Sciences',
  },
  {
    id: '00000000-0000-0000-0000-000000000102',
    user_id: '00000000-0000-0000-0000-000000000003',
    type: 'found',
    title: 'Brown Leather Bifold Wallet',
    description: 'Naiwan sa mesa malapit sa counter ng University Cafeteria bandang tanghali. May resibo sa loob.',
    category: 'Wallet',
    location: 'Cafeteria',
    date_happened: new Date().toISOString().split('T')[0],
    photo_path: null,
    localImage: require('@/assets/items/wallet.jpg'),
    status: 'open',
    is_hidden: false,
    requires_office_pickup: true,
    released_at: null,
    auto_confirm_at: null,
    expires_at: new Date(Date.now() + 2592000000).toISOString(),
    created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
    deleted_at: null,
    posterNickname: 'JuanD',
    posterCollege: 'College of Business and Accountancy',
  },
  {
    id: '00000000-0000-0000-0000-000000000103',
    user_id: '00000000-0000-0000-0000-000000000004',
    type: 'lost',
    title: 'AquaFlask 32oz Insulated Tumbler',
    description: 'Naiwan sa bleachers ng University Gymnasium matapos ang PE class bandang 4:00 PM.',
    category: 'Others',
    location: 'Gym',
    date_happened: new Date(Date.now() - 86400000 * 2).toISOString().split('T')[0],
    photo_path: null,
    localImage: require('@/assets/items/tumbler.jpg'),
    status: 'open',
    is_hidden: false,
    requires_office_pickup: false,
    released_at: null,
    auto_confirm_at: null,
    expires_at: new Date(Date.now() + 2592000000).toISOString(),
    created_at: new Date(Date.now() - 3600000 * 8).toISOString(),
    deleted_at: null,
    posterNickname: 'CarloG',
    posterCollege: 'College of Engineering',
  },
  {
    id: '00000000-0000-0000-0000-000000000104',
    user_id: '00000000-0000-0000-0000-000000000005',
    type: 'found',
    title: 'Campus Student ID Card with Lanyard',
    description: 'Identification card found at 2nd floor library reading area.',
    category: 'ID/Cards',
    location: 'Library',
    date_happened: new Date().toISOString().split('T')[0],
    photo_path: null,
    localImage: require('@/assets/items/id_card.jpg'),
    status: 'open',
    is_hidden: false,
    requires_office_pickup: true,
    released_at: null,
    auto_confirm_at: null,
    expires_at: new Date(Date.now() + 2592000000).toISOString(),
    created_at: new Date(Date.now() - 3600000 * 12).toISOString(),
    deleted_at: null,
    posterNickname: 'BeaR',
    posterCollege: 'College of Education',
  },
  {
    id: '00000000-0000-0000-0000-000000000105',
    user_id: '00000000-0000-0000-0000-000000000002',
    type: 'found',
    title: 'Acer Laptop Charger (65W USB-C)',
    description: 'Naiwan nakasaksak sa IT Building Computer Lab 2.',
    category: 'Phone/Gadgets',
    location: 'IT Building',
    date_happened: new Date().toISOString().split('T')[0],
    photo_path: null,
    status: 'open',
    is_hidden: false,
    requires_office_pickup: false,
    released_at: null,
    auto_confirm_at: null,
    expires_at: new Date(Date.now() + 2592000000).toISOString(),
    created_at: new Date(Date.now() - 3600000 * 15).toISOString(),
    deleted_at: null,
    posterNickname: 'MariaS',
    posterCollege: 'College of Information and Computing Sciences',
  },
];

export const LOCAL_ITEMS: ItemWithMeta[] = [...FALLBACK_ITEMS];

export async function fetchFeedItems(params: FeedFilterParams = {}, isDemo = false): Promise<{
  items: ItemWithMeta[];
  hasMore: boolean;
}> {
  const {
    type = 'all',
    category = 'All',
    location = 'All',
    searchQuery = '',
    sortBy = 'newest',
    page = 1,
    pageSize = 15,
  } = params;

  const from = (page - 1) * pageSize;
  const to = from + pageSize;
  const search = searchQuery.trim();
  const ascending = sortBy === 'oldest';
  let rawItems: ItemWithMeta[];

  if (isDemo) {
    const normalized = search.toLowerCase();
    rawItems = LOCAL_ITEMS.map(sanitizePublicItem)
      .filter((item) =>
        (type === 'all' || item.type === type)
        && (category === 'All' || item.category === category)
        && (location === 'All' || item.location === location)
        && (item.title.toLowerCase().includes(normalized) || item.description.toLowerCase().includes(normalized)))
      .sort((left, right) => (ascending ? 1 : -1) * left.created_at.localeCompare(right.created_at))
      .slice(from, to + 1);
  } else {
    let query = supabase.from('items').select('*')
      .eq('is_hidden', false)
      .is('deleted_at', null)
      .in('status', ['open', 'claim_requested', 'verified']);

    if (type !== 'all') query = query.eq('type', type);
    if (category !== 'All') query = query.eq('category', category);
    if (location !== 'All') query = query.eq('location', location);
    if (search) {
      const pattern = '%' + search.replace(/[\\%_]/g, '\\$&') + '%';
      const quoted = '"' + pattern.replace(/[\\"]/g, '\\$&') + '"';
      query = query.or('title.ilike.' + quoted + ',description.ilike.' + quoted);
    }

    const { data, error } = await query.order('created_at', { ascending })
      .order('id', { ascending })
      .range(from, to);
    if (error) throw error;
    rawItems = data;
  }

  const hasMore = rawItems.length > pageSize;
  const pageItems = rawItems.slice(0, pageSize);

  const itemsWithMeta: ItemWithMeta[] = await Promise.all(
    pageItems.map(async (rawItem) => {
      const sanitized = sanitizePublicItem(rawItem);
      const sensitive = SENSITIVE_CATEGORIES.includes(sanitized.category as ItemCategory);
      let signedPhotoUrl: string | null = rawItem.signedPhotoUrl || null;

      if (!signedPhotoUrl && sanitized.photo_path && !sensitive) {
        signedPhotoUrl = await getSignedPhotoUrl(sanitized.photo_path, 3600);
      }

      return {
        ...sanitized,
        localImage: sensitive ? undefined : rawItem.localImage,
        signedPhotoUrl,
        posterNickname: rawItem.posterNickname || 'Estudyante',
        posterCollege: rawItem.posterCollege || 'Campus Community',
      };
    })
  );

  return { items: itemsWithMeta, hasMore };
}

export async function fetchItemDetail(itemId: string): Promise<ItemDetailResponse> {
  const { data: { session } } = await supabase.auth.getSession();
  const demo = session ? null : await getStoredLocalSession();
  const currentUserId = session?.user.id ?? demo?.user.id;
  let rawItem: ItemWithMeta | null;

  if (demo) {
    rawItem = LOCAL_ITEMS.find((item) => item.id === itemId) ?? null;
  } else {
    const { data, error } = await supabase.from('items').select('*').eq('id', itemId).maybeSingle();
    if (error) throw error;
    rawItem = data;
  }
  if (!rawItem) throw new Error('Hindi matagpuan ang detalye ng gamit.');

  const isOwner = !!currentUserId && currentUserId === rawItem.user_id;
  const displayedItem = isOwner ? rawItem : sanitizePublicItem(rawItem);

  let signedPhotoUrl: string | null = rawItem.signedPhotoUrl || null;
  if (!signedPhotoUrl && displayedItem.photo_path && (!SENSITIVE_CATEGORIES.includes(displayedItem.category as ItemCategory) || isOwner)) {
    signedPhotoUrl = await getSignedPhotoUrl(displayedItem.photo_path, 3600);
  }

  let posterNickname = rawItem.posterNickname || 'Estudyante';
  let posterCollege = rawItem.posterCollege || 'Campus Community';

  if (!demo) {
    const { data: profileData } = await supabase.rpc('get_public_profile', {
      target_user_id: displayedItem.user_id,
    });
    if (profileData && profileData.length > 0) {
      posterNickname = profileData[0].nickname;
      posterCollege = profileData[0].college;
    }
  }

  let officeSettings: OfficeSettings | null = null;
  if (!demo && displayedItem.requires_office_pickup) {
      const { data: officeData } = await supabase
        .from('office_settings')
        .select('*')
        .limit(1)
        .maybeSingle();
    officeSettings = officeData;
  }

  let secretQuestions: { id: string; question: string }[] = [];
  if (!demo && displayedItem.type === 'found' && !isOwner && ['open', 'claim_requested'].includes(displayedItem.status)) {
    const { data, error } = await supabase.rpc('get_item_questions', { p_item_id: displayedItem.id });
    if (error) throw error;
    secretQuestions = data ?? [];
  }

  return {
    item: {
      ...displayedItem,
      localImage: SENSITIVE_CATEGORIES.includes(displayedItem.category as ItemCategory) ? undefined : rawItem.localImage,
      signedPhotoUrl,
      posterNickname,
      posterCollege,
    },
    officeSettings,
    isOwner,
    secretQuestions,
  };
}

export async function createItemPost(input: CreateItemInput): Promise<Item> {
  const { data, error } = await supabase.rpc('create_item_report', {
    p_type: input.type,
    p_title: input.title.trim(),
    p_description: input.description.trim(),
    p_category: input.category,
    p_location: input.location,
    p_date: input.dateHappened,
    p_photo_path: input.photoPath ?? null,
    p_private_details: input.privateDetails?.trim() || null,
    p_question: input.secretQuestions?.[0]?.question ?? null,
    p_answer_hash: input.secretQuestions?.[0]?.answerHmac ?? null,
  });
  if (error) throw new Error(error.message);
  return data;
}
