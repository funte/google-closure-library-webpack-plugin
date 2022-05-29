export const schema: any = {
  type: 'object',
  properties: {
    base: { type: 'string' },
    sources: {
      anyOf: [
        { type: 'string' },
        { type: 'array', items: { type: 'string' } }
      ]
    },
    target: {
      enum: ['esm', 'commonjs']
    },
    defs: {
      type: 'array',
      items: {
        type: 'array',
        prefixItems: [{ type: "string" }],
        minItems: 1,
        maxItems: 2,
        items: {
          anyOf: [
            { type: 'string' },
            { type: 'boolean' },
            { type: 'number' },
            { instanceof: 'RegExp' },
            { instanceof: 'Function' }
          ]
        }
      }
    },
    checkExposed: { type: 'boolean' },
    debug: {
      type: 'object',
      properties: {
        logTransformed: { type: 'boolean' },
      },
      additionalProperties: false
    },
  },
  required: ['sources'],
  additionalProperties: false
};
