const express = require('express');
const router = express.Router();
const Opportunity = require('../models/Opportunity');
const { protect } = require('../middleware/auth');

// Apply protection middleware to all routes
router.use(protect);

// @desc    Get dashboard stats for opportunities
// @route   GET /api/opportunities/stats
// @access  Private
router.get('/stats', async (req, res) => {
  try {
    const userId = req.user._id;

    // 1. Get totals
    const total = await Opportunity.countDocuments({ userId });
    const intentYes = await Opportunity.countDocuments({ userId, wantToApply: true });
    const intentNo = await Opportunity.countDocuments({ userId, wantToApply: false });

    // 2. Get status counts (only for opportunities with wantToApply = true)
    const statusCounts = await Opportunity.aggregate([
      { $match: { userId, wantToApply: true } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    const breakdown = {
      Pending: 0,
      Applied: 0,
      Interview: 0,
      Offer: 0,
      Rejected: 0
    };

    statusCounts.forEach(item => {
      if (breakdown.hasOwnProperty(item._id)) {
        breakdown[item._id] = item.count;
      }
    });

    // 3. Get the last 3 added opportunities (Recent Activity)
    const recentActivity = await Opportunity.find({ userId })
      .sort({ createdAt: -1 })
      .limit(3);

    res.status(200).json({
      success: true,
      stats: {
        total,
        intentYes,
        intentNo,
        breakdown,
        recentActivity
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching opportunity analytics'
    });
  }
});

// @desc    Get all opportunities for logged-in user (with filters, search, and sorting)
// @route   GET /api/opportunities
// @access  Private
router.get('/', async (req, res) => {
  try {
    const query = { userId: req.user._id };

    // Search by companyName (case-insensitive)
    if (req.query.search) {
      query.companyName = { $regex: req.query.search, $options: 'i' };
    }

    // Filter by status
    if (req.query.status) {
      query.status = req.query.status;
    }

    // Filter by wantToApply (intent)
    if (req.query.wantToApply) {
      query.wantToApply = req.query.wantToApply === 'true';
    }

    // Sort: automatically by deadline ASCENDING (closest deadline first)
    const opportunities = await Opportunity.find(query).sort({ deadline: 1 });

    res.status(200).json({
      success: true,
      count: opportunities.length,
      data: opportunities
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching opportunities'
    });
  }
});

// @desc    Create a new opportunity
// @route   POST /api/opportunities
// @access  Private
router.post('/', async (req, res) => {
  try {
    const { companyName, role, link, deadline, description, wantToApply, status } = req.body;

    if (!companyName || !role || !deadline) {
      return res.status(400).json({
        success: false,
        message: 'Company name, role, and deadline are required fields'
      });
    }

    const opportunity = await Opportunity.create({
      companyName,
      role,
      link,
      deadline,
      description,
      wantToApply: wantToApply !== undefined ? wantToApply : true,
      status: status || 'Pending',
      userId: req.user._id
    });

    res.status(201).json({
      success: true,
      data: opportunity
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error creating opportunity'
    });
  }
});

// @desc    Update an opportunity
// @route   PUT /api/opportunities/:id
// @access  Private
router.put('/:id', async (req, res) => {
  try {
    let opportunity = await Opportunity.findById(req.params.id);

    if (!opportunity) {
      return res.status(404).json({
        success: false,
        message: 'Opportunity not found'
      });
    }

    // Ownership check
    if (opportunity.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to modify this opportunity'
      });
    }

    const { companyName, role, link, deadline, description, wantToApply, status } = req.body;

    // Enforce that intent cannot be set to false if status is not 'Pending'
    if (status && status !== 'Pending' && wantToApply === false) {
      return res.status(400).json({
        success: false,
        message: 'Application intent must be Yes once status is changed from Pending'
      });
    }

    opportunity = await Opportunity.findByIdAndUpdate(
      req.params.id,
      { companyName, role, link, deadline, description, wantToApply, status },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      data: opportunity
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error updating opportunity'
    });
  }
});

// @desc    Toggle wantToApply (intent) status
// @route   PATCH /api/opportunities/:id/toggle
// @access  Private
router.patch('/:id/toggle', async (req, res) => {
  try {
    let opportunity = await Opportunity.findById(req.params.id);

    if (!opportunity) {
      return res.status(404).json({
        success: false,
        message: 'Opportunity not found'
      });
    }

    // Ownership check
    if (opportunity.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to modify this opportunity'
      });
    }

    // Validation: Prevent toggling to false if status is not Pending
    if (opportunity.status !== 'Pending' && opportunity.wantToApply === true) {
      return res.status(400).json({
        success: false,
        message: 'Application intent is locked to Yes once status is changed from Pending'
      });
    }

    // Toggle the wantToApply boolean value
    opportunity.wantToApply = !opportunity.wantToApply;
    await opportunity.save();

    res.status(200).json({
      success: true,
      data: opportunity
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error toggling application intent'
    });
  }
});

// @desc    Delete an opportunity
// @route   DELETE /api/opportunities/:id
// @access  Private
router.delete('/:id', async (req, res) => {
  try {
    const opportunity = await Opportunity.findById(req.params.id);

    if (!opportunity) {
      return res.status(404).json({
        success: false,
        message: 'Opportunity not found'
      });
    }

    // Ownership check
    if (opportunity.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this opportunity'
      });
    }

    await opportunity.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Opportunity deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error deleting opportunity'
    });
  }
});

module.exports = router;
