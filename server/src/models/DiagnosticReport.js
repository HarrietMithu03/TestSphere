const mongoose = require('mongoose');

const passedCheckSchema = new mongoose.Schema(
  {
    module: { type: String, required: true },
    checkName: { type: String, required: true },
    description: { type: String, required: true },
    evidence: { type: mongoose.Schema.Types.Mixed, default: {} },
    evaluatedAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const checkNotPerformedSchema = new mongoose.Schema(
  {
    module: { type: String, required: true },
    checkName: { type: String, required: true },
    reason: { type: String, required: true }
  },
  { _id: false }
);

const diagnosticReportSchema = new mongoose.Schema(
  {
    scanId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ScanJob',
      required: [true, 'ScanJob reference is required'],
      unique: true,
      index: true
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TargetApp',
      required: [true, 'TargetApp reference is required'],
      index: true
    },
    generatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required']
    },
    reportNumber: {
      type: String,
      required: true,
      unique: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    executiveSummary: {
      type: String,
      required: true
    },
    healthScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    },
    scope: {
      targetUrl: String,
      allowedHost: String,
      environment: String,
      maxDepth: Number,
      maxPages: Number,
      crawlDurationMs: Number
    },
    pagesScanned: {
      type: Number,
      default: 0
    },
    pagesDiscovered: {
      type: Number,
      default: 0
    },
    modulesExecuted: {
      type: [String],
      default: []
    },
    severityCounts: {
      critical: { type: Number, default: 0 },
      high: { type: Number, default: 0 },
      medium: { type: Number, default: 0 },
      low: { type: Number, default: 0 },
      info: { type: Number, default: 0 },
      total: { type: Number, default: 0 }
    },
    // Classification 1: Confirmed issues
    confirmedIssues: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Finding'
      }
    ],
    // Classification 2: Suspected issues
    suspectedIssues: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Finding'
      }
    ],
    // Classification 3: Passed checks with supporting evidence
    passedChecks: [passedCheckSchema],
    // Classification 4: Checks not performed, including technical reasons
    checksNotPerformed: [checkNotPerformedSchema],
    status: {
      type: String,
      enum: ['draft', 'final', 'archived'],
      default: 'final'
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

diagnosticReportSchema.index({ targetId: 1, createdAt: -1 });

const DiagnosticReport = mongoose.model('DiagnosticReport', diagnosticReportSchema);

module.exports = DiagnosticReport;
