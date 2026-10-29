const mongoose = require('mongoose');
const crypto = require('crypto');

const targetAppSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Application name is required'],
      trim: true,
      minlength: [2, 'Application name must be at least 2 characters long'],
      maxlength: [100, 'Application name cannot exceed 100 characters']
    },
    targetUrl: {
      type: String,
      required: [true, 'Target application URL is required'],
      trim: true,
      lowercase: true,
      validate: {
        validator: function (url) {
          try {
            const parsed = new URL(url);
            return parsed.protocol === 'http:' || parsed.protocol === 'https:';
          } catch {
            return false;
          }
        },
        message: 'Target URL must be a valid HTTP or HTTPS address.'
      }
    },
    environment: {
      type: String,
      enum: {
        values: ['production', 'staging', 'development', 'preview'],
        message: '{VALUE} is not a valid environment. Options: production, staging, development, preview'
      },
      default: 'staging',
      required: true
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Application owner is required'],
      index: true
    },
    authorizedScope: {
      allowedHost: {
        type: String,
        required: true,
        trim: true
      },
      allowSubdomains: {
        type: Boolean,
        default: false
      },
      maxDepth: {
        type: Number,
        default: 3,
        min: [1, 'Crawl depth must be at least 1'],
        max: [10, 'Maximum crawl depth cannot exceed 10']
      },
      maxPages: {
        type: Number,
        default: 25,
        min: [1, 'Page limit must be at least 1'],
        max: [100, 'Page limit cannot exceed 100']
      }
    },
    ownershipVerification: {
      status: {
        type: String,
        enum: ['unverified', 'pending', 'verified'],
        default: 'unverified'
      },
      verificationMethod: {
        type: String,
        enum: ['developer_declaration', 'html_meta', 'dns_txt', 'file_upload'],
        default: 'developer_declaration'
      },
      verificationToken: {
        type: String,
        default: () => `testsphere-verify-${crypto.randomBytes(16).toString('hex')}`
      },
      declarationConfirmed: {
        type: Boolean,
        default: false,
        required: [true, 'Ownership or authorization declaration is required']
      },
      verifiedAt: {
        type: Date,
        default: null
      }
    },
    scanPolicy: {
      rateLimitRps: {
        type: Number,
        default: 2,
        min: 1,
        max: 10
      },
      maxScanDurationSeconds: {
        type: Number,
        default: 300,
        min: 30,
        max: 1800
      },
      respectRobotsTxt: {
        type: Boolean,
        default: true
      },
      userAgent: {
        type: String,
        default: 'TestSphere-Diagnostics/1.0 (+https://testsphere.io/bot)'
      },
      authConfig: {
        type: {
          type: String,
          enum: ['none', 'test_credentials', 'custom_header'],
          default: 'none'
        },
        customHeader: {
          name: { type: String, trim: true, default: '' },
          value: { type: String, trim: true, default: '' }
        },
        testAccount: {
          loginUrl: { type: String, trim: true, default: '' },
          username: { type: String, trim: true, default: '' },
          password: { type: String, trim: true, default: '' },
          usernameSelector: { type: String, default: 'input[name="username"], input[type="email"]' },
          passwordSelector: { type: String, default: 'input[name="password"], input[type="password"]' },
          submitSelector: { type: String, default: 'button[type="submit"], input[type="submit"]' }
        }
      }
    },
    assignedTesters: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        index: true
      }
    ],
    status: {
      type: String,
      enum: ['active', 'paused', 'archived'],
      default: 'active'
    },
    lastScanAt: {
      type: Date,
      default: null
    },
    healthScore: {
      type: Number,
      min: 0,
      max: 100,
      default: null
    },
    stats: {
      totalScans: { type: Number, default: 0 },
      openFindings: { type: Number, default: 0 },
      criticalIssues: { type: Number, default: 0 }
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

// Pre-validate hook to extract allowedHost from targetUrl if missing
targetAppSchema.pre('validate', function (next) {
  if (this.targetUrl && (!this.authorizedScope || !this.authorizedScope.allowedHost)) {
    try {
      const parsed = new URL(this.targetUrl);
      if (!this.authorizedScope) {
        this.authorizedScope = {};
      }
      this.authorizedScope.allowedHost = parsed.hostname;
    } catch {
      // Handled by targetUrl validator
    }
  }
  next();
});

const TargetApp = mongoose.model('TargetApp', targetAppSchema);

module.exports = TargetApp;
