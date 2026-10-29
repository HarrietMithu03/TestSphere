const mongoose = require('mongoose');

const activityItemSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      enum: ['created', 'validated', 'false_positive_flagged', 'fixed', 'retested', 'note_added'],
      required: true
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    note: {
      type: String,
      default: ''
    }
  },
  { _id: false }
);

const findingSchema = new mongoose.Schema(
  {
    scanId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ScanJob',
      required: [true, 'Scan Job ID is required'],
      index: true
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TargetApp',
      required: [true, 'Target Application ID is required'],
      index: true
    },
    category: {
      type: String,
      enum: {
        values: [
          'runtime_error',
          'console_error',
          'network_failure',
          'broken_link',
          'security_header',
          'performance',
          'accessibility'
        ],
        message: '{VALUE} is not a valid finding category'
      },
      required: [true, 'Finding category is required'],
      index: true
    },
    title: {
      type: String,
      required: [true, 'Finding title is required'],
      trim: true,
      maxlength: 250
    },
    description: {
      type: String,
      required: [true, 'Finding description is required'],
      trim: true
    },
    severity: {
      type: String,
      enum: {
        values: ['Critical', 'High', 'Medium', 'Low', 'Info'],
        message: '{VALUE} is not a valid severity level'
      },
      required: [true, 'Finding severity is required'],
      index: true
    },
    confidence: {
      type: String,
      enum: {
        values: ['Confirmed', 'Suspected'],
        message: '{VALUE} is not a valid confidence rating'
      },
      required: [true, 'Confidence level is required'],
      default: 'Confirmed',
      index: true
    },
    source: {
      type: String,
      enum: ['automated_crawler', 'human_tester'],
      default: 'automated_crawler',
      required: true
    },
    affectedUrl: {
      type: String,
      required: [true, 'Affected URL is required'],
      trim: true
    },
    affectedComponent: {
      type: String,
      default: null,
      trim: true
    },
    reproductionSteps: {
      type: [String],
      default: []
    },
    evidence: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    remediation: {
      type: String,
      default: null,
      trim: true
    },
    fingerprint: {
      type: String,
      required: [true, 'Deterministic fingerprint is required for deduplication'],
      index: true
    },
    occurrenceCount: {
      type: Number,
      default: 1,
      min: 1
    },
    occurrences: [
      {
        url: { type: String, required: true },
        timestamp: { type: Date, default: Date.now },
        extraInfo: { type: mongoose.Schema.Types.Mixed }
      }
    ],
    // Human Tester Collaboration
    humanValidation: {
      status: {
        type: String,
        enum: ['unreviewed', 'confirmed', 'false_positive', 'fixed', 'retested_pass', 'retested_fail'],
        default: 'unreviewed',
        index: true
      },
      validatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
      },
      validatedAt: {
        type: Date,
        default: null
      },
      notes: {
        type: String,
        default: null
      },
      reason: {
        type: String,
        default: null
      },
      reproductionConfirmed: {
        type: Boolean,
        default: null
      }
    },
    exploratory: {
      type: Boolean,
      default: false,
      index: true
    },
    activityHistory: [activityItemSchema]
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

findingSchema.index({ scanId: 1, fingerprint: 1 }, { unique: true });
findingSchema.index({ targetId: 1, category: 1 });

const Finding = mongoose.model('Finding', findingSchema);

module.exports = Finding;
