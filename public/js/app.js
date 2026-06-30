/**
 * CareerTrack - Opportunities Tracker SPA Frontend Logic
 */

document.addEventListener('DOMContentLoaded', () => {
  // ==========================================================================
  // STATE MANAGEMENT
  // ==========================================================================
  let currentUser = null;
  let activeOpportunities = [];
  let editMode = false;
  let searchTimeout = null;

  // Notification scheduling storage
  // Map of opportunityId -> array of setTimeout IDs
  const scheduledNotifications = new Map();

  // ==========================================================================
  // DOM ELEMENT SELECTIONS
  // ==========================================================================
  // Views
  const authView = document.getElementById('auth-view');
  const dashboardView = document.getElementById('dashboard-view');
  
  // Navigation
  const navControls = document.getElementById('nav-controls');
  const userDisplayName = document.getElementById('user-display-name');
  const logoutBtn = document.getElementById('logout-btn');
  const navLogo = document.getElementById('nav-logo');

  // Forms
  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');
  const toSignupLink = document.getElementById('to-signup');
  const toLoginLink = document.getElementById('to-login');

  // Dashboard Stats
  const statTotal = document.getElementById('stat-total-count');
  const statYes = document.getElementById('stat-yes-count');
  const statNo = document.getElementById('stat-no-count');
  const statPending = document.getElementById('stat-pending-count');
  const statApplied = document.getElementById('stat-applied-count');
  const statInterview = document.getElementById('stat-interview-count');
  const statOffer = document.getElementById('stat-offer-count');
  const statRejected = document.getElementById('stat-rejected-count');

  // Dashboard Controls & Lists
  const searchInput = document.getElementById('search-input');
  const intentFilter = document.getElementById('intent-filter');
  const statusFilter = document.getElementById('status-filter');
  const addJobBtn = document.getElementById('add-job-btn'); // Remains add-job-btn for matching HTML
  const jobsListContainer = document.getElementById('jobs-list-container');
  const recentActivityList = document.getElementById('recent-activity-list');
  const emptyState = document.getElementById('empty-state');
  const jobsTable = document.getElementById('jobs-table');

  // Modals
  const jobModal = document.getElementById('job-modal');
  const jobForm = document.getElementById('job-form');
  const jobIdInput = document.getElementById('job-id');
  const modalTitle = document.getElementById('modal-title');
  const modalCompany = document.getElementById('modal-company');
  const modalRole = document.getElementById('modal-role');
  const modalLink = document.getElementById('modal-link');
  const modalDeadline = document.getElementById('modal-deadline');
  const modalStatus = document.getElementById('modal-status');
  const modalWantApply = document.getElementById('modal-want-apply');
  const modalIntentText = document.getElementById('modal-intent-text');
  const modalNotes = document.getElementById('modal-notes');
  const closeJobModalBtn = document.getElementById('close-job-modal-btn');
  const cancelJobModalBtn = document.getElementById('cancel-job-modal-btn');

  // Delete Modal
  const deleteModal = document.getElementById('delete-modal');
  const closeDeleteModalBtn = document.getElementById('close-delete-modal-btn');
  const cancelDeleteBtn = document.getElementById('cancel-delete-btn');
  const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
  const deleteCompanyName = document.getElementById('delete-company-name');
  const deleteJobRole = document.getElementById('delete-job-role');
  let opportunityToDeleteId = null;

  // Toast Container
  const toastContainer = document.getElementById('toast-container');

  // ==========================================================================
  // TOAST NOTIFICATION SYSTEM
  // ==========================================================================
  const showToast = (message, type = 'info') => {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let iconClass = 'fa-circle-info';
    if (type === 'success') iconClass = 'fa-circle-check';
    if (type === 'error') iconClass = 'fa-circle-exclamation';

    toast.innerHTML = `
      <i class="fa-solid ${iconClass}"></i>
      <span>${message}</span>
    `;

    toastContainer.appendChild(toast);

    // Slide out after 3.5 seconds
    setTimeout(() => {
      toast.style.animation = 'slideInRight 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) reverse forwards';
      setTimeout(() => {
        toast.remove();
      }, 300);
    }, 3500);
  };

  // ==========================================================================
  // NATIVE WEB BROWSER NOTIFICATIONS SCHEDULER
  // ==========================================================================
  const requestNotificationPermission = () => {
    if ('Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
            showToast('Deadline alerts enabled!', 'success');
          }
        });
      }
    }
  };

  const scheduleOpportunityNotifications = (opp) => {
    // 1. Clear any existing timeouts for this opportunity first
    cancelScheduledNotifications(opp._id);

    // 2. Only schedule if intent is YES (wantToApply is true)
    if (!opp.wantToApply) return;

    const deadlineTime = new Date(opp.deadline).getTime();
    const now = Date.now();

    // If deadline is already in the past, do not schedule
    if (deadlineTime <= now) return;

    const timeouts = [];

    // Helper to schedule a setTimeout alert
    const scheduleReminder = (hoursBeforeText, timeOffsetMs) => {
      const triggerTime = deadlineTime - timeOffsetMs;
      if (triggerTime > now) {
        const delay = triggerTime - now;
        const timeoutId = setTimeout(() => {
          triggerBrowserAlert(opp, hoursBeforeText);
        }, delay);
        timeouts.push(timeoutId);
      }
    };

    // Trigger interval 1: 24 hours before
    scheduleReminder('24 hours remaining', 24 * 60 * 60 * 1000);

    // Trigger interval 2: 2.5 hours before
    scheduleReminder('2.5 hours remaining', 2.5 * 60 * 60 * 1000);

    if (timeouts.length > 0) {
      scheduledNotifications.set(opp._id, timeouts);
    }
  };

  const cancelScheduledNotifications = (id) => {
    if (scheduledNotifications.has(id)) {
      const timeouts = scheduledNotifications.get(id);
      timeouts.forEach(clearTimeout);
      scheduledNotifications.delete(id);
    }
  };

  const clearAllScheduledNotifications = () => {
    for (const [id, timeouts] of scheduledNotifications.entries()) {
      timeouts.forEach(clearTimeout);
    }
    scheduledNotifications.clear();
  };

  const triggerBrowserAlert = (opp, message) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(`Urgent Deadline: ${opp.companyName}`, {
        body: `Only ${message} until the deadline for the ${opp.role} opportunity!`,
        icon: 'https://cdn-icons-png.flaticon.com/512/1792/1792154.png',
        tag: `${opp._id}-${message}` // unique ID to prevent duplicate alerts
      });
    }
  };

  // ==========================================================================
  // VIEW ROUTING / TRANSITIONS
  // ==========================================================================
  const showDashboard = () => {
    authView.style.display = 'none';
    dashboardView.style.display = 'block';
    navControls.style.display = 'flex';
    userDisplayName.textContent = currentUser.name;
    
    // Explicitly request notification permissions immediately upon dashboard access
    requestNotificationPermission();

    loadDashboardData();
  };

  const showAuth = () => {
    dashboardView.style.display = 'none';
    authView.style.display = 'flex';
    navControls.style.display = 'none';
    currentUser = null;
    activeOpportunities = [];
    clearAllScheduledNotifications();
  };

  const toggleAuthForm = (showSignup) => {
    if (showSignup) {
      loginForm.style.display = 'none';
      signupForm.style.display = 'flex';
      document.getElementById('auth-title').textContent = 'Create CareerTrack Account';
      document.getElementById('auth-subtitle').textContent = 'Join thousands of applicants and take control of your career path.';
    } else {
      signupForm.style.display = 'none';
      loginForm.style.display = 'flex';
      document.getElementById('auth-title').textContent = 'Welcome back to CareerTrack';
      document.getElementById('auth-subtitle').textContent = 'Sign in to continue tracking your job applications.';
    }
  };

  // ==========================================================================
  // AUTHENTICATION API CALLS
  // ==========================================================================
  const checkAuthStatus = async () => {
    try {
      const response = await fetch('/api/auth/me');
      const data = await response.json();
      if (response.ok && data.success) {
        currentUser = data.user;
        showDashboard();
      } else {
        showAuth();
      }
    } catch (error) {
      showAuth();
    }
  };

  // Handle Login
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await response.json();
      
      if (response.ok && data.success) {
        currentUser = data.user;
        showToast(`Welcome back, ${currentUser.name}!`, 'success');
        showDashboard();
        loginForm.reset();
      } else {
        showToast(data.message || 'Login failed', 'error');
      }
    } catch (error) {
      showToast('Connection error during login', 'error');
    }
  });

  // Handle Signup
  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('signup-name').value;
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
      });
      const data = await response.json();

      if (response.ok && data.success) {
        currentUser = data.user;
        showToast('Registration successful! Welcome to CareerTrack.', 'success');
        showDashboard();
        signupForm.reset();
      } else {
        showToast(data.message || 'Registration failed', 'error');
      }
    } catch (error) {
      showToast('Connection error during registration', 'error');
    }
  });

  // Handle Logout
  logoutBtn.addEventListener('click', async () => {
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      const data = await response.json();
      if (response.ok && data.success) {
        showToast('Successfully logged out.', 'info');
        showAuth();
      } else {
        showToast('Logout failed, clearing local session.', 'error');
        showAuth();
      }
    } catch (error) {
      showAuth();
    }
  });

  // Toggle Forms
  toSignupLink.addEventListener('click', (e) => { e.preventDefault(); toggleAuthForm(true); });
  toLoginLink.addEventListener('click', (e) => { e.preventDefault(); toggleAuthForm(false); });

  // ==========================================================================
  // OPPORTUNITIES API CALLS & RENDERING
  // ==========================================================================
  const loadDashboardData = () => {
    fetchStats();
    fetchOpportunities();
  };

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/opportunities/stats');
      const data = await response.json();
      
      if (response.ok && data.success) {
        renderStats(data.stats);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchOpportunities = async () => {
    try {
      const search = searchInput.value.trim();
      const status = statusFilter.value;
      const wantToApply = intentFilter.value;

      // Construct URL parameters
      let queryParams = [];
      if (search) queryParams.push(`search=${encodeURIComponent(search)}`);
      if (status) queryParams.push(`status=${encodeURIComponent(status)}`);
      if (wantToApply) queryParams.push(`wantToApply=${encodeURIComponent(wantToApply)}`);

      const url = '/api/opportunities' + (queryParams.length > 0 ? `?${queryParams.join('&')}` : '');

      const response = await fetch(url);
      const data = await response.json();

      if (response.ok && data.success) {
        activeOpportunities = data.data;
        
        // Schedule browser notifications for all active items
        activeOpportunities.forEach(opp => {
          scheduleOpportunityNotifications(opp);
        });

        renderOpportunitiesList();
      }
    } catch (error) {
      showToast('Error loading opportunities', 'error');
    }
  };

  const renderStats = (stats) => {
    statTotal.textContent = stats.total;
    statYes.textContent = stats.intentYes;
    statNo.textContent = stats.intentNo;
    statPending.textContent = stats.breakdown.Pending || 0;
    statApplied.textContent = stats.breakdown.Applied || 0;
    statInterview.textContent = stats.breakdown.Interview || 0;
    statOffer.textContent = stats.breakdown.Offer || 0;
    statRejected.textContent = stats.breakdown.Rejected || 0;

    // Render Recent Opportunities sidebar
    recentActivityList.innerHTML = '';
    
    if (stats.recentActivity && stats.recentActivity.length > 0) {
      stats.recentActivity.forEach(opp => {
        const item = document.createElement('div');
        item.className = 'activity-item';
        item.setAttribute('data-status', opp.wantToApply ? opp.status : 'None');
        
        const intentText = opp.wantToApply ? `(${opp.status})` : '(No Intent)';
        item.innerHTML = `
          <div class="activity-marker" style="${!opp.wantToApply ? 'background-color: #9ca3af' : ''}"></div>
          <div class="activity-details">
            <span class="activity-title">Tracked <strong>${escapeHTML(opp.companyName)}</strong></span>
            <span class="activity-meta">${escapeHTML(opp.role)} ${intentText}</span>
          </div>
        `;
        recentActivityList.appendChild(item);
      });
    } else {
      recentActivityList.innerHTML = `
        <div style="color: var(--text-muted); font-size: 0.9rem; text-align: center; padding: 20px 0;">
          No opportunities added.
        </div>
      `;
    }
  };

  const renderOpportunitiesList = () => {
    jobsListContainer.innerHTML = '';
    
    if (activeOpportunities.length === 0) {
      jobsTable.style.display = 'none';
      emptyState.style.display = 'flex';
      return;
    }

    jobsTable.style.display = 'table';
    emptyState.style.display = 'none';

    activeOpportunities.forEach(opp => {
      const row = document.createElement('tr');
      
      // Calculate remaining hours for deadline highlighting
      const deadlineDate = new Date(opp.deadline);
      const diffMs = deadlineDate.getTime() - Date.now();
      const diffHours = diffMs / (1000 * 60 * 60);

      // Warning styling logic: Less than 24 hours remaining AND in the future
      const isUrgent = diffHours > 0 && diffHours < 24;
      const deadlineClass = isUrgent ? 'deadline-urgent' : '';

      // URL display logic
      const linkHTML = opp.link 
        ? `<a href="${escapeHTML(opp.link)}" target="_blank" class="table-link" title="Open Link"><i class="fa-solid fa-arrow-up-right-from-square"></i> Open</a>`
        : '—';

      // Status Badge logic
      let statusBadgeHTML = '—';
      if (opp.wantToApply) {
        const badgeClass = `badge badge-${opp.status.toLowerCase()}`;
        statusBadgeHTML = `
          <span class="${badgeClass}">
            <i class="fa-solid ${getStatusIcon(opp.status)}"></i> ${opp.status}
          </span>
        `;
      } else {
        statusBadgeHTML = `<span style="color: var(--text-muted); font-style: italic;">N/A</span>`;
      }

      // Inline intent switch badge
      const isLocked = opp.status !== 'Pending';
      let intentBadgeHTML = '';
      if (isLocked) {
        intentBadgeHTML = `<span class="intent-yes-badge" style="cursor: not-allowed; opacity: 0.85;" title="Intent is locked once status is changed from Pending"><i class="fa-solid fa-lock"></i> Yes</span>`;
      } else {
        intentBadgeHTML = opp.wantToApply 
          ? `<span class="intent-yes-badge inline-intent-btn" data-id="${opp._id}"><i class="fa-solid fa-check"></i> Yes</span>`
          : `<span class="intent-no-badge inline-intent-btn" data-id="${opp._id}"><i class="fa-solid fa-xmark"></i> No</span>`;
      }

      row.innerHTML = `
        <td class="company-cell" data-label="Company">
          <span class="company-name">${escapeHTML(opp.companyName)}</span>
          <span class="job-role-subtext mobile-only">${escapeHTML(opp.role)}</span>
        </td>
        <td data-label="Role">${escapeHTML(opp.role)}</td>
        <td data-label="Link">${linkHTML}</td>
        <td data-label="Deadline" class="${deadlineClass}">${formatDateTime(opp.deadline)}</td>
        <td data-label="Status">${statusBadgeHTML}</td>
        <td data-label="Intent">${intentBadgeHTML}</td>
        <td class="notes-cell" data-label="Description" title="${escapeHTML(opp.description || '')}">
          ${escapeHTML(opp.description || '—')}
        </td>
        <td class="action-cell text-right" data-label="Actions">
          <div class="action-buttons">
            <button class="btn-icon edit-btn" data-id="${opp._id}" title="Edit Opportunity">
              <i class="fa-solid fa-pen-to-square"></i>
            </button>
            <button class="btn-icon delete-btn" data-id="${opp._id}" title="Delete Opportunity">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>
        </td>
      `;

      // Event listeners for action buttons
      row.querySelector('.edit-btn').addEventListener('click', () => openEditModal(opp));
      row.querySelector('.delete-btn').addEventListener('click', () => openDeleteModal(opp));
      
      // Inline Intent toggle click listener
      if (!isLocked) {
        row.querySelector('.inline-intent-btn').addEventListener('click', () => handleInlineToggle(opp._id));
      }

      jobsListContainer.appendChild(row);
    });
  };

  // ==========================================================================
  // DUAL INLINE TOGGLE LOGIC
  // ==========================================================================
  const handleInlineToggle = async (id) => {
    try {
      const response = await fetch(`/api/opportunities/${id}/toggle`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();

      if (response.ok && data.success) {
        showToast('Application intent updated.', 'success');
        
        // Immediately trigger notification sync & update counts
        if (!data.data.wantToApply) {
          cancelScheduledNotifications(id);
        } else {
          scheduleOpportunityNotifications(data.data);
        }
        
        loadDashboardData();
      } else {
        showToast(data.message || 'Error updating intent', 'error');
      }
    } catch (error) {
      showToast('Connection error updating intent', 'error');
    }
  };

  // ==========================================================================
  // FILTERS, SEARCH AND SORT EVENT HANDLERS (With Debounce)
  // ==========================================================================
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      fetchOpportunities();
    }, 300); // 300ms debounce
  });

  statusFilter.addEventListener('change', fetchOpportunities);
  intentFilter.addEventListener('change', fetchOpportunities);

  // ==========================================================================
  // MODAL LOGIC - ADD/EDIT OPPORTUNITY
  // ==========================================================================
  // Handle switch toggle in form modal
  modalWantApply.addEventListener('change', () => {
    if (modalWantApply.checked) {
      modalIntentText.textContent = 'Yes, I want to apply';
      modalStatus.disabled = false;
      modalStatus.style.opacity = '1';
    } else {
      modalIntentText.textContent = 'No, I do not want to apply';
      modalStatus.disabled = true;
      modalStatus.style.opacity = '0.5';
    }
  });

  // Handle status change in form modal to restrict intent
  modalStatus.addEventListener('change', () => {
    if (modalStatus.value !== 'Pending') {
      modalWantApply.checked = true;
      modalWantApply.disabled = true;
      modalIntentText.innerHTML = '<i class="fa-solid fa-lock" style="font-size: 0.8rem;"></i> Yes (Locked by Status)';
    } else {
      modalWantApply.disabled = false;
      if (modalWantApply.checked) {
        modalIntentText.textContent = 'Yes, I want to apply';
      } else {
        modalIntentText.textContent = 'No, I do not want to apply';
      }
    }
  });

  const openAddModal = () => {
    editMode = false;
    modalTitle.textContent = 'Add Opportunity';
    jobIdInput.value = '';
    jobForm.reset();
    
    // Default form toggles
    modalWantApply.checked = true;
    modalWantApply.disabled = false;
    modalIntentText.textContent = 'Yes, I want to apply';
    modalStatus.disabled = false;
    modalStatus.style.opacity = '1';

    // Prefill datetime-local input to tomorrow at 12:00 PM (local time)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(12, 0, 0, 0);

    const year = tomorrow.getFullYear();
    const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const day = String(tomorrow.getDate()).padStart(2, '0');
    const hours = String(tomorrow.getHours()).padStart(2, '0');
    const minutes = String(tomorrow.getMinutes()).padStart(2, '0');
    modalDeadline.value = `${year}-${month}-${day}T${hours}:${minutes}`;
    
    jobModal.style.display = 'flex';
  };

  const openEditModal = (opp) => {
    editMode = true;
    modalTitle.textContent = 'Edit Opportunity';
    jobIdInput.value = opp._id;
    
    modalCompany.value = opp.companyName;
    modalRole.value = opp.role;
    modalLink.value = opp.link || '';
    
    // Set Datetime local input correctly in YYYY-MM-DDThh:mm format
    if (opp.deadline) {
      const date = new Date(opp.deadline);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      modalDeadline.value = `${year}-${month}-${day}T${hours}:${minutes}`;
    } else {
      modalDeadline.value = '';
    }

    modalStatus.value = opp.status;
    modalWantApply.checked = opp.wantToApply;
    
    if (opp.status !== 'Pending') {
      modalWantApply.checked = true;
      modalWantApply.disabled = true;
      modalIntentText.innerHTML = '<i class="fa-solid fa-lock" style="font-size: 0.8rem;"></i> Yes (Locked by Status)';
      modalStatus.disabled = false;
      modalStatus.style.opacity = '1';
    } else {
      modalWantApply.disabled = false;
      if (opp.wantToApply) {
        modalIntentText.textContent = 'Yes, I want to apply';
        modalStatus.disabled = false;
        modalStatus.style.opacity = '1';
      } else {
        modalIntentText.textContent = 'No, I do not want to apply';
        modalStatus.disabled = true;
        modalStatus.style.opacity = '0.5';
      }
    }

    modalNotes.value = opp.description || '';
    
    jobModal.style.display = 'flex';
  };

  const closeJobModal = () => {
    jobModal.style.display = 'none';
  };

  // Form submission handler (Create or Update)
  jobForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const opportunityData = {
      companyName: modalCompany.value.trim(),
      role: modalRole.value.trim(),
      link: modalLink.value.trim() || undefined,
      deadline: modalDeadline.value,
      status: modalStatus.value,
      wantToApply: modalWantApply.checked,
      description: modalNotes.value.trim()
    };

    const id = jobIdInput.value;
    const url = editMode ? `/api/opportunities/${id}` : '/api/opportunities';
    const method = editMode ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(opportunityData)
      });
      const data = await response.json();

      if (response.ok && data.success) {
        showToast(
          editMode ? 'Opportunity updated successfully.' : 'Opportunity successfully added and tracked!',
          'success'
        );
        closeJobModal();
        loadDashboardData();
      } else {
        showToast(data.message || 'Error saving opportunity', 'error');
      }
    } catch (error) {
      showToast('Server connection error while saving data', 'error');
    }
  });

  addJobBtn.addEventListener('click', openAddModal);
  closeJobModalBtn.addEventListener('click', closeJobModal);
  cancelJobModalBtn.addEventListener('click', closeJobModal);

  // Close modals on clicking outside of content
  window.addEventListener('click', (e) => {
    if (e.target === jobModal) closeJobModal();
    if (e.target === deleteModal) closeDeleteModal();
  });

  // ==========================================================================
  // DELETE OPPORTUNITY MODAL LOGIC
  // ==========================================================================
  const openDeleteModal = (opp) => {
    opportunityToDeleteId = opp._id;
    deleteCompanyName.textContent = opp.companyName;
    deleteJobRole.textContent = opp.role;
    deleteModal.style.display = 'flex';
  };

  const closeDeleteModal = () => {
    deleteModal.style.display = 'none';
    opportunityToDeleteId = null;
  };

  confirmDeleteBtn.addEventListener('click', async () => {
    if (!opportunityToDeleteId) return;

    try {
      const response = await fetch(`/api/opportunities/${opportunityToDeleteId}`, {
        method: 'DELETE'
      });
      const data = await response.json();

      if (response.ok && data.success) {
        showToast('Opportunity deleted successfully.', 'success');
        
        // Cancel all scheduled alerts for this item
        cancelScheduledNotifications(opportunityToDeleteId);
        
        closeDeleteModal();
        loadDashboardData();
      } else {
        showToast(data.message || 'Error deleting opportunity', 'error');
      }
    } catch (error) {
      showToast('Server connection error during deletion', 'error');
    }
  });

  closeDeleteModalBtn.addEventListener('click', closeDeleteModal);
  cancelDeleteBtn.addEventListener('click', closeDeleteModal);

  // Logo reload action
  navLogo.addEventListener('click', (e) => {
    e.preventDefault();
    if (currentUser) {
      loadDashboardData();
    }
  });

  // ==========================================================================
  // UTILITY HELPERS
  // ==========================================================================
  const formatDateTime = (dateString) => {
    if (!dateString) return '—';
    const date = new Date(dateString);
    
    // Formats into local Date and Time: e.g. "Jun 28, 2026, 12:00 PM"
    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'Pending': return 'fa-clock';
      case 'Applied': return 'fa-paper-plane';
      case 'Interview': return 'fa-comments';
      case 'Offer': return 'fa-award';
      case 'Rejected': return 'fa-circle-xmark';
      default: return 'fa-briefcase';
    }
  };

  const escapeHTML = (str) => {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, 
      tag => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
      }[tag] || tag)
    );
  };

  // ==========================================================================
  // APPLICATION INIT
  // ==========================================================================
  checkAuthStatus();
});
