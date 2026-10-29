const ScanJob = require('../models/ScanJob');
const { executeScan } = require('./scannerWorker');
const { getIO } = require('../socket');

/**
 * ScanQueue: Bounded In-Process Job Queue for Automated Web Scans.
 * 
 * DESIGN NOTES & LIMITATIONS:
 * - Concurrency is capped (default: 2 simultaneous scans) to protect server CPU and memory.
 * - Jobs are tracked in-memory using AbortController tokens for instant and safe cancellation.
 * - LIMITATION: As an in-process queue, any active or pending scans will not survive a Node.js process crash or server restart.
 *   For high-availability production clusters, an external distributed queue (e.g. BullMQ with Redis) would be used.
 */
class ScanQueue {
  constructor(concurrency = 2) {
    this.concurrency = concurrency;
    this.queue = []; // Array of scanJobId strings
    this.activeJobs = new Map(); // scanJobId -> AbortController
    this.isProcessing = false;
  }

  /**
   * Enqueue a new scan job for execution
   * 
   * @param {string} scanJobId 
   */
  async enqueue(scanJobId) {
    if (this.queue.includes(scanJobId) || this.activeJobs.has(scanJobId)) {
      return; // Already in queue or running
    }

    this.queue.push(scanJobId);

    try {
      const io = getIO();
      io.to(`scan:${scanJobId}`).emit('scan:queued', {
        scanId: scanJobId,
        queuePosition: this.queue.length
      });
    } catch {
      // Socket not yet ready
    }

    this._pump();
  }

  /**
   * Cancel an active or queued scan
   * 
   * @param {string} scanJobId 
   * @returns {Promise<boolean>} True if cancelled, false if not found
   */
  async cancel(scanJobId) {
    // 1. If currently running, signal abort controller
    if (this.activeJobs.has(scanJobId)) {
      const controller = this.activeJobs.get(scanJobId);
      controller.abort();
      this.activeJobs.delete(scanJobId);

      await ScanJob.findByIdAndUpdate(scanJobId, {
        status: 'CANCELLED',
        currentStage: 'CANCELLED',
        endTime: new Date()
      });

      try {
        const io = getIO();
        io.to(`scan:${scanJobId}`).emit('scan:cancelled', {
          scanId: scanJobId,
          message: 'Scan cancelled by user request.'
        });
      } catch {}

      return true;
    }

    // 2. If sitting in queue, remove it and update database status
    const queueIndex = this.queue.indexOf(scanJobId);
    if (queueIndex !== -1) {
      this.queue.splice(queueIndex, 1);

      await ScanJob.findByIdAndUpdate(scanJobId, {
        status: 'CANCELLED',
        currentStage: 'CANCELLED',
        endTime: new Date()
      });

      try {
        const io = getIO();
        io.to(`scan:${scanJobId}`).emit('scan:cancelled', {
          scanId: scanJobId,
          message: 'Scan cancelled while waiting in queue.'
        });
      } catch {}

      return true;
    }

    // 3. Fallback: check if status in database is active
    const scan = await ScanJob.findById(scanJobId);
    if (scan && ['QUEUED', 'RUNNING'].includes(scan.status)) {
      scan.status = 'CANCELLED';
      scan.currentStage = 'CANCELLED';
      scan.endTime = new Date();
      await scan.save();
      return true;
    }

    return false;
  }

  /**
   * Checks if a scan is currently active or queued
   * 
   * @param {string} scanJobId 
   */
  isActiveOrQueued(scanJobId) {
    return this.activeJobs.has(scanJobId) || this.queue.includes(scanJobId);
  }

  /**
   * Internal worker pump that processes the next batch of queued jobs up to max concurrency
   */
  async _pump() {
    if (this.activeJobs.size >= this.concurrency || this.queue.length === 0) {
      return;
    }

    const nextScanId = this.queue.shift();
    if (!nextScanId) return;

    const abortController = new AbortController();
    this.activeJobs.set(nextScanId, abortController);

    // Launch worker asynchronously so API request lifecycle is completely unblocked
    setImmediate(async () => {
      try {
        await executeScan(nextScanId, { abortSignal: abortController.signal });
      } catch (err) {
        console.error(`[ScanQueue] Error executing scan ${nextScanId}:`, err);
      } finally {
        this.activeJobs.delete(nextScanId);
        // Pump queue for the next waiting job
        this._pump();
      }
    });

    // Check if additional slots are available
    if (this.activeJobs.size < this.concurrency && this.queue.length > 0) {
      this._pump();
    }
  }
}

// Singleton scan queue instance
const scanQueue = new ScanQueue(2);

module.exports = scanQueue;
