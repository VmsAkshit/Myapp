import React, { useState, useEffect, createContext, useContext } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, setDoc, doc, setLogLevel } from 'firebase/firestore';

// Set Firebase log level to debug for better visibility
setLogLevel('debug');

// --- Global Setup (required for the environment) ---
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Initialize Firebase services outside the component to prevent re-initialization
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Context for Authentication and Database
const AuthContext = createContext();

/**
 * Provides the authentication state, session management, and navigation functions.
 */
const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState('login'); // Initial page state

    useEffect(() => {
        // 1. Set up the primary authentication state listener
        const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
            if (authUser) {
                // User is successfully signed in (custom token, anonymous, or email/password)
                console.log("Auth State Changed: User Signed In", authUser.uid);
                setUser(authUser);
                setCurrentPage('dashboard');

                // Update user profile in Firestore
                const userRef = doc(db, 'artifacts', appId, 'public', 'data', 'user_profiles', authUser.uid);
                await setDoc(userRef, {
                    uid: authUser.uid,
                    email: authUser.email || null,
                    displayName: authUser.email ? authUser.email.split('@')[0] : `Guest_${authUser.uid.substring(0, 4)}`,
                    lastLogin: Date.now(),
                }, { merge: true });

                setLoading(false);
            } else {
                // No user signed in, attempt initial authentication
                console.log("Auth State Changed: No User Found, attempting initial sign-in...");
                try {
                    if (initialAuthToken) {
                        await signInWithCustomToken(auth, initialAuthToken);
                        console.log("Signed in with Custom Token.");
                    } else {
                        await signInAnonymously(auth);
                        console.log("Signed in Anonymously.");
                    }
                } catch (error) {
                    console.error("Initial Authentication Failed, defaulting to Login screen:", error);
                    setUser(null);
                    setCurrentPage('login');
                    setLoading(false);
                }
            }
        });

        // 2. Initial sign-in check to catch cases where the listener doesn't immediately fire
        const initialCheck = async () => {
             // Only run this check if the listener hasn't finished setting loading to false
            if (auth.currentUser) {
                console.log("Initial Check: User already present.");
                // Listener will handle user state
            } else if (!initialAuthToken) {
                 // Fallback to anonymous sign-in if no custom token is provided and no user is signed in
                try {
                    await signInAnonymously(auth);
                    console.log("Initial Fallback: Signed in Anonymously.");
                } catch (error) {
                    console.error("Anonymous sign-in failed:", error);
                }
            }
        };

        if (loading) {
            initialCheck();
        }

        // Cleanup function for the listener
        return () => unsubscribe();
    }, []);

    const logout = async () => {
        try {
            await signOut(auth);
            setUser(null);
            setCurrentPage('login');
        } catch (e) {
            console.error("Logout error:", e);
        }
    };

    const navigate = (page) => setCurrentPage(page);

    return (
        <AuthContext.Provider value={{ user, loading, logout, navigate, db, auth }}>
            {children}
        </AuthContext.Provider>
    );
};

// --- Components (Embedded for single-file mandate) ---

const useAuth = () => useContext(AuthContext);

const Login = () => {
    const { navigate } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoggingIn, setIsLoggingIn] = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoggingIn(true);
        try {
            await signInWithEmailAndPassword(auth, email, password);
            // Auth listener will handle navigation to dashboard
        } catch (e) {
            console.error("Login Error:", e);
            setError(e.message.includes('auth/invalid-credential') ? "Invalid email or password." : e.message);
        } finally {
            setIsLoggingIn(false);
        }
    };

    return (
        <div className="flex items-center justify-center h-screen bg-gray-50">
            <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-2xl shadow-xl">
                <h2 className="text-3xl font-bold text-center text-indigo-600">Login to SocialFlow</h2>
                <form onSubmit={handleLogin} className="space-y-4">
                    {error && <p className="text-red-600 bg-red-100 p-3 rounded-lg text-sm rounded-xl">{error}</p>}
                    <div>
                        <input
                            type="email"
                            placeholder="Email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-indigo-500 focus:border-indigo-500 transition duration-150"
                        />
                    </div>
                    <div>
                        <input
                            type="password"
                            placeholder="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-indigo-500 focus:border-indigo-500 transition duration-150"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={isLoggingIn}
                        className={`w-full py-3 text-lg font-semibold text-white rounded-xl transition duration-150 shadow-lg ${isLoggingIn ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'}`}
                    >
                        {isLoggingIn ? 'Signing In...' : 'Sign In'}
                    </button>
                </form>
                <div className="text-center text-sm text-gray-600">
                    Don't have an account? <span onClick={() => navigate('register')} className="text-indigo-600 font-medium cursor-pointer hover:underline">Register Here</span>
                </div>
            </div>
        </div>
    );
};

