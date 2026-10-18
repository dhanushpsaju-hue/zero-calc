const { Schema, model } = require('mongoose');
module.exports = model('History', new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  module: { type: String, enum: ['scientific', 'currency', 'unit', 'date'], required: true },
  expression: { type: String, required: true, maxlength: 300 },
  result: { type: String, required: true, maxlength: 300 }
}, { timestamps: true }));
