import { supabase } from '@/lib/supabase';
import type { Item, ItemType, OfficeSettings } from '@/types/database';
import { SENSITIVE_CATEGORIES, type ItemCategory, type CampusLocation } from '@/constants/categories';
import { getSignedPhotoUrl } from './storage';
import { findAndNotifyMatches } from './matching';

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
  // Optional private fields for Found items
  privateDetails?: string;
  amountHmac?: string;
  secretQuestions?: Array<{ question: string; answerHmac: string }>;
}

/**
 * Sanitizes sensitive item title and description for public display
 * per Specification Section 8:
 * - For Cash: "Cash found" - Do NOT display exact amount
 * - For Wallet: "Wallet found" - Do NOT display contents or exact cash amount
 * - For ID/Cards: Do NOT display ID number or personal identifying information
 */
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

/**
 * Fetches feed items with filtering, search, pagination, and public data sanitization.
 */
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

  let query = supabase
    .from('items')
    .select('*')
    .eq('is_hidden', false)
    .is('deleted_at', null)
    .in('status', ['open', 'claim_requested', 'verified']);

  // Filter by item type (lost vs found)
  if (type !== 'all') {
    query = query.eq('type', type);
  }

  // Filter by category
  if (category && category !== 'All') {
    query = query.eq('category', category);
  }

  // Filter by location
  if (location && location !== 'All') {
    query = query.eq('location', location);
  }

  // Search keyword (case-insensitive title or description)
  if (searchQuery.trim()) {
    const q = `%${searchQuery.trim()}%`;
    query = query.or(`title.ilike.${q},description.ilike.${q}`);
  }

  // Sort order
  query = query.order('created_at', { ascending: sortBy === 'oldest' });

  // Pagination
  const from = (page - 1) * pageSize;
  const to = from + pageSize;
  query = query.range(from, to);

  const { data, error } = await query;
  if (error) {
    console.error('Error fetching feed items:', error);
    throw new Error(error.message);
  }

  let rawItems = data || [];
  if (rawItems.length === 0) {
    rawItems = [
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
        updated_at: new Date(Date.now() - 3600000 * 3).toISOString(),
        deleted_at: null,
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
        updated_at: new Date(Date.now() - 3600000 * 5).toISOString(),
        deleted_at: null,
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
        updated_at: new Date(Date.now() - 3600000 * 8).toISOString(),
        deleted_at: null,
      },
      {
        id: '00000000-0000-0000-0000-000000000104',
        user_id: '00000000-0000-0000-0000-000000000005',
        type: 'found',
        title: 'MarSU Student ID Card with Lanyard',
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
        updated_at: new Date(Date.now() - 3600000 * 12).toISOString(),
        deleted_at: null,
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
        updated_at: new Date(Date.now() - 3600000 * 15).toISOString(),
        deleted_at: null,
      }
    ] as any;
  }
  const hasMore = rawItems.length > pageSize;
  const pageItems = rawItems.slice(0, pageSize);

  // Process items: sanitize sensitive items and resolve signed photo URLs in parallel
  const itemsWithMeta: ItemWithMeta[] = await Promise.all(
    pageItems.map(async (rawItem) => {
      const sanitized = sanitizePublicItem(rawItem);
      let signedPhotoUrl: string | null = null;

      if (sanitized.photo_path && !SENSITIVE_CATEGORIES.includes(sanitized.category as ItemCategory)) {
        signedPhotoUrl = await getSignedPhotoUrl(sanitized.photo_path, 3600);
      }

      return {
        ...sanitized,
        signedPhotoUrl,
      };
    })
  );

  return { items: itemsWithMeta, hasMore };
}

/**
 * Fetches item details for a specific item, along with poster profile,
 * office hours (if sensitive), and secret questions (if eligible).
 */
export async function fetchItemDetail(itemId: string): Promise<ItemDetailResponse> {
  const { data: { user } } = await supabase.auth.getUser();

  const { data: rawItem, error } = await supabase
    .from('items')
    .select('*')
    .eq('id', itemId)
    .single();

  if (error || !rawItem) {
    throw new Error('Item not found or has been removed.');
  }

  const isOwner = user?.id === rawItem.user_id;

  // Mask sensitive public data unless the user is the original finder
  const displayedItem = isOwner ? rawItem : sanitizePublicItem(rawItem);

  // Resolve signed photo URL
  let signedPhotoUrl: string | null = null;
  if (displayedItem.photo_path && (!SENSITIVE_CATEGORIES.includes(displayedItem.category as ItemCategory) || isOwner)) {
    signedPhotoUrl = await getSignedPhotoUrl(displayedItem.photo_path, 3600);
  }

  // Fetch poster's public nickname and college
  let posterNickname = 'Student';
  let posterCollege = 'Campus';

  try {
    const { data: profileData } = await supabase.rpc('get_public_profile', {
      target_user_id: displayedItem.user_id,
    });
    if (profileData && profileData.length > 0) {
      posterNickname = profileData[0].nickname;
      posterCollege = profileData[0].college;
    }
  } catch (err) {
    console.warn('Could not fetch poster public profile:', err);
  }

  // Fetch office settings if item requires office pickup
  let officeSettings: OfficeSettings | null = null;
  if (displayedItem.requires_office_pickup) {
    const { data: officeData } = await supabase
      .from('office_settings')
      .select('*')
      .limit(1)
      .maybeSingle();
    officeSettings = officeData;
  }

  // Fetch secret questions if Found post
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
      console.warn('Could not fetch item questions:', err);
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

/**
 * Creates a new Lost or Found item post with server-side validations,
 * office pickup enforcement, private details storage, and automated matching.
 */
export async function createItemPost(input: CreateItemInput): Promise<Item> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated.');

  // Validate required fields
  if (!input.title.trim()) throw new Error('Title is required.');
  if (!input.description.trim()) throw new Error('Description is required.');
  if (!input.category) throw new Error('Category is required.');
  if (!input.location) throw new Error('Location is required.');
  if (!input.dateHappened) throw new Error('Date happened is required.');

  // Sensitive category rules: photo is prohibited
  const isSensitive = SENSITIVE_CATEGORIES.includes(input.category);
  const photoPath = isSensitive ? null : input.photoPath || null;
  const requiresOfficePickup = isSensitive;

  // Insert item
  const { data: insertedItem, error: insertError } = await supabase
    .from('items')
    .insert({
      user_id: user.id,
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

  if (insertError || !insertedItem) {
    throw new Error(insertError?.message || 'Failed to create post.');
  }

  // If found post with private details or amount HMAC, insert into item_private
  if (input.type === 'found' && (input.privateDetails || input.amountHmac)) {
    const { error: privateError } = await supabase.from('item_private').insert({
      item_id: insertedItem.id,
      private_details: input.privateDetails?.trim() || null,
      amount_hmac: input.amountHmac?.trim() || null,
    });
    if (privateError) {
      console.error('Error inserting item_private:', privateError);
    }
  }

  // If found post with secret questions, insert into secret_questions
  if (input.type === 'found' && input.secretQuestions && input.secretQuestions.length > 0) {
    const questionsToInsert = input.secretQuestions.map((q) => ({
      item_id: insertedItem.id,
      question: q.question.trim(),
      answer_hmac: q.answerHmac.trim(),
    }));

    const { error: questionsError } = await supabase
      .from('secret_questions')
      .insert(questionsToInsert);

    if (questionsError) {
      console.error('Error inserting secret_questions:', questionsError);
    }
  }

  // Run deterministic matching engine asynchronously
  findAndNotifyMatches(insertedItem).catch((err) => {
    console.error('Background matching error:', err);
  });

  return insertedItem;
}
