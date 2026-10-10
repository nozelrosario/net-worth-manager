let memoryStorage = {};

export const getSafeStorage = (key, defaultValue = '') => {
  try {
    const val = localStorage.getItem(key);
    if (val !== null) return val;
  } catch (e) {
    // Ignore
  }
  return memoryStorage[key] !== undefined ? memoryStorage[key] : defaultValue;
};

export const setSafeStorage = (key, value) => {
  memoryStorage[key] = value;
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    // Ignore
  }
};

export const removeSafeStorage = (key) => {
  delete memoryStorage[key];
  try {
    localStorage.removeItem(key);
  } catch (e) {
    // Ignore
  }
};
