}
export const analytics = analyticsInstance;

// WebKit/iOS detection: Safari and iOS browsers have known IndexedDB cross-tab locking delays
const isWebKit = typeof navigator !== 'undefined' && (
  /iP(hone|od|ad)/.test(navigator.userAgent) ||
  (/^((?!chrome|android).)*safari/i.test(navigator.userAgent))
);

let localCacheConfig;
try {
  localCacheConfig = isWebKit
    ? persistentLocalCache({ tabManager: persistentSingleTabManager({ forceOwnership: false }) })
    : persistentLocalCache({ tabManager: persistentMultipleTabManager() });
} catch (e) {
  localCacheConfig = memoryLocalCache();
}

export const db = initializeFirestore(app, {
  localCache: localCacheConfig
});


// Initialize Cloud Functions
export const functions = getFunctions(app);


