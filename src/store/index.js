import { configureStore } from '@reduxjs/toolkit';
import eventsReducer from './eventsSlice';

const store = configureStore({
  reducer: {
    events: eventsReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false, // Disable serialization check to allow Firestore Timestamps in Redux state
    }),
});

export default store;
