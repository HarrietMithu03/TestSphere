const mongoose = require('mongoose');

const scanJobSchema = new mongoose.Schema(
  {
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TargetApp',
      required: [true, 'Target application reference is required'],
      index: true
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Requesting user reference is required'],
      index: true
    },
    status: {
      type: String,
      enum: {
        values: ['QUEUED', 'RUNNING', 'COMPLETED', 'PARTIALLY_COMPLETED', 'FAILED', 'CANCELLED'],
        message: '{VALUE} is not a valid scan status'
      },
      default: 'QUEUED',
      index: true
    },
    currentStage: {
      type: String,
      default: 'QUEUED',
      trim: true
    },
    progress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    pagesDiscovered: {
      type: Number,
      default: 0,
      min: 0
    },
    pagesScanned: {
      type: Number,
      default: 0,
      min: 0
    },
    startTime: {
      type: Date,
      default: null
    },
    endTime: {
      type: Date,
      default: null
    },
    durationMs: {
      type: Number,
      default: 0
    },
    modulesExecuted: {
      type: [String],
      default: []
    },
    modulesSkipped: {
      type: [String],
      default: []
    },
    errorSummary: {
      type: String,
      default: null
    },
    targetSnapshot: {
      name: String,
      targetUrl: String,
      allowedHost: String,
      environment: String,
      maxDepth: Number,
      maxPages: Number,
      rateLimitRps: Number,
      maxScanDurationSeconds: Number
    },
    findingsSummary: {
      total: { type: Number, default: 0 },
      critical: { type: Number, default: 0 },
      high: { type: Number, default: 0 },
      medium: { type: Number, default: 0 },
      low: { type: Number, default: 0 },
      info: { type: Number, default: 0 },
      confirmed: { type: Number, default: 0 },
      suspected: { type: Number, default: 0 }
    }
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      }
    }
  }
);

scanJobSchema.index({ targetId: 1, createdAt: -1 });
scanJobSchema.index({ requestedBy: 1, createdAt: -1 });

const ScanJob = mongoose.model('ScanJob', scanJobSchema);

module.exports = ScanJob;
