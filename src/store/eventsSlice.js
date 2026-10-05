import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { saveEventsToCache, saveCategoriesToCache, cacheImageBlob } from '../utils/cacheManager';

export const fetchEventsThunk = createAsyncThunk(
  'events/fetchEvents',
  async (force = false, { getState, dispatch, rejectWithValue }) => {
    try {
      const { events } = getState();
      const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache
      const now = Date.now();

      if (!force && events.events.length > 0 && (now - events.lastFetched < CACHE_DURATION)) {
        return {
          events: events.events,
          isFromCache: events.isUsingCachedData
        };
      }

      const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      startDate.setHours(0, 0, 0, 0);

      const executeQuery = async (queryLimit = null) => {
        let q;
        let snap;

        try {
          // Optimized query with date filter (retrieves active and recently ended events from the last 7 days)
          const conditions = [
            where("deleted", "==", false),
            where("block", "==", false),
            where("eventEndDate", ">=", startDate)
          ];
          if (queryLimit) conditions.push(limit(queryLimit));
          q = query(collection(db, "event"), ...conditions);
          snap = await getDocs(q);
        } catch (indexError) {
          if (indexError.message?.includes('index') || indexError.code === 'failed-precondition') {
            console.warn(
              "Firestore composite index is missing for optimized event queries:\n",
              indexError.message
            );
          }
          const fallbackConditions = [
            where("deleted", "==", false),
            where("block", "==", false)
          ];
          if (queryLimit) fallbackConditions.push(limit(queryLimit));
          q = query(collection(db, "event"), ...fallbackConditions);
          snap = await getDocs(q);
        }

        if (snap.empty) {
          const fallbackConditions = [
            where("deleted", "==", false),
            where("block", "==", false)
          ];
          if (queryLimit) fallbackConditions.push(limit(queryLimit));
          q = query(collection(db, "event"), ...fallbackConditions);
          snap = await getDocs(q);
        }

        return snap;
      };

      const fullSnapshot = await executeQuery(null);
      const isFromFirestoreCache = fullSnapshot.metadata?.fromCache === true || (typeof navigator !== 'undefined' && !navigator.onLine);

      const mapEvents = (snap) => snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })).filter(event => event.isPrivateEvent !== true);

      const fullEvents = mapEvents(fullSnapshot);
      // Persist fresh data to IndexedDB cache & cache image blobs
      if (!isFromFirestoreCache) {
        saveEventsToCache(fullEvents).catch(() => {});
        fullEvents.forEach(evt => {
          const img = Array.isArray(evt.image) ? evt.image[0] : (typeof evt.image === 'string' ? evt.image : null);
          if (img) cacheImageBlob(img).catch(() => {});
        });
      }
      return {
        events: fullEvents,
        isFromCache: isFromFirestoreCache
      };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  },
  {
    condition: (force, { getState }) => {
      if (force) return true;
      const { events } = getState();
      const CACHE_DURATION = 5 * 60 * 1000;
      const now = Date.now();
      if (events.events.length > 0 && !events.isUsingCachedData && (now - events.lastFetched < CACHE_DURATION)) {
        return false; // Skip dispatching pending and payload creator
      }
      return true;
    }
  }
);

export const fetchCategoriesThunk = createAsyncThunk(
  'events/fetchCategories',
  async (force = false, { getState, rejectWithValue }) => {
    try {
      const { events } = getState();
      const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache
      const now = Date.now();

      if (!force && events.categories.length > 0 && (now - events.categoriesLastFetched < CACHE_DURATION)) {
        return events.categories;
      }

      const catQuery = query(
        collection(db, "eventCategories"),
        where("deleted", "==", false)
      );
      const querySnapshot = await getDocs(catQuery);

      console.log("Categories count retrieved from Firestore (where condition applied):", querySnapshot.size);

      const categoriesData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Persist fresh categories to IndexedDB cache
      saveCategoriesToCache(categoriesData).catch(() => {});

      return categoriesData;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  },
  {
    condition: (force, { getState }) => {
      if (force) return true;
      const { events } = getState();
      const CACHE_DURATION = 5 * 60 * 1000;
      const now = Date.now();
      if (events.categories.length > 0 && (now - events.categoriesLastFetched < CACHE_DURATION)) {
        return false; // Skip dispatching pending and payload creator
      }
      return true;
    }
  }
);

const eventsSlice = createSlice({
  name: 'events',
  initialState: {
    events: [],
    categories: [],
    loading: false,
    categoriesLoading: false,
    error: null,
    categoriesError: null,
    lastFetched: 0,
    categoriesLastFetched: 0,
    isUsingCachedData: false,
    isRevalidating: false
  },
  reducers: {
    clearCache: (state) => {
      state.lastFetched = 0;
      state.categoriesLastFetched = 0;
    },
    setAllEvents: (state, action) => {
      state.events = action.payload;
      state.lastFetched = Date.now();
      state.isUsingCachedData = false;
    },
    setCachedEvents: (state, action) => {
      // If we don't have fresh backend events yet (or state is currently empty / cached), update with cached events
      if (state.events.length === 0 || state.isUsingCachedData) {
        state.events = action.payload;
        state.isUsingCachedData = true;
        state.loading = false;
      }
    },
    setCachedCategories: (state, action) => {
      if (state.categories.length === 0) {
        state.categories = action.payload;
        state.categoriesLoading = false;
      }
    }
  },
  extraReducers: (builder) => {
    builder
      // fetchEventsThunk
      .addCase(fetchEventsThunk.pending, (state) => {
        // If we don't have any events, show skeleton; if cached events exist, don't show full skeleton
        state.loading = state.events.length === 0;
        state.isRevalidating = true;
        state.error = null;
      })
      .addCase(fetchEventsThunk.fulfilled, (state, action) => {
        state.loading = false;
        state.isRevalidating = false;
        const eventsData = action.payload?.events || (Array.isArray(action.payload) ? action.payload : []);
        const isFromCache = action.payload?.isFromCache ?? false;

        state.isUsingCachedData = isFromCache;
        state.events = eventsData;
        if (!isFromCache) {
          state.lastFetched = Date.now();
        }
      })
      .addCase(fetchEventsThunk.rejected, (state, action) => {
        state.loading = false;
        state.isRevalidating = false;
        state.error = action.payload;
      })
      // fetchCategoriesThunk
      .addCase(fetchCategoriesThunk.pending, (state) => {
        state.categoriesLoading = state.categories.length === 0;
        state.categoriesError = null;
      })
      .addCase(fetchCategoriesThunk.fulfilled, (state, action) => {
        state.categoriesLoading = false;
        if (action.payload !== state.categories) {
          state.categories = action.payload;
          state.categoriesLastFetched = Date.now();
        }
      })
      .addCase(fetchCategoriesThunk.rejected, (state, action) => {
        state.categoriesLoading = false;
        state.categoriesError = action.payload;
      });
  }
});

export const { clearCache, setAllEvents, setCachedEvents, setCachedCategories } = eventsSlice.actions;
export default eventsSlice.reducer;
