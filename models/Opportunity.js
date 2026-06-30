const mongoose = require('mongoose');

const opportunitySchema = new mongoose.Schema({
  companyName: {
    type: String,
    required: [true, 'Company name is required'],
    trim: true
  },
  role: {
    type: String,
    required: [true, 'Job or internship role is required'],
    trim: true
  },
  link: {
    type: String,
    trim: true,
    validate: {
      validator: function(v) {
        if (!v || v === '') return true; // Optional field
        // Simple regex to check for absolute URL format
        return /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/.test(v);
      },
      message: props => `${props.value} is not a valid URL!`
    }
  },
  deadline: {
    type: Date,
    required: [true, 'Deadline date and time are required']
  },
  description: {
    type: String,
    trim: true
  },
  wantToApply: {
    type: Boolean,
    default: true
  },
  status: {
    type: String,
    enum: {
      values: ['Pending', 'Applied', 'Interview', 'Offer', 'Rejected'],
      message: '{VALUE} is not a supported status'
    },
    default: 'Pending'
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Opportunity', opportunitySchema);
