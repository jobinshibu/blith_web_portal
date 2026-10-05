// IndexedDB-based High-Performance Cache Manager for BLITHE
// Caches events, categories, event details, and image Blobs for instant offline / slow-network rendering.

const DB_NAME = 'blithe_events_cache_db';
const DB_VERSION = 1;
const EVENTS_STORE = 'events_meta';
const DETAILS_STORE = 'event_details';
const IMAGES_STORE = 'event_images';

// In-memory URL cache for created Blob Object URLs to prevent memory leaks and recreate overhead
const blobUrlMemoryCache = new Map();

/**
 * Open or upgrade the IndexedDB database
 */
const openDB = () => {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not supported'));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(EVENTS_STORE)) {
        db.createObjectStore(EVENTS_STORE, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(DETAILS_STORE)) {
        db.createObjectStore(DETAILS_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(IMAGES_STORE)) {
        db.createObjectStore(IMAGES_STORE, { keyPath: 'url' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

/**
 * Safely serialize Firestore timestamp objects to ISO strings / plain numbers
 * Includes circular reference detection and depth guard to prevent stack overflow.
 */
const sanitizeForStorage = (data, seen = new WeakSet(), depth = 0) => {
  if (data === null || data === undefined) return data;
  if (typeof data !== 'object') return data;
  if (depth > 12) return null; // Guard against deep or infinite recursion

  // Prevent circular references
  if (seen.has(data)) {
    return null;
  }
  seen.add(data);

  // Handle Firestore Timestamp
  if (typeof data.toDate === 'function') {
    return data.toDate().toISOString();
  }
  if (data.seconds !== undefined && data.nanoseconds !== undefined) {
    return new Date(data.seconds * 1000).toISOString();
  }
  if (data instanceof Date) {
    return data.toISOString();
  }
  if (Array.isArray(data)) {
    return data.map(item => sanitizeForStorage(item, seen, depth + 1));
  }

  // Handle Firestore DocumentReference / GeoPoint / complex SDK objects
  if (data._firestore || data.firestore || data._delegate) {
    if (data.id) return { id: data.id, path: data.path || '' };
    return null;
  }

  const clean = {};
  for (const key of Object.keys(data)) {
    // Skip internal SDK / circular keys
    if (key.startsWith('_') || key === 'firestore' || key === 'app') continue;
    clean[key] = sanitizeForStorage(data[key], seen, depth + 1);
  }
  return clean;
};

/**
 * Save all events to cache
 */
export const saveEventsToCache = async (events) => {
  if (!events || !Array.isArray(events) || events.length === 0) return;
  try {
    const cleanEvents = sanitizeForStorage(events);
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(EVENTS_STORE, 'readwrite');
      const store = tx.objectStore(EVENTS_STORE);
      const req = store.put({
        key: 'all_events',
        data: cleanEvents,
        cachedAt: Date.now()
      });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    console.log(`[CacheManager] Successfully cached ${events.length} events into IndexedDB`);

    // Also backup minimal summary to localStorage so it works even if IndexedDB is blocked or cleared
    try {
      const minimalEvents = events.slice(0, 50).map(e => ({
        id: e.id,
        eventName: e.eventName || e.title,
        title: e.title || e.eventName,
        image: e.image,
        location: e.location,
        eventStartDate: sanitizeForStorage(e.eventStartDate),
        eventEndDate: sanitizeForStorage(e.eventEndDate),
        featuredEndDate: sanitizeForStorage(e.featuredEndDate),
        category: e.category,
        tickets: e.tickets,
        priceMessage: e.priceMessage,
        isSoldOut: e.isSoldOut,
        promoted: e.promoted,
        featured: e.featured,
        block: e.block,
        isPrivateEvent: e.isPrivateEvent,
        paymentUrl: e.paymentUrl,
        status: e.status
      }));
      localStorage.setItem('blithe_cached_events_backup', JSON.stringify({
        data: minimalEvents,
        cachedAt: Date.now()
      }));
    } catch (lsErr) {}
  } catch (err) {
    console.warn('[CacheManager] Failed to save events to IndexedDB, using localStorage:', err);
    try {
      const minimalEvents = events.slice(0, 50).map(e => ({
        id: e.id,
        eventName: e.eventName || e.title,
        title: e.title || e.eventName,
        image: e.image,
        location: e.location,
        eventStartDate: sanitizeForStorage(e.eventStartDate),
        eventEndDate: sanitizeForStorage(e.eventEndDate),
        featuredEndDate: sanitizeForStorage(e.featuredEndDate),
        category: e.category,
        tickets: e.tickets,
        priceMessage: e.priceMessage,
        isSoldOut: e.isSoldOut,
        promoted: e.promoted,
        featured: e.featured,
        block: e.block,
        isPrivateEvent: e.isPrivateEvent,
        paymentUrl: e.paymentUrl,
        status: e.status
      }));
      localStorage.setItem('blithe_cached_events_backup', JSON.stringify({
        data: minimalEvents,
        cachedAt: Date.now()
      }));
    } catch (e) {}
  }
};

/**
 * Retrieve cached events from IndexedDB with localStorage fallback
 */
export const getCachedEvents = async () => {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(EVENTS_STORE, 'readonly');
      const store = tx.objectStore(EVENTS_STORE);
      const req = store.get('all_events');
      req.onsuccess = () => {
        if (req.result && Array.isArray(req.result.data) && req.result.data.length > 0) {
          resolve(req.result.data);
        } else {
          resolve(getEventsLocalStorageFallback());
        }
      };
      req.onerror = () => resolve(getEventsLocalStorageFallback());
    });
  } catch (err) {
    return getEventsLocalStorageFallback();
  }
};

const getEventsLocalStorageFallback = () => {
  try {
    const raw = localStorage.getItem('blithe_cached_events_backup');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.data)) return parsed.data;
    }
  } catch (e) {}
  return null;
};

