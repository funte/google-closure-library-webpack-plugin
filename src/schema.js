module.exports = {
  type: 'object',
  properties: {
    goog: {
      description: "Path to Closure Library base.js file",
      type: "string"
    },
    sources: {
      description: 'Directories and JS files path to scan dependencies.',
      type: 'array',
      items: { type: 'string' },
    },
    excludes: {
      description: 'Exclude directories and JS files path.',
      type: 'array',
      items: { type: 'string' },
    }
  }
};