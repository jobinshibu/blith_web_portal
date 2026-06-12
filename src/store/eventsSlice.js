import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

export const fetchEventsThunk = createAsyncThunk(
  'events/fetchEvents',
  async (force = false, { getState, rejectWithValue }) => {
    try {
      const { events } = getState();
      const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache
      const now = Date.now();

      if (!force && events.events.length > 0 && (now - events.lastFetched < CACHE_DURATION)) {
        return events.events;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0); // Start of today

      let eventsQuery;
      let querySnapshot;

      try {
        // Try optimized query with date filter to retrieve events ending from today onwards
        eventsQuery = query(
          collection(db, "event"),
          where("deleted", "==", false),
          where("block", "==", false),
          where("eventEndDate", ">=", today)
        );
        querySnapshot = await getDocs(eventsQuery);
      } catch (indexError) {
        // Handle missing composite index error gracefully
        if (indexError.message?.includes('index') || indexError.code === 'failed-precondition') {
          console.warn(
            "Firestore composite index is missing for optimized event queries. Please create the index using this link:\n",
            indexError.message
          );
        } else {
          console.error("Error executing optimized query, falling back:", indexError);
        }

        // Fallback query without range condition (will retrieve all deleted/non-blocked events)
        eventsQuery = query(
          collection(db, "event"),
          where("deleted", "==", false),
          where("block", "==", false)
        );
        querySnapshot = await getDocs(eventsQuery);
      }

      // Fallback for local testing if no deleted events exist
      if (querySnapshot.empty) {
        eventsQuery = query(
          collection(db, "event"),
          where("deleted", "==", false),
          where("block", "==", false)
        );
        querySnapshot = await getDocs(eventsQuery);
      }

      console.log("Events count retrieved from Firestore (where condition applied):", querySnapshot.size);

      const eventsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      return eventsData;
    } catch (error) {
      return rejectWithValue(error.message);
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

export const { clearCache } = eventsSlice.actions;
export default eventsSlice.reducer;
