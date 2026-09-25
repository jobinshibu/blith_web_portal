import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../firebase';

export const fetchEventsThunk = createAsyncThunk(
  'events/fetchEvents',
  async (force = false, { getState, dispatch, rejectWithValue }) => {
    try {
      const { events } = getState();
      const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache
      const now = Date.now();

      if (!force && events.events.length > 0 && (now - events.lastFetched < CACHE_DURATION)) {
        return events.events;
      }

      const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      startDate.setHours(0, 0, 0, 0);

      const executeQuery = async (queryLimit = null) => {
        let q;
        let snap;

        try {
          // Try optimized query with date filter
          const conditions = [
            where("deleted", "==", false),
            where("block", "==", false),
            where("status", "==", 0),
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
            where("block", "==", false),
            where("status", "==", 0)
          ];
          if (queryLimit) fallbackConditions.push(limit(queryLimit));
          q = query(collection(db, "event"), ...fallbackConditions);
          snap = await getDocs(q);
        }

        if (snap.empty) {
          const fallbackConditions = [
            where("deleted", "==", false),
            where("block", "==", false),
            where("status", "==", 0)
          ];
          if (queryLimit) fallbackConditions.push(limit(queryLimit));
          q = query(collection(db, "event"), ...fallbackConditions);
          snap = await getDocs(q);
        }

        if (snap.empty) {
          try {
            const stringConditions = [
              where("deleted", "==", false),
              where("block", "==", false),
              where("status", "==", "0")
            ];
            if (queryLimit) stringConditions.push(limit(queryLimit));
            snap = await getDocs(query(collection(db, "event"), ...stringConditions));
          } catch (e) {
            console.warn("String status '0' query fallback:", e);
          }
        }

        return snap;
      };

      // 1. Fetch initial batch with limit(6) for instant first-screen rendering
      const initialSnapshot = await executeQuery(6);

      const mapEvents = (snap) => snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })).filter(event => event.isPrivateEvent !== true);

      const initialEvents = mapEvents(initialSnapshot);

      // 2. If initial batch filled limit, stream complete events in background without blocking initial paint
      if (initialSnapshot.size >= 6) {
        setTimeout(async () => {
          try {
            const fullSnapshot = await executeQuery(null);
            if (fullSnapshot && !fullSnapshot.empty) {
              const fullEvents = mapEvents(fullSnapshot);
              dispatch(eventsSlice.actions.setAllEvents(fullEvents));
            }
          } catch (bgErr) {
            console.warn("Background full events fetch error:", bgErr);
          }
        }, 150);
      }

      return initialEvents;
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
      if (events.events.length > 0 && (now - events.lastFetched < CACHE_DURATION)) {
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
    categoriesLastFetched: 0
  },
  reducers: {
    clearCache: (state) => {
      state.lastFetched = 0;
      state.categoriesLastFetched = 0;
    },
    setAllEvents: (state, action) => {
      state.events = action.payload;
      state.lastFetched = Date.now();
    }
  },
  extraReducers: (builder) => {
    builder
      // fetchEventsThunk
      .addCase(fetchEventsThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchEventsThunk.fulfilled, (state, action) => {
        state.loading = false;
        // Check if we actually fetched new data or returned cached data
        if (action.payload !== state.events) {
          state.events = action.payload;
          state.lastFetched = Date.now();
        }
      })
      .addCase(fetchEventsThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // fetchCategoriesThunk
      .addCase(fetchCategoriesThunk.pending, (state) => {
        state.categoriesLoading = true;
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

export const { clearCache, setAllEvents } = eventsSlice.actions;
export default eventsSlice.reducer;