const Register = () => {
    const { navigate } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isRegistering, setIsRegistering] = useState(false);

    const handleRegister = async (e) => {
        e.preventDefault();
        setError('');
        setIsRegistering(true);
        try {
            await createUserWithEmailAndPassword(auth, email, password);
            // Auth listener will handle navigation to dashboard
        } catch (e) {
            console.error("Registration Error:", e);
            setError(e.message);
        } finally {
            setIsRegistering(false);
        }
    };

    return (
        <div className="flex items-center justify-center h-screen bg-gray-50">
            <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-2xl shadow-xl">
                <h2 className="text-3xl font-bold text-center text-indigo-600">Register Account</h2>
                <form onSubmit={handleRegister} className="space-y-4">
                    {error && <p className="text-red-600 bg-red-100 p-3 rounded-lg text-sm rounded-xl">{error}</p>}
                    <div>
                        <input
                            type="email"
                            placeholder="Email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-indigo-500 focus:border-indigo-500 transition duration-150"
                        />
                    </div>
                    <div>
                        <input
                            type="password"
                            placeholder="Password (min 6 characters)"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            min={6}
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-indigo-500 focus:border-indigo-500 transition duration-150"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={isRegistering}
                        className={`w-full py-3 text-lg font-semibold text-white rounded-xl transition duration-150 shadow-lg ${isRegistering ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'}`}
                    >
                        {isRegistering ? 'Registering...' : 'Register Account'}
                    </button>
                </form>
                <div className="text-center text-sm text-gray-600">
                    Already have an account? <span onClick={() => navigate('login')} className="text-indigo-600 font-medium cursor-pointer hover:underline">Login</span>
                </div>
            </div>
        </div>
    );
};

const Dashboard = () => {
    const { user, logout } = useAuth();

    return (
        <div className="min-h-screen flex flex-col bg-gray-100">
            <header className="bg-white shadow-md p-4 flex justify-between items-center sticky top-0 z-10">
                <h1 className="text-2xl font-bold text-indigo-600">SocialFlow Dashboard</h1>
                <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2 bg-indigo-100 px-3 py-2 rounded-xl">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-600" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                        </svg>
                        <p className="text-sm font-medium text-gray-700 truncate max-w-xs sm:max-w-none">
                            Welcome, **{user?.email || `Guest ID: ${user?.uid.substring(0, 8)}...`}**
                        </p>
                    </div>
                    <button
                        onClick={logout}
                        className="px-4 py-2 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition duration-150 shadow-lg"
                    >
                        Logout
                    </button>
                </div>
            </header>

            <main className="flex-grow p-6">
                <div className="max-w-4xl mx-auto bg-white p-8 rounded-xl shadow-2xl">
                    <h2 className="text-2xl font-bold text-gray-800 mb-6 border-b pb-2">Your Profile Information</h2>
                    <p className="text-gray-600 mb-4">
                        You are successfully authenticated using Firebase. This application now uses Firestore to manage your session and user data, replacing the non-persistent `localStorage`.
                    </p>
                    <div className="space-y-4">
                        <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                            <h3 className="text-lg font-medium text-indigo-800">Unique User ID (UID):</h3>
                            <p className="font-mono text-sm text-indigo-600 break-all">{user?.uid}</p>
                        </div>
                        {user?.email && (
                            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                                <h3 className="text-lg font-medium text-green-800">Email Address:</h3>
                                <p className="font-mono text-sm text-green-600 break-all">{user.email}</p>
                            </div>
                        )}
                        {!user?.email && (
                            <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                                <h3 className="text-lg font-medium text-yellow-800">Sign-in Method:</h3>
                                <p className="font-mono text-sm text-yellow-600">Currently signed in anonymously or via custom token. Register with email/password to persist your account.</p>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
};


// --- Main Application Component (Router Replacement) ---
const AppContent = () => {
    const { user, loading, currentPage } = useAuth();

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                <div className="flex flex-col items-center p-8 bg-white rounded-xl shadow-lg">
                    <svg className="animate-spin h-8 w-8 text-indigo-500 mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <p className="text-lg font-medium text-gray-700">Checking session and connecting to Firebase...</p>
                </div>
            </div>
        );
    }

    // State-based routing (Replaces React Router logic)
    switch (currentPage) {
        case 'register':
            // If user is logged in (via custom token/anonymous), send them to dashboard
            return user ? <Dashboard /> : <Register />;
        case 'dashboard':
            // Protected Route: If not logged in, force navigation back to login
            return user ? <Dashboard /> : <Login />;
        case 'login':
        default:
            // Default to Login, but navigate to Dashboard if already logged in
            return user ? <Dashboard /> : <Login />;
    }
};

const App = () => (
    <AuthProvider>
        <AppContent />
    </AuthProvider>
);

export default App;
