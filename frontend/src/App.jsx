import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';

const API_URL = 'http://localhost:4000';

function readStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('user')) || null;
  } catch {
    return null;
  }
}

function errorMessage(error, fallback) {
  return error.response?.data?.error || fallback;
}

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem('token') || '');
  const [user, setUser] = useState(readStoredUser);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [authError, setAuthError] = useState('');
  const [authNotice, setAuthNotice] = useState('');
  const [pageError, setPageError] = useState('');
  const [activeView, setActiveView] = useState('overview');
  const [accounts, setAccounts] = useState([]);
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [accountCreating, setAccountCreating] = useState(false);
  const [approvingId, setApprovingId] = useState('');

  const api = useMemo(
    () =>
      axios.create({
        baseURL: API_URL,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      }),
    [token],
  );

  const fetchUsers = useCallback(async () => {
    try {
      const response = await api.get('/admin/users');
      setUsers(response.data.users || []);
    } catch (error) {
      setPageError(errorMessage(error, 'Could not load users.'));
    } finally {
      setUsersLoading(false);
    }
  }, [api]);

  useEffect(() => {
    if (!token) {
      return undefined;
    }

    let active = true;
    api.get('/accounts')
      .then((response) => {
        if (active) setAccounts(response.data.accounts || []);
      })
      .catch((error) => {
        if (active) setPageError(errorMessage(error, 'Could not load your accounts.'));
      });

    return () => {
      active = false;
    };
  }, [api, token]);

  useEffect(() => {
    if (!token || user?.role !== 'ADMIN' || activeView !== 'admin') {
      return undefined;
    }

    let active = true;
    api.get('/admin/users')
      .then((response) => {
        if (active) setUsers(response.data.users || []);
      })
      .catch((error) => {
        if (active) setPageError(errorMessage(error, 'Could not load users.'));
      })
      .finally(() => {
        if (active) setUsersLoading(false);
      });

    return () => {
      active = false;
    };
  }, [activeView, api, token, user?.role]);

  const handleAuth = async (event) => {
    event.preventDefault();
    setAuthError('');
    setAuthNotice('');

    if (!isLogin && password !== confirmPassword) {
      setAuthError('Passwords do not match');
      return;
    }

    try {
      if (isLogin) {
        const response = await axios.post(`${API_URL}/auth/login`, { email, password });
        setToken(response.data.token);
        setUser(response.data.user);
        setActiveView('overview');
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
      } else {
        await axios.post(`${API_URL}/auth/register`, { name, email, password });
        setIsLogin(true);
        setPassword('');
        setConfirmPassword('');
        setAuthNotice('Registration successful. Please wait for Admin approval.');
      }
    } catch (err) {
      setAuthError(err.response?.data?.error || err.message || 'Authentication failed');
    }
  };

  const handleLogout = () => {
    setToken('');
    setUser(null);
    setAccounts([]);
    setUsers([]);
    setPageError('');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  const createAccount = async () => {
    setPageError('');
    setAccountCreating(true);
    try {
      const response = await api.post('/accounts', { currency: 'USD' });
      setAccounts((current) => [response.data.account, ...current]);
    } catch (error) {
      setPageError(errorMessage(error, 'Could not initialize an account.'));
    } finally {
      setAccountCreating(false);
    }
  };

  const approveUser = async (id) => {
    setPageError('');
    setApprovingId(id);
    try {
      await api.post(`/admin/users/${encodeURIComponent(id)}/approve`);
      await fetchUsers();
    } catch (error) {
      setPageError(errorMessage(error, 'Could not approve this user.'));
    } finally {
      setApprovingId('');
    }
  };

  const switchAuthMode = () => {
    setIsLogin((current) => !current);
    setAuthError('');
    setAuthNotice('');
    setConfirmPassword('');
  };

  if (!token || !user) {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <div className="brand-lockup">
            <div className="brand-mark">BV</div>
            <span>BalanceVault</span>
          </div>
          <div className="auth-heading">
            <p className="eyebrow">YOUR FINANCES, IN FOCUS</p>
            <h1>{isLogin ? 'Welcome back' : 'Create your account'}</h1>
            <p className="muted">
              {isLogin
                ? 'Sign in to continue to your secure dashboard.'
                : 'Register now. An admin will review your account.'}
            </p>
          </div>

          {authNotice && <div className="notice success-notice">{authNotice}</div>}
          {authError && <div className="notice error-notice">{authError}</div>}

          <form className="auth-form" onSubmit={handleAuth}>
            {!isLogin && (
              <label>
                Full name
                <input
                  autoComplete="name"
                  placeholder="Your name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                />
              </label>
            )}
            <label>
              Email address
              <input
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>
            <label>
              Password
              <input
                type="password"
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                placeholder="At least 8 characters"
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </label>
            {!isLogin && (
              <label>
                Confirm Password
                <input
                  type="password"
                  autoComplete="new-password"
                  placeholder="Re-enter your password"
                  minLength={8}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                />
              </label>
            )}
            <button className="button button-primary auth-submit" type="submit">
              {isLogin ? 'Sign in' : 'Create account'}
              <span aria-hidden="true">→</span>
            </button>
          </form>

          <p className="auth-switch">
            {isLogin ? 'New to BalanceVault?' : 'Already have an account?'}
            <button type="button" onClick={switchAuthMode}>
              {isLogin ? 'Create account' : 'Sign in'}
            </button>
          </p>
          <p className="security-note"><span /> Secure, encrypted access</p>
        </section>
      </main>
    );
  }

  return (
    <div className="dashboard">
      <aside className="sidebar">
        <div className="brand-lockup sidebar-brand">
          <div className="brand-mark">BV</div>
          <span>BalanceVault</span>
        </div>

        <div className="nav-section-label">WORKSPACE</div>
        <nav className="side-nav" aria-label="Main navigation">
          <button
            className={`nav-item ${activeView === 'overview' ? 'active' : ''}`}
            onClick={() => {
              setActiveView('overview');
              setPageError('');
            }}
          >
            <span className="nav-icon">◫</span>
            Overview
          </button>
          {user?.role === 'ADMIN' && (
            <button
              className={`nav-item ${activeView === 'admin' ? 'active' : ''}`}
              onClick={() => {
                setActiveView('admin');
                setPageError('');
                setUsersLoading(true);
              }}
            >
              <span className="nav-icon">◇</span>
              Admin Controls
            </button>
          )}
        </nav>

        <div className="sidebar-bottom">
          <div className="profile-card">
            <div className="avatar">{(user.name || user.email || 'U').charAt(0).toUpperCase()}</div>
            <div className="profile-copy">
              <strong>{user.name}</strong>
              <span>{user.role === 'ADMIN' ? 'Administrator' : 'Member'}</span>
            </div>
            <span className="online-dot" aria-label="Signed in" />
          </div>
          <button className="logout-button" onClick={handleLogout}>
            <span aria-hidden="true">↗</span> Sign out
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Workspace</span><span className="breadcrumb-divider">/</span>
            <strong>{activeView === 'admin' ? 'Admin Controls' : 'Overview'}</strong>
          </div>
          <div className="topbar-user">
            <span className="topbar-status"><span /> All systems operational</span>
            <div className="avatar avatar-small">{(user.name || 'U').charAt(0).toUpperCase()}</div>
          </div>
        </header>

        {pageError && (
          <div className="notice error-notice page-notice" role="alert">
            {pageError}
            <button aria-label="Dismiss error" onClick={() => setPageError('')}>×</button>
          </div>
        )}

        {activeView === 'overview' ? (
          <section className="view-content">
            <div className="page-heading">
              <div>
                <p className="eyebrow">YOUR FINANCIAL OVERVIEW</p>
                <h1>Good to see you, {user.name}</h1>
                <p className="muted">Here&apos;s what&apos;s happening with your accounts.</p>
              </div>
              <span className="role-pill">{user.role}</span>
            </div>

            <div className="overview-grid">
              <article className="initialize-card">
                <div className="card-orb" aria-hidden="true">+</div>
                <div className="card-content">
                  <p className="eyebrow">GET STARTED</p>
                  <h2>Initialize Account</h2>
                  <p className="muted">Create a new account to start organizing your funds.</p>
                  <button
                    className="button button-primary"
                    onClick={createAccount}
                    disabled={accountCreating}
                  >
                    {accountCreating ? 'Creating…' : 'Initialize account'}
                    {!accountCreating && <span aria-hidden="true">→</span>}
                  </button>
                </div>
              </article>
              <article className="summary-card">
                <div className="summary-icon">▤</div>
                <p className="muted">TOTAL ACCOUNTS</p>
                <strong>{accounts.length.toString().padStart(2, '0')}</strong>
                <span className="summary-caption">Active in your vault</span>
              </article>
            </div>

            <section className="accounts-section">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">YOUR PORTFOLIO</p>
                  <h2>Accounts</h2>
                </div>
                <span className="count-pill">{accounts.length} {accounts.length === 1 ? 'account' : 'accounts'}</span>
              </div>
              {accounts.length ? (
                <div className="account-list">
                  {accounts.map((account) => (
                    <article className="account-row" key={account.id}>
                      <div className="account-icon">{account.currency?.slice(0, 1) || '$'}</div>
                      <div className="account-details">
                        <strong>{account.currency || 'USD'} Account</strong>
                        <span>•••• {account.id.slice(-6).toUpperCase()}</span>
                      </div>
                      <div className="account-balance">
                        <span>Available balance</span>
                        <strong>{account.currency} {Number(account.balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                      </div>
                      <span className="active-badge">ACTIVE</span>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <div className="empty-icon">▤</div>
                  <h3>Your vault is ready</h3>
                  <p className="muted">Initialize an account to see it here.</p>
                </div>
              )}
            </section>
          </section>
        ) : (
          <section className="view-content">
            <div className="page-heading">
              <div>
                <p className="eyebrow">ACCESS MANAGEMENT</p>
                <h1>Admin Controls</h1>
                <p className="muted">Review member access and approve pending accounts.</p>
              </div>
              <span className="count-pill">{users.length} users</span>
            </div>

            <section className="admin-panel">
              <div className="section-heading table-heading">
                <div>
                  <h2>User management</h2>
                  <p className="muted">New registrations require your approval.</p>
                </div>
                <button
                  className="button button-secondary"
                  onClick={() => {
                    setUsersLoading(true);
                    fetchUsers();
                  }}
                  disabled={usersLoading}
                >
                  {usersLoading ? 'Refreshing…' : '↻ Refresh'}
                </button>
              </div>
              <div className="table-scroll">
                <table className="users-table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Joined</th>
                      <th><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((listedUser) => (
                      <tr key={listedUser.id}>
                        <td>
                          <div className="table-user">
                            <div className="avatar table-avatar">{(listedUser.name || listedUser.email).charAt(0).toUpperCase()}</div>
                            <div>
                              <strong>{listedUser.name}</strong>
                              <span>{listedUser.email}</span>
                            </div>
                          </div>
                        </td>
                        <td><span className="role-pill">{listedUser.role}</span></td>
                        <td>
                          <span className={`status-badge ${listedUser.status === 'PENDING' ? 'status-pending' : 'status-active'}`}>
                            <span />{listedUser.status}
                          </span>
                        </td>
                        <td className="date-cell">
                          {listedUser.createdAt ? new Date(listedUser.createdAt).toLocaleDateString() : '—'}
                        </td>
                        <td className="action-cell">
                          {listedUser.status === 'PENDING' ? (
                            <button
                              className="button button-approve"
                              onClick={() => approveUser(listedUser.id)}
                              disabled={approvingId === listedUser.id}
                            >
                              {approvingId === listedUser.id ? 'Approving…' : 'Approve'}
                            </button>
                          ) : (
                            <span className="no-action">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {!usersLoading && users.length === 0 && (
                      <tr>
                        <td className="table-empty" colSpan="5">No users found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </section>
        )}
      </main>
    </div>
  );
}
