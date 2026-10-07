export const getSafeStorage = (key, defaultValue = '') => {
  try {
    return localStorage.getItem(key) || defaultValue;
  } catch (e) {
    return defaultValue;
  }
};

export const setSafeStorage = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    // Ignore
  }
};

export const removeSafeStorage = (key) => {
  try {
    localStorage.removeItem(key);
  } catch (e) {
    // Ignore
  }
};
