import { supabase } from '@/lib/supabase';
import type { Item, ItemType, OfficeSettings } from '@/types/database';
import { SENSITIVE_CATEGORIES, type ItemCategory, type CampusLocation } from '@/constants/categories';
import { getSignedPhotoUrl } from './storage';
import { findAndNotifyMatches } from './matching';
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
  localImage?: any;
}

export interface ItemDetailResponse {
  item: ItemWithMeta;
  officeSettings?: OfficeSettings | null;
  isOwner: boolean;
  secretQuestions?: Array<{ id: string; question: string }>;
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
  amountHmac?: string;
  secretQuestions?: Array<{ question: string; answerHmac: string }>;
}

export function sanitizePublicItem<T extends Item>(item: T): T {
  const isFound = item.type === 'found';
  if (!isFound) return item;

  if (item.category === 'Cash') {
    return {
      ...item,
      title: 'Cash found',
      description: 'Cash found on campus. Claimant must verify the exact amount and details to claim.',
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

export async function fetchFeedItems(params: FeedFilterParams = {}): Promise<{
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

  let rawItems: ItemWithMeta[] = [];

  try {
    let query = supabase
      .from('items')
      .select('*')
      .eq('is_hidden', false)
      .is('deleted_at', null)
      .in('status', ['open', 'claim_requested', 'verified']);

    if (type !== 'all') query = query.eq('type', type);
    if (category && category !== 'All') query = query.eq('category', category);
    if (location && location !== 'All') query = query.eq('location', location);
    if (searchQuery.trim()) {
      const q = `%${searchQuery.trim()}%`;
      query = query.or(`title.ilike.${q},description.ilike.${q}`);
    }

    query = query.order('created_at', { ascending: sortBy === 'oldest' });
    const from = (page - 1) * pageSize;
    const to = from + pageSize;
    query = query.range(from, to);

    const { data, error } = await query;
    if (!error && data && data.length > 0) {
      rawItems = data;
    }
  } catch (err) {
    console.warn('Error fetching items from Supabase, using local items:', err);
  }

  // Fallback to local and user-created items
  if (rawItems.length === 0) {
    rawItems = LOCAL_ITEMS.filter((item) => {
      if (type !== 'all' && item.type !== type) return false;
      if (category && category !== 'All' && item.category !== category) return false;
      if (location && location !== 'All' && item.location !== location) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesTitle = item.title.toLowerCase().includes(q);
        const matchesDesc = item.description.toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc) return false;
      }
      return true;
    });

    if (sortBy === 'oldest') {
      rawItems.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    } else {
      rawItems.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
  }

  const hasMore = rawItems.length > pageSize;
  const pageItems = rawItems.slice(0, pageSize);

  const itemsWithMeta: ItemWithMeta[] = await Promise.all(
    pageItems.map(async (rawItem) => {
      const sanitized = sanitizePublicItem(rawItem);
      let signedPhotoUrl: string | null = rawItem.signedPhotoUrl || null;

      if (!signedPhotoUrl && sanitized.photo_path && !SENSITIVE_CATEGORIES.includes(sanitized.category as ItemCategory)) {
        signedPhotoUrl = await getSignedPhotoUrl(sanitized.photo_path, 3600);
      }

      return {
        ...sanitized,
        signedPhotoUrl,
        posterNickname: rawItem.posterNickname || 'Estudyante',
        posterCollege: rawItem.posterCollege || 'Campus Community',
      };
    })
  );

  return { items: itemsWithMeta, hasMore };
}

export async function fetchItemDetail(itemId: string): Promise<ItemDetailResponse> {
  const { data: { user } } = await supabase.auth.getUser();
  const localSession = await getStoredLocalSession();
  const currentUserId = user?.id || localSession?.user?.id;

  let rawItem: ItemWithMeta | null = null;

  try {
    const { data, error } = await supabase
      .from('items')
      .select('*')
      .eq('id', itemId)
      .single();

    if (!error && data) {
      rawItem = data;
    }
  } catch (err) {
    console.warn('Supabase fetchItemDetail failed, checking local:', err);
  }

  if (!rawItem) {
    rawItem = LOCAL_ITEMS.find((it) => it.id === itemId) || null;
  }

  if (!rawItem) {
    throw new Error('Hindi matagpuan ang detalye ng gamit.');
  }

  const isOwner = !!currentUserId && currentUserId === rawItem.user_id;
  const displayedItem = isOwner ? rawItem : sanitizePublicItem(rawItem);

  let signedPhotoUrl: string | null = rawItem.signedPhotoUrl || null;
  if (!signedPhotoUrl && displayedItem.photo_path && (!SENSITIVE_CATEGORIES.includes(displayedItem.category as ItemCategory) || isOwner)) {
    signedPhotoUrl = await getSignedPhotoUrl(displayedItem.photo_path, 3600);
  }

  let posterNickname = rawItem.posterNickname || 'Estudyante';
  let posterCollege = rawItem.posterCollege || 'Campus Community';

  try {
    const { data: profileData } = await supabase.rpc('get_public_profile', {
      target_user_id: displayedItem.user_id,
    });
    if (profileData && profileData.length > 0) {
      posterNickname = profileData[0].nickname;
      posterCollege = profileData[0].college;
    }
  } catch (err) {
    // ignore
  }

  let officeSettings: OfficeSettings | null = null;
  if (displayedItem.requires_office_pickup) {
    try {
      const { data: officeData } = await supabase
        .from('office_settings')
        .select('*')
        .limit(1)
        .maybeSingle();
      officeSettings = officeData;
    } catch (e) {
      // ignore
    }
  }

  let secretQuestions: Array<{ id: string; question: string }> = [];
  if (displayedItem.type === 'found' && !isOwner) {
    try {
      const { data: questionsData } = await supabase.rpc('get_item_questions', {
        p_item_id: displayedItem.id,
      });
      if (questionsData) {
        secretQuestions = questionsData;
      }
    } catch (err) {
      // ignore
    }
  }

  return {
    item: {
      ...displayedItem,
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
  const { data: { user } } = await supabase.auth.getUser();
  const localSession = await getStoredLocalSession();
  const currentUserId = user?.id || localSession?.user?.id || '00000000-0000-0000-0000-000000000002';
  const posterNickname = localSession?.profile?.nickname || 'MariaS';
  const posterCollege = localSession?.profile?.college || 'College of Information and Computing Sciences';

  if (!input.title.trim()) throw new Error('Kailangang may pamagat ang gamit.');
  if (!input.description.trim()) throw new Error('Kailangang may deskripsyon ang gamit.');
  if (!input.category) throw new Error('Pumili ng kategorya.');
  if (!input.location) throw new Error('Pumili ng lokasyon.');
  if (!input.dateHappened) throw new Error('Pumili ng petsa.');

  const isSensitive = SENSITIVE_CATEGORIES.includes(input.category);
  const photoPath = isSensitive ? null : input.photoPath || null;
  const requiresOfficePickup = isSensitive;

  // 1. Try Supabase insert
  try {
    const { data: insertedItem, error: insertError } = await supabase
      .from('items')
      .insert({
        user_id: currentUserId,
        type: input.type,
        title: input.title.trim(),
        description: input.description.trim(),
        category: input.category,
        location: input.location,
        date_happened: input.dateHappened,
        photo_path: photoPath,
        requires_office_pickup: requiresOfficePickup,
      })
      .select()
      .single();

    if (!insertError && insertedItem) {
      LOCAL_ITEMS.unshift({
        ...insertedItem,
        posterNickname,
        posterCollege,
      });

      findAndNotifyMatches(insertedItem).catch(() => {});
      return insertedItem;
    }
  } catch (err) {
    console.warn('Supabase insert failed, using local storage:', err);
  }

  // 2. Fallback local insert
  const localItem: ItemWithMeta = {
    id: 'item_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
    user_id: currentUserId,
    type: input.type,
    title: input.title.trim(),
    description: input.description.trim(),
    category: input.category,
    location: input.location,
    date_happened: input.dateHappened,
    photo_path: photoPath,
    status: 'open',
    is_hidden: false,
    requires_office_pickup: requiresOfficePickup,
    released_at: null,
    auto_confirm_at: null,
    expires_at: new Date(Date.now() + 2592000000).toISOString(),
    created_at: new Date().toISOString(),
    deleted_at: null,
    posterNickname,
    posterCollege,
  };

  LOCAL_ITEMS.unshift(localItem);
  return localItem;
}
