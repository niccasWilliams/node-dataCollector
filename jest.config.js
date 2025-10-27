/** @type {import('ts-jest').JestConfigWithTsJest} **/
module.exports = {
  testEnvironment: "node",
  forceExit: true,
  detectOpenHandles: true,
  silent: true,
  transform: {
    "^.+.tsx?$": ["ts-jest",{}],
  },
};