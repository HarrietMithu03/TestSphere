const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

/**
 * Perform a GET request to the backend health check endpoint
 */
export async function getHealthStatus() {
  const startTime = performance.now();
  try {
    const response = await fetch(`${API_BASE_URL}/health`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });

    const latency = Math.round(performance.now() - startTime);
    const data = await response.json();

    return {
      ok: response.ok,
      status: response.status,
      latency,
      data
    };
  } catch (error) {
    const latency = Math.round(performance.now() - startTime);
    return {
      ok: false,
      status: 0,
      latency,
      error: error.message || 'Network error / backend unreachable'
    };
  }
}

/**
 * Lightweight ping to verify REST response time
 */
export async function pingApi() {
  const startTime = performance.now();
  try {
    const response = await fetch(`${API_BASE_URL}/health/ping`);
    const latency = Math.round(performance.now() - startTime);
    const data = await response.json();
    return { ok: response.ok, latency, data };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

/**
 * Register a new user account
 */
export async function registerUser({ name, email, password, role }) {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ name, email, password, role })
    });

    const data = await response.json();
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: data.message || 'Registration failed. Please try again.'
      };
    }

    return {
      ok: true,
      data
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: 'Unable to connect to the server. Please check your internet connection or server status.'
    };
  }
}

/**
 * Sign in with email and password
 */
export async function loginUser({ email, password, rememberMe }) {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ email, password, rememberMe })
    });

    const data = await response.json();
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: data.message || 'Authentication failed. Please verify your credentials.'
      };
    }

    return {
      ok: true,
      data
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: 'Unable to reach the TestSphere authentication service. Please ensure the backend is running.'
    };
  }
}

/**
 * Fetch authenticated user profile using stored JWT
 */
export async function getCurrentUser(token) {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    });

    const data = await response.json();
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: data.message || 'Failed to authenticate user.'
      };
    }

    return {
      ok: true,
      data
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: 'Network error checking user credentials.'
    };
  }
}

/**
 * Fetch targets accessible to current user (Developer: owned, Tester: assigned)
 */
export async function getTargets(token) {
  try {
    const response = await fetch(`${API_BASE_URL}/targets`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    });

    const data = await response.json();
    if (!response.ok) {
      return { ok: false, status: response.status, error: data.message || 'Failed to load targets' };
    }
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: 'Network error loading targets.' };
  }
}

/**
 * Fetch a single target application by ID
 */
export async function getTargetById(id, token) {
  try {
    const response = await fetch(`${API_BASE_URL}/targets/${id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    });

    const data = await response.json();
    if (!response.ok) {
      return { ok: false, status: response.status, error: data.message || 'Failed to fetch target' };
    }
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: 'Network error fetching target.' };
  }
}

/**
 * Create/Register a new target application (Developer only)
 */
export async function createTarget(payload, token) {
  try {
    const response = await fetch(`${API_BASE_URL}/targets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) {
      return { ok: false, status: response.status, error: data.message || 'Failed to register target' };
    }
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: 'Network error creating target application.' };
  }
}

/**
 * Update an existing target application (Developer only)
 */
export async function updateTarget(id, payload, token) {
  try {
    const response = await fetch(`${API_BASE_URL}/targets/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) {
      return { ok: false, status: response.status, error: data.message || 'Failed to update target' };
    }
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: 'Network error updating target application.' };
  }
}

/**
 * Delete / Archive target application (Developer only)
 */
export async function deleteTarget(id, token) {
  try {
    const response = await fetch(`${API_BASE_URL}/targets/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    });

    const data = await response.json();
    if (!response.ok) {
      return { ok: false, status: response.status, error: data.message || 'Failed to archive target' };
    }
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: 'Network error deleting target application.' };
  }
}

/**
 * Assign a registered tester by email to a target application (Developer only)
 */
export async function assignTesterToTarget(targetId, email, token) {
  try {
    const response = await fetch(`${API_BASE_URL}/targets/${targetId}/assign-tester`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      },
      body: JSON.stringify({ email })
    });

    const data = await response.json();
    if (!response.ok) {
      return { ok: false, status: response.status, error: data.message || 'Failed to assign tester' };
    }
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: 'Network error assigning tester.' };
  }
}

/**
 * Remove an assigned tester from target application (Developer only)
 */
export async function removeTesterFromTarget(targetId, testerId, token) {
  try {
    const response = await fetch(`${API_BASE_URL}/targets/${targetId}/testers/${testerId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    });

    const data = await response.json();
    if (!response.ok) {
      return { ok: false, status: response.status, error: data.message || 'Failed to remove tester' };
    }
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: 'Network error removing tester.' };
  }
}

/**
 * Launch an automated diagnostic scan for a target (Developer only)
 */
export async function createScan(targetId, token) {
  try {
    const response = await fetch(`${API_BASE_URL}/scans`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      },
      body: JSON.stringify({ targetId })
    });

    const data = await response.json();
    if (!response.ok) {
      return { ok: false, status: response.status, error: data.message || 'Failed to start diagnostic scan' };
    }
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: 'Network error creating scan.' };
  }
}

/**
 * List scan history accessible to user (Developer: owned targets, Tester: assigned targets)
 */
export async function getScans(params = {}, token) {
  try {
    const query = new URLSearchParams();
    if (params.targetId) query.append('targetId', params.targetId);
    if (params.status) query.append('status', params.status);

    const qs = query.toString() ? `?${query.toString()}` : '';
    const response = await fetch(`${API_BASE_URL}/scans${qs}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    });

    const data = await response.json();
    if (!response.ok) {
      return { ok: false, status: response.status, error: data.message || 'Failed to fetch scans' };
    }
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: 'Network error fetching scan history.' };
  }
}

/**
 * Get details and live progress for a scan
 */
export async function getScanById(scanId, token) {
  try {
    const response = await fetch(`${API_BASE_URL}/scans/${scanId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    });

    const data = await response.json();
    if (!response.ok) {
      return { ok: false, status: response.status, error: data.message || 'Failed to fetch scan details' };
    }
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: 'Network error fetching scan details.' };
  }
}

/**
 * Safely cancel an active scan (Developer owner only)
 */
export async function cancelScan(scanId, token) {
  try {
    const response = await fetch(`${API_BASE_URL}/scans/${scanId}/cancel`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    });

    const data = await response.json();
    if (!response.ok) {
      return { ok: false, status: response.status, error: data.message || 'Failed to cancel scan' };
    }
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: 'Network error cancelling scan.' };
  }
}

/**
 * Retrieve findings associated with a scan
 */
export async function getScanFindings(scanId, filters = {}, token) {
  try {
    const query = new URLSearchParams();
    if (filters.category) query.append('category', filters.category);
    if (filters.severity) query.append('severity', filters.severity);
    if (filters.confidence) query.append('confidence', filters.confidence);

    const qs = query.toString() ? `?${query.toString()}` : '';
    const response = await fetch(`${API_BASE_URL}/scans/${scanId}/findings${qs}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    });

    const data = await response.json();
    if (!response.ok) {
      return { ok: false, status: response.status, error: data.message || 'Failed to load findings' };
    }
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: 'Network error loading scan findings.' };
  }
}

/**
 * Generate or fetch an existing Diagnostic Report for a scan
 */
export async function createOrGetReport(scanId, token) {
  try {
    const response = await fetch(`${API_BASE_URL}/reports`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      },
      body: JSON.stringify({ scanId })
    });

    const data = await response.json();
    if (!response.ok) {
      return { ok: false, status: response.status, error: data.message || 'Failed to compile report' };
    }
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: 'Network error generating diagnostic report.' };
  }
}

/**
 * List diagnostic reports accessible to user
 */
export async function getReports(token) {
  try {
    const response = await fetch(`${API_BASE_URL}/reports`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    });

    const data = await response.json();
    if (!response.ok) {
      return { ok: false, status: response.status, error: data.message || 'Failed to fetch reports' };
    }
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: 'Network error loading diagnostic reports.' };
  }
}

/**
 * Get details for a single diagnostic report
 */
export async function getReportById(reportId, token) {
  try {
    const response = await fetch(`${API_BASE_URL}/reports/${reportId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    });

    const data = await response.json();
    if (!response.ok) {
      return { ok: false, status: response.status, error: data.message || 'Failed to fetch report' };
    }
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: 'Network error loading report details.' };
  }
}

/**
 * Human validation of a diagnostic finding (Tester / Developer)
 */
export async function validateFinding(findingId, payload, token) {
  try {
    const response = await fetch(`${API_BASE_URL}/findings/${findingId}/validate`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) {
      return { ok: false, status: response.status, error: data.message || 'Failed to update finding validation' };
    }
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: 'Network error validating finding.' };
  }
}

/**
 * Log an exploratory bug finding by a human tester
 */
export async function createExploratoryFinding(payload, token) {
  try {
    const response = await fetch(`${API_BASE_URL}/findings/exploratory`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) {
      return { ok: false, status: response.status, error: data.message || 'Failed to log exploratory finding' };
    }
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: 'Network error submitting exploratory finding.' };
  }
}

/**
 * Retrieve duplicate suggestions for a finding using fingerprint and text similarity
 */
export async function getDuplicateSuggestions(findingId, token) {
  try {
    const response = await fetch(`${API_BASE_URL}/findings/${findingId}/duplicate-suggestions`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    });

    const data = await response.json();
    if (!response.ok) {
      return { ok: false, status: response.status, error: data.message || 'Failed to load duplicate suggestions' };
    }
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: 'Network error querying duplicate suggestions.' };
  }
}

/**
 * Inspect Android Mobile Diagnostic Environment Status
 */
export async function getAndroidEnvironmentStatus() {
  try {
    const response = await fetch(`${API_BASE_URL}/health/android`);
    const data = await response.json();
    return { ok: response.ok, data };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

/**
 * Launch a live diagnostic benchmark scan (Developer owner or Assigned Tester)
 */
export async function runLiveBenchmark(token, targetId = null) {
  try {
    const response = await fetch(`${API_BASE_URL}/scans/benchmark`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      },
      body: JSON.stringify(targetId ? { targetId } : {})
    });

    const data = await response.json();
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: data.message || 'Benchmark scan failed to launch.'
      };
    }
    return { ok: true, status: response.status, data };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: 'Network error connecting to benchmark service.'
    };
  }
}

export { API_BASE_URL };