/**
 * Save categories to cache
 */
export const saveCategoriesToCache = async (categories) => {
  if (!categories || !Array.isArray(categories) || categories.length === 0) return;
  try {
    const cleanCats = sanitizeForStorage(categories);
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(EVENTS_STORE, 'readwrite');
      const store = tx.objectStore(EVENTS_STORE);
      const req = store.put({
        key: 'all_categories',
        data: cleanCats,
        cachedAt: Date.now()
      });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    console.log(`[CacheManager] Successfully cached ${categories.length} categories into IndexedDB`);
  } catch (err) {
    console.warn('[CacheManager] Failed to cache categories:', err);
  }
};

/**
 * Get cached categories
 */
export const getCachedCategories = async () => {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(EVENTS_STORE, 'readonly');
      const store = tx.objectStore(EVENTS_STORE);
      const req = store.get('all_categories');
      req.onsuccess = () => {
        if (req.result && Array.isArray(req.result.data)) {
          resolve(req.result.data);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch (err) {
    return null;
  }
};

/**
 * Save single event full details (for EventDetails.jsx)
 */
export const saveEventDetailToCache = async (id, eventData) => {
  if (!id || !eventData) return;
  try {
    const clean = sanitizeForStorage(eventData);
    const db = await openDB();
    const tx = db.transaction(DETAILS_STORE, 'readwrite');
    const store = tx.objectStore(DETAILS_STORE);
    store.put({
      id,
      data: clean,
      cachedAt: Date.now()
    });
  } catch (err) {
    console.warn('[CacheManager] Failed to cache event details:', err);
  }
};
export const saveEventDetailsToCache = saveEventDetailToCache;

/**
 * Get cached event details by ID
 */
export const getCachedEventDetail = async (id) => {
  if (!id) return null;
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(DETAILS_STORE, 'readonly');
      const store = tx.objectStore(DETAILS_STORE);
      const req = store.get(id);
      req.onsuccess = () => {
        if (req.result && req.result.data) {
          resolve(req.result.data);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch (err) {
    return null;
  }
};
export const getCachedEventDetails = getCachedEventDetail;

/**
 * Download and cache an image as a Blob in IndexedDB
 */
export const cacheImageBlob = async (url) => {
  if (!url || typeof url !== 'string' || !url.startsWith('http')) return null;
  try {
    const db = await openDB();
    // Check if already in IndexedDB
    const existing = await new Promise((resolve) => {
      const tx = db.transaction(IMAGES_STORE, 'readonly');
      const store = tx.objectStore(IMAGES_STORE);
      const req = store.get(url);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    });
    if (existing && existing.blob) {
      return existing.blob;
    }

    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) return null;
    const blob = await response.blob();

    const tx = db.transaction(IMAGES_STORE, 'readwrite');
    const store = tx.objectStore(IMAGES_STORE);
    store.put({
      url,
      blob,
      cachedAt: Date.now()
    });
    return blob;
  } catch (err) {
    // Non-blocking: fetch might fail due to CORS or network
    return null;
  }
};

/**
 * Get a local object URL for a cached image if available (returns standard image URL fallback)
 */
export const getCachedImageUrl = async (url) => {
  if (!url) return '';
  if (blobUrlMemoryCache.has(url)) {
    return blobUrlMemoryCache.get(url);
  }
  try {
    const db = await openDB();
    const result = await new Promise((resolve) => {
      const tx = db.transaction(IMAGES_STORE, 'readonly');
      const store = tx.objectStore(IMAGES_STORE);
      const req = store.get(url);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    });

    if (result && result.blob) {
      const objectUrl = URL.createObjectURL(result.blob);
      blobUrlMemoryCache.set(url, objectUrl);
      return objectUrl;
    }
  } catch (err) {}
  return url;
};

/**
 * Preload and cache images for an array of events in background
 */
export const preloadAndCacheImages = (events) => {
  if (!events || !Array.isArray(events)) return;
  events.forEach(evt => {
    const imgUrl = Array.isArray(evt.image) ? evt.image[0] : (typeof evt.image === 'string' ? evt.image : null);
    if (imgUrl) {
      cacheImageBlob(imgUrl).catch(() => {});
    }
  });
};

