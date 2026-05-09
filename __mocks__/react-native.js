// Minimal react-native mock for Jest (node environment).
// Only the APIs referenced by src/utils/rtl.ts are needed.
module.exports = {
  I18nManager: {
    isRTL: false,
    allowRTL: jest.fn(),
    swapLeftAndRightInRTL: jest.fn(),
    forceRTL: jest.fn(),
  },
};
