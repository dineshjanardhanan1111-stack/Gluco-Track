/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Activity, 
  Utensils, 
  Pill, 
  TrendingUp, 
  Clock, 
  FileText, 
  Settings, 
  LogOut,
  ChevronRight,
  AlertCircle,
  Share2,
  Brain,
  X,
  User,
  History,
  Calculator
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { onAuthStateChanged, signInWithPopup, signOut, User as FirebaseUser } from 'firebase/auth';
import { auth, googleProvider, isFirebaseConfigured } from './firebase';
import { dbService } from './lib/db';
import { aiService } from './lib/ai';
import { cn, formatDate } from './lib/utils';
import { GlucoseReading, MealLog, MedicationLog, UserProfile, MealType, MealCategory, MedicationType } from './types';

// --- UTILS ---
const getCurrentDateTimeLocal = () => {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
};

// --- COMPONENTS ---

const Modal = ({ isOpen, onClose, title, children }: { isOpen: boolean, onClose: () => void, title: string, children: React.ReactNode, key?: React.Key }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, y: 100 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 100 }}
        className="w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl"
      >
        <div className="p-6 flex items-center justify-between border-bottom border-gray-100">
          <h2 className="text-xl font-bold text-gray-900">{title}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="p-6 overflow-y-auto max-h-[80vh]">
          {children}
        </div>
      </motion.div>
    </div>
  );
};

const Header = ({ user, profile, onLogout, onOpenSettings }: { user: FirebaseUser | null, profile: UserProfile | null, onLogout: () => void, onOpenSettings: () => void }) => {
  return (
    <header className="fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-md border-b border-gray-100 z-40 px-4 py-3">
      <div className="max-w-5xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-indigo-100 shadow-lg">
            <Activity size={18} className="text-white" />
          </div>
          <span className="font-bold text-xl tracking-tight text-indigo-900">GlucoTrack</span>
        </div>
        
        {user ? (
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold text-gray-900 leading-none">{user.displayName}</p>
              <div className="flex items-center gap-1 mt-1 justify-end">
                 <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1 rounded uppercase tracking-wider">{profile?.diabetesType}</span>
                 <p className="text-xs text-gray-500">{profile?.unit || 'mg/dL'}</p>
              </div>
            </div>
            <button 
              onClick={onOpenSettings}
              className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-500 hover:text-indigo-600 transition-colors border border-gray-100"
              title="Settings"
            >
              <Settings size={18} />
            </button>
            <button 
              onClick={onLogout}
              className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-500 hover:text-red-500 transition-colors border border-gray-100"
              title="Logout"
            >
              <LogOut size={18} />
            </button>
          </div>
        ) : (
          <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-300">
            <User size={18} />
          </div>
        )}
      </div>
    </header>
  );
};

// --- APP LOGIC ---

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [readings, setReadings] = useState<GlucoseReading[]>([]);
  const [meals, setMeals] = useState<MealLog[]>([]);
  const [meds, setMeds] = useState<MedicationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'glucose' | 'meals' | 'meds'>('overview');
  const [modalOpen, setModalOpen] = useState<'glucose' | 'meal' | 'med' | 'report' | 'settings' | 'calculator' | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiReport, setAiReport] = useState<string | null>(null);

  // Auth Effect
  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const p = await dbService.getUserProfile(u.uid);
        if (p) {
          setProfile(p);
        } else {
          const newProfile: UserProfile = {
            uid: u.uid,
            email: u.email!,
            displayName: u.displayName,
            diabetesType: 'Type 1',
            targetGlucoseMin: 70,
            targetGlucoseMax: 140,
            unit: 'mg/dL',
            carbRatio: 10,
            correctionFactor: 50
          };
          await dbService.saveUserProfile(newProfile);
          setProfile(newProfile);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
  }, []);

  // Data Subscription Effect
  useEffect(() => {
    if (!user) return;
    const unsubGlucose = dbService.subscribeGlucose(user.uid, setReadings);
    const unsubMeals = dbService.subscribeMeals(user.uid, setMeals);
    const unsubMeds = dbService.subscribeMedications(user.uid, setMeds);
    
    return () => {
      unsubGlucose();
      unsubMeals();
      unsubMeds();
    };
  }, [user]);

  const handleLogin = async () => {
    try {
      if (!isFirebaseConfigured()) {
        // Mock login for demo
        setUser({ uid: 'mock-user', email: 'demo@example.com', displayName: 'Demo User' } as any);
        return;
      }
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      console.error("Login Error", e);
    }
  };

  const handleLogout = () => {
    if (!isFirebaseConfigured()) {
      setUser(null);
      return;
    }
    signOut(auth);
  };

  const chartsData = useMemo(() => {
    return [...readings].reverse().map(r => ({
      time: formatDate(r.timestamp),
      value: r.value,
      timestamp: r.timestamp.getTime()
    }));
  }, [readings]);

  const avgGlucose = readings.length > 0 
    ? Math.round(readings.reduce((acc, r) => acc + r.value, 0) / readings.length) 
    : 0;

  const lastReading = readings[0];

  const handleGenerateReport = async () => {
    setModalOpen('report');
    setIsAiLoading(true);
    const report = await aiService.generateHealthReport({ glucose: readings, meals, medications: meds });
    setAiReport(report);
    setIsAiLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <motion.div 
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="w-12 h-12 bg-indigo-600 rounded-2xl shadow-xl flex items-center justify-center"
        >
          <Activity className="text-white" size={24} />
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full"
        >
          <div className="w-16 h-16 bg-indigo-600 rounded-3xl shadow-2xl flex items-center justify-center mx-auto mb-8">
            <Activity className="text-white" size={32} />
          </div>
          <h1 className="text-4xl font-black text-gray-900 tracking-tight mb-4 shrink-0">GlucoTrack</h1>
          <p className="text-gray-500 mb-10 leading-relaxed">
            Monitor your blood sugar, track meals, and generate AI insights for a healthier life.
          </p>
          <button 
            onClick={handleLogin}
            className="w-full bg-gray-900 text-white font-bold py-4 rounded-2xl shadow-xl hover:bg-gray-800 transition-all flex items-center justify-center gap-3 active:scale-95"
          >
            <img src="https://www.google.com/favicon.ico" className="w-5 h-5 grayscale invert" alt="Google" referrerPolicy="no-referrer" />
            Continue with Google
          </button>
          {!isFirebaseConfigured() && (
            <p className="mt-6 text-xs text-amber-600 font-medium bg-amber-50 p-3 rounded-lg flex items-center gap-2">
              <AlertCircle size={14} />
              Firebase not configured. Running in Demo Mode (Local Storage).
            </p>
          )}
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FBFBFE] pb-32">
      <Header user={user} profile={profile} onLogout={handleLogout} onOpenSettings={() => setModalOpen('settings')} />

      <main className="max-w-5xl mx-auto px-4 pt-24 pb-12">
        {/* OVERVIEW SECTION */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="col-span-1 md:col-span-2 bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col"
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-gray-400 text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                  <TrendingUp size={14} className="text-indigo-500" />
                  Glucose Trends
                </h3>
                <p className="text-2xl font-black text-gray-900 mt-1">
                  {avgGlucose} <span className="text-sm font-medium text-gray-400">avg {profile?.unit}</span>
                </p>
              </div>
              <div className="flex gap-2">
                {['D', 'W', 'M'].map(t => (
                  <button key={t} className={cn("px-3 py-1 rounded-full text-xs font-bold transition-all", t === 'D' ? "bg-indigo-600 text-white" : "bg-gray-50 text-gray-400 hover:bg-gray-100")}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="h-64 w-full mt-auto">
              {readings.length > 1 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartsData}>
                    <defs>
                      <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                    <XAxis dataKey="time" hide />
                    <YAxis hide domain={[Math.min(...readings.map(r => r.value)) - 20, Math.max(...readings.map(r => r.value)) + 20]} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                      labelStyle={{ color: '#9CA3AF', fontSize: '10px' }}
                    />
                    <Area type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" dot={{ r: 4, fill: '#6366f1', strokeWidth: 0 }} activeDot={{ r: 6, stroke: '#fff', strokeWidth: 2 }} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-gray-300 gap-2">
                  <History size={48} strokeWidth={1} />
                  <p className="text-sm font-medium">Add more readings to see trends</p>
                </div>
              )}
            </div>
          </motion.div>

          <div className="flex flex-col gap-4">
            <motion.div 
               initial={{ opacity: 0, x: 20 }}
               animate={{ opacity: 1, x: 0 }}
               className="bg-indigo-600 rounded-3xl p-6 shadow-xl shadow-indigo-100 flex-1 flex flex-col justify-between text-white"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-widest text-indigo-100">Last Reading</span>
                <Clock size={16} className="text-indigo-200" />
              </div>
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-black">{lastReading?.value || '--'}</span>
                  <span className="text-lg font-medium opacity-70">{profile?.unit}</span>
                </div>
                <p className="text-xs text-indigo-100 mt-2 font-medium">
                  {lastReading ? formatDate(lastReading.timestamp) : 'No data yet'}
                </p>
              </div>
            </motion.div>

            <motion.button 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleGenerateReport}
              className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex items-center justify-between group transition-all hover:bg-indigo-50/30"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 group-hover:bg-indigo-100">
                  <FileText size={20} />
                </div>
                <div className="text-left">
                  <p className="font-bold text-gray-900 leading-tight">Share Report</p>
                  <p className="text-xs text-gray-500">Send summary to doctor</p>
                </div>
              </div>
              <ChevronRight size={18} className="text-gray-300 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
            </motion.button>
          </div>
        </section>

        {/* NAVIGATION TABS */}
        <div className="flex p-1.5 bg-gray-100 rounded-2xl mb-6 w-fit mx-auto sm:mx-0">
          {(['overview', 'glucose', 'meals', 'meds'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-5 py-2 rounded-xl text-xs font-black tracking-wide uppercase transition-all whitespace-nowrap",
                activeTab === tab ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-800"
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* LOG CONTENT */}
        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <motion.div 
              key="overview"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-2">Recent Activity</h2>
              {(() => {
                const recent = [
                  ...readings.map(r => ({ ...r, type: 'glucose' })),
                  ...meals.map(m => ({ ...m, type: 'meal' })),
                  ...meds.map(md => ({ ...md, type: 'meds' }))
                ].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, 5);

                if (recent.length === 0) {
                  return (
                    <div className="bg-white rounded-3xl p-12 text-center border border-dashed border-gray-200">
                      <p className="text-gray-400 font-medium">No activity recorded yet.</p>
                      <button onClick={() => setModalOpen('glucose')} className="mt-4 text-indigo-600 font-bold text-sm">Add your first reading</button>
                    </div>
                  );
                }

                return recent.map((item: any, i) => (
                  <div key={i} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center",
                        item.type === 'glucose' ? "bg-indigo-50 text-indigo-600" :
                        item.type === 'meal' ? "bg-amber-50 text-amber-600" :
                        "bg-teal-50 text-teal-600"
                      )}>
                        {item.type === 'glucose' ? <Activity size={18} /> : item.type === 'meal' ? <Utensils size={18} /> : <Pill size={18} />}
                      </div>
                      <div>
                        <p className="font-bold text-gray-900 leading-tight">
                          {item.type === 'glucose' ? `${item.value} ${item.unit}` :
                           item.type === 'meal' ? item.mealName :
                           item.medicationName}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="text-xs text-gray-400">{formatDate(item.timestamp)}</p>
                          {item.type === 'meal' && item.mealCategory && (
                            <span className="text-[10px] font-bold text-amber-500 bg-amber-50 px-1.5 py-0.5 rounded uppercase tracking-wider">{item.mealCategory}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    {item.type === 'meal' && item.carbs && (
                      <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-lg">{item.carbs}g carbs</span>
                    )}
                  </div>
                ));
              })()}
            </motion.div>
          )}

          {activeTab === 'glucose' && (
            <motion.div key="glucose" className="space-y-3">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Glucose Log</h2>
                <button onClick={() => setModalOpen('glucose')} className="text-xs font-bold text-indigo-600 flex items-center gap-1"><Plus size={14} /> Add Reading</button>
              </div>
              {readings.map(r => (
                <div key={r.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-center justify-between hover:border-indigo-200 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="text-3xl font-black text-gray-900 w-16">{r.value}</div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-400 uppercase">{r.unit}</span>
                        {r.mealContext && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-50 text-gray-500 uppercase">{r.mealContext}</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-1">{formatDate(r.timestamp)}</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 max-w-[40%] text-right italic">{r.notes}</p>
                </div>
              ))}
            </motion.div>
          )}

          {activeTab === 'meals' && (
            <motion.div key="meals" className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Meal Diary</h2>
                <button onClick={() => setModalOpen('meal')} className="text-xs font-bold text-amber-600 flex items-center gap-1"><Plus size={14} /> Log Meal</button>
              </div>
              {meals.map(m => (
                <div key={m.id} className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-black text-gray-900 leading-tight">{m.mealName}</h3>
                        {m.mealCategory && (
                          <span className="text-[10px] font-bold text-amber-500 bg-amber-50 px-1.5 py-0.5 rounded uppercase tracking-wider">{m.mealCategory}</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-1">{formatDate(m.timestamp)}</p>
                    </div>
                    {m.carbs && (
                      <div className="text-right">
                        <p className="text-xl font-black text-amber-600 leading-none">{m.carbs}<span className="text-[10px] lowercase opacity-60">g</span></p>
                        <p className="text-[10px] font-bold text-gray-400 uppercase">Carbs</p>
                      </div>
                    )}
                  </div>
                  {m.aiAnalysis && (
                    <div className="mt-4 p-4 bg-indigo-50 rounded-2xl flex gap-3 items-start border border-indigo-100">
                      <Brain size={16} className="text-indigo-500 mt-0.5 shrink-0" />
                      <p className="text-xs text-indigo-900 leading-relaxed font-medium">
                        {m.aiAnalysis}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </motion.div>
          )}

          {activeTab === 'meds' && (
            <motion.div key="meds" className="space-y-3">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Medication Logs</h2>
                <button onClick={() => setModalOpen('med')} className="text-xs font-bold text-teal-600 flex items-center gap-1"><Plus size={14} /> Log Dose</button>
              </div>
              {meds.map(m => (
                <div key={m.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-teal-50 text-teal-600 rounded-xl flex items-center justify-center">
                      <Pill size={20} />
                    </div>
                    <div>
                      <p className="font-bold text-gray-900 leading-tight">{m.medicationName}</p>
                      <p className="text-xs text-gray-400 mt-1">{formatDate(m.timestamp)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="px-3 py-1 bg-teal-600 text-white rounded-full text-[10px] font-black uppercase tracking-wider">{m.dose}</span>
                  </div>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* FAB */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2 p-2 bg-gray-900 rounded-3xl shadow-2xl z-40 border border-white/10 ring-8 ring-white/50">
        <button 
          onClick={() => setModalOpen('glucose')}
          className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-500 transition-all active:scale-95 shadow-lg shadow-indigo-600/20"
        >
          <Activity size={18} />
          New Log
        </button>
        <div className="w-px h-8 bg-gray-700 mx-1 opacity-50" />
        <button 
           onClick={() => setModalOpen('meal')}
           className="p-3 text-indigo-400 hover:text-white transition-colors"
           title="Add Meal"
        >
          <Utensils size={20} />
        </button>
        <button 
           onClick={() => setModalOpen('med')}
           className="p-3 text-indigo-400 hover:text-white transition-colors"
           title="Add Medication"
        >
          <Pill size={20} />
        </button>
        <button 
           onClick={() => setModalOpen('calculator')}
           className="p-3 text-indigo-400 hover:text-white transition-colors"
           title="Insulin Calculator"
        >
          <Calculator size={20} />
        </button>
      </div>

      {/* MODALS */}
      <AnimatePresence>
        {modalOpen === 'glucose' && (
          <Modal key="m-glucose" isOpen onClose={() => setModalOpen(null)} title="New Reading">
            <GlucoseForm 
              userId={user.uid} 
              onClose={() => setModalOpen(null)} 
              unit={profile?.unit || 'mg/dL'} 
            />
          </Modal>
        )}
        {modalOpen === 'meal' && (
          <Modal key="m-meal" isOpen onClose={() => setModalOpen(null)} title="Log Meal">
            <MealForm 
              userId={user.uid} 
              onClose={() => setModalOpen(null)} 
              profile={profile}
              onOpenCalculator={() => setModalOpen('calculator')}
            />
          </Modal>
        )}
        {modalOpen === 'med' && (
          <Modal key="m-med" isOpen onClose={() => setModalOpen(null)} title="Log Medication">
            <MedicationForm userId={user.uid} onClose={() => setModalOpen(null)} />
          </Modal>
        )}
        {modalOpen === 'settings' && profile && (
          <Modal key="m-settings" isOpen onClose={() => setModalOpen(null)} title="Settings">
            <SettingsForm 
              profile={profile} 
              onClose={() => setModalOpen(null)} 
              onUpdate={setProfile} 
            />
          </Modal>
        )}
        {modalOpen === 'calculator' && profile && (
          <Modal key="m-calc" isOpen onClose={() => setModalOpen(null)} title="Insulin Calculator">
            <InsulinCalculator 
              profile={profile} 
              latestGlucose={lastReading?.value}
              onOpenSettings={() => setModalOpen('settings')}
            />
          </Modal>
        )}
        {modalOpen === 'report' && (
          <Modal key="m-report" isOpen onClose={() => setModalOpen(null)} title="AI Health Report">
            <div className="space-y-6">
              {isAiLoading ? (
                <div className="flex flex-col items-center justify-center p-12 text-center space-y-4">
                  <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                    className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full"
                  />
                  <p className="text-sm font-medium text-gray-500">Gemini is analyzing your data...</p>
                </div>
              ) : (
                <>
                  <div className="p-5 bg-indigo-50 rounded-2xl border border-indigo-100">
                    <p className="text-sm text-indigo-900 leading-relaxed whitespace-pre-line font-medium">
                      {aiReport}
                    </p>
                  </div>
                  <button 
                    onClick={() => {
                      const blob = new Blob([aiReport || ""], { type: 'text/plain' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `GlucoTrack_Report_${new Date().toISOString().split('T')[0]}.txt`;
                      a.click();
                    }}
                    className="w-full bg-gray-900 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-3 active:scale-95"
                  >
                    <Share2 size={18} />
                    Download PDF Report
                  </button>
                </>
              )}
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- FORM COMPONENTS ---

function GlucoseForm({ userId, onClose, unit }: { userId: string, onClose: () => void, unit: string }) {
  const [value, setValue] = useState('');
  const [context, setContext] = useState<MealType>('Fasting');
  const [timestamp, setTimestamp] = useState(getCurrentDateTimeLocal());
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!value) return;
    setSubmitting(true);
    await dbService.addGlucose({
      userId,
      value: Number(value),
      unit: unit as any,
      timestamp: new Date(timestamp),
      notes,
      mealContext: context
    });
    setSubmitting(false);
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Glucose Level ({unit})</label>
        <input 
          autoFocus
          type="number"
          placeholder="0.0"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 text-3xl font-black text-gray-900 focus:ring-2 focus:ring-indigo-600 placeholder:text-gray-300"
          required
        />
      </div>

      <div className="space-y-2">
        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Date & Time</label>
        <input 
          type="datetime-local"
          value={timestamp}
          onChange={(e) => setTimestamp(e.target.value)}
          className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 text-sm font-bold text-gray-900 focus:ring-2 focus:ring-indigo-600"
          required
        />
      </div>

      <div className="space-y-2">
        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Context</label>
        <div className="flex flex-wrap gap-2">
          {(['Fasting', 'Before Breakfast', 'After Breakfast', 'Before Lunch', 'After Lunch', 'Before Dinner', 'After Dinner', 'Bedtime', 'Other'] as const).map(c => (
            <button 
              key={c}
              type="button"
              onClick={() => setContext(c)}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold transition-all",
                context === c ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Notes</label>
        <textarea 
          placeholder="Feeling a bit lightheaded..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 text-sm text-gray-900 focus:ring-2 focus:ring-indigo-600 min-h-[100px]"
        />
      </div>

      <button 
        disabled={submitting}
        className="w-full bg-indigo-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
      >
        {submitting ? 'Saving...' : 'Save Reading'}
      </button>
    </form>
  );
}

function MealForm({ userId, onClose, profile, onOpenCalculator }: { userId: string, onClose: () => void, profile: UserProfile | null, onOpenCalculator: () => void }) {
  const [mealName, setMealName] = useState('');
  const [category, setCategory] = useState<MealCategory>('Breakfast');
  const [carbs, setCarbs] = useState('');
  const [timestamp, setTimestamp] = useState(getCurrentDateTimeLocal());
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mealName) return;
    setSubmitting(true);
    
    // AI Analysis
    const aiAnalysis = await aiService.analyzeMeal(mealName, notes);
    
    await dbService.addMeal({
      userId,
      mealName,
      mealCategory: category,
      carbs: carbs ? Number(carbs) : undefined,
      timestamp: new Date(timestamp),
      notes,
      aiAnalysis
    });
    setSubmitting(false);
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">What did you eat?</label>
        <input 
          autoFocus
          type="text"
          placeholder="e.g. Avocado Toast"
          value={mealName}
          onChange={(e) => setMealName(e.target.value)}
          className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 font-bold text-gray-900 focus:ring-2 focus:ring-indigo-600 placeholder:text-gray-300"
          required
        />
      </div>

      <div className="space-y-2">
        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Meal Option</label>
        <div className="flex flex-wrap gap-2">
          {(['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Other'] as const).map(c => (
            <button 
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold transition-all",
                category === c ? "bg-amber-600 text-white shadow-lg shadow-amber-200" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Date & Time</label>
        <input 
          type="datetime-local"
          value={timestamp}
          onChange={(e) => setTimestamp(e.target.value)}
          className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 text-sm font-bold text-gray-900 focus:ring-2 focus:ring-indigo-600"
          required
        />
      </div>

      <div className="space-y-2">
        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Est. Carbs (g)</label>
        <input 
          type="number"
          placeholder="0"
          value={carbs}
          onChange={(e) => setCarbs(e.target.value)}
          className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 text-xl font-black text-gray-900 focus:ring-2 focus:ring-indigo-600 placeholder:text-gray-300"
        />
      </div>

      <div className="space-y-2">
        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Notes</label>
        <textarea 
          placeholder="Added some extra seeds..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 text-sm text-gray-900 focus:ring-2 focus:ring-indigo-600 min-h-[100px]"
        />
      </div>

      <div className="p-4 bg-indigo-50 rounded-2xl flex gap-3 items-center">
        <Brain size={20} className="text-indigo-500" />
        <p className="text-[11px] text-indigo-900 font-medium">Gemini will provide nutritional insights automatically after you save.</p>
      </div>

      {profile?.diabetesType === 'Type 1' && (
        <button 
          type="button"
          onClick={onOpenCalculator}
          className="w-full bg-white border border-indigo-200 text-indigo-600 font-bold py-3 rounded-xl flex items-center justify-center gap-2 text-sm hover:bg-indigo-50 transition-colors"
        >
          <Calculator size={16} />
          Calculate Insulin for this meal
        </button>
      )}

      <button 
        disabled={submitting}
        className="w-full bg-indigo-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
      >
        {submitting ? 'Analyzing & Saving...' : 'Log Meal'}
      </button>
    </form>
  );
}

function MedicationForm({ userId, onClose }: { userId: string, onClose: () => void }) {
  const [medName, setMedName] = useState('');
  const [medType, setMedType] = useState<MedicationType>('Oral');
  const [dose, setDose] = useState('');
  const [units, setUnits] = useState('');
  const [timestamp, setTimestamp] = useState(getCurrentDateTimeLocal());
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!medName || (!dose && !units)) return;
    setSubmitting(true);
    await dbService.addMedication({
      userId,
      medicationName: medName,
      medicationType: medType,
      dose: units ? `${units} units` : dose,
      units: units ? Number(units) : undefined,
      timestamp: new Date(timestamp),
      notes
    });
    setSubmitting(false);
    onClose();
  };

  const isInsulin = medType.includes('Insulin');

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Medication Type</label>
        <div className="flex flex-wrap gap-2">
          {(['Insulin (Bolus)', 'Insulin (Basal)', 'Oral', 'Other'] as const).map(c => (
            <button 
              key={c}
              type="button"
              onClick={() => {
                setMedType(c);
                if (c.includes('Insulin')) setMedName(c.includes('Bolus') ? 'Rapid-acting' : 'Long-acting');
              }}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold transition-all",
                medType === c ? "bg-teal-600 text-white shadow-lg shadow-teal-200" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Medication Name</label>
        <input 
          autoFocus
          type="text"
          placeholder="e.g. Humalog, Lantus, Metformin"
          value={medName}
          onChange={(e) => setMedName(e.target.value)}
          className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 font-bold text-gray-900 focus:ring-2 focus:ring-teal-600 placeholder:text-gray-300"
          required
        />
      </div>

      {isInsulin ? (
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Insulin Units</label>
          <input 
            type="number"
            step="0.5"
            placeholder="0.0"
            value={units}
            onChange={(e) => setUnits(e.target.value)}
            className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 text-3xl font-black text-gray-900 focus:ring-2 focus:ring-teal-600 placeholder:text-gray-300"
            required
          />
        </div>
      ) : (
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Dose</label>
          <input 
            type="text"
            placeholder="e.g. 500mg"
            value={dose}
            onChange={(e) => setDose(e.target.value)}
            className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 font-bold text-gray-900 focus:ring-2 focus:ring-teal-600 placeholder:text-gray-300"
            required
          />
        </div>
      )}

      <div className="space-y-2">
        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Date & Time</label>
        <input 
          type="datetime-local"
          value={timestamp}
          onChange={(e) => setTimestamp(e.target.value)}
          className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 text-sm font-bold text-gray-900 focus:ring-2 focus:ring-teal-600"
          required
        />
      </div>

      <div className="space-y-2">
        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Notes</label>
        <textarea 
          placeholder="Taken with snack..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 text-sm text-gray-900 focus:ring-2 focus:ring-teal-600 min-h-[100px]"
        />
      </div>

      <button 
        disabled={submitting}
        className="w-full bg-teal-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-teal-100 hover:bg-teal-700 transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
      >
        {submitting ? 'Saving...' : 'Log Medication'}
      </button>
    </form>
  );
}

function SettingsForm({ profile, onClose, onUpdate }: { profile: UserProfile | null, onClose: () => void, onUpdate: (p: UserProfile) => void }) {
  const [formData, setFormData] = useState(profile!);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    await dbService.saveUserProfile(formData);
    onUpdate(formData);
    setSubmitting(false);
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Diabetes Type</label>
          <select 
            value={formData.diabetesType}
            onChange={e => setFormData({ ...formData, diabetesType: e.target.value as any })}
            className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm font-bold text-gray-900 focus:ring-2 focus:ring-indigo-600"
          >
            <option value="Type 1">Type 1</option>
            <option value="Type 2">Type 2</option>
            <option value="Gestational">Gestational</option>
            <option value="Other">Other</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Target Min</label>
            <input 
              type="number"
              value={formData.targetGlucoseMin}
              onChange={e => setFormData({ ...formData, targetGlucoseMin: Number(e.target.value) })}
              className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm font-bold text-gray-900 focus:ring-2 focus:ring-indigo-600"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Target Max</label>
            <input 
              type="number"
              value={formData.targetGlucoseMax}
              onChange={e => setFormData({ ...formData, targetGlucoseMax: Number(e.target.value) })}
              className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm font-bold text-gray-900 focus:ring-2 focus:ring-indigo-600"
            />
          </div>
        </div>

        {formData.diabetesType === 'Type 1' && (
          <div className="space-y-4 p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100/50">
            <h4 className="text-xs font-bold text-indigo-900 uppercase tracking-wider">T1D Calculations</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-indigo-700 uppercase tracking-widest pl-1">Carb Ratio (g/unit)</label>
                <input 
                  type="number"
                  value={formData.carbRatio || ''}
                  placeholder="e.g. 10"
                  onChange={e => setFormData({ ...formData, carbRatio: Number(e.target.value) })}
                  className="w-full bg-white border-none rounded-xl px-4 py-3 text-sm font-bold text-gray-900 focus:ring-2 focus:ring-indigo-600"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-indigo-700 uppercase tracking-widest pl-1">ISF (Correction)</label>
                <input 
                  type="number"
                  value={formData.correctionFactor || ''}
                  placeholder="e.g. 50"
                  onChange={e => setFormData({ ...formData, correctionFactor: Number(e.target.value) })}
                  className="w-full bg-white border-none rounded-xl px-4 py-3 text-sm font-bold text-gray-900 focus:ring-2 focus:ring-indigo-600"
                />
              </div>
            </div>
            <p className="text-[10px] text-indigo-500 italic">These settings power the Insulin Bolus Calculator.</p>
          </div>
        )}
      </div>

      <button 
        disabled={submitting}
        className="w-full bg-gray-900 text-white font-black py-4 rounded-2xl shadow-xl hover:bg-gray-800 transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
      >
        {submitting ? 'Updating...' : 'Save Settings'}
      </button>
    </form>
  );
}

function InsulinCalculator({ profile, latestGlucose, onOpenSettings }: { profile: UserProfile | null, latestGlucose?: number, onOpenSettings: () => void }) {
  const [carbs, setCarbs] = useState('');
  const [currentGlucose, setCurrentGlucose] = useState(latestGlucose?.toString() || '');
  
  if (!profile) return null;

  const hasSettings = profile.carbRatio && profile.correctionFactor;

  const calculation = useMemo(() => {
    if (!hasSettings) return null;
    if (!carbs && !currentGlucose) return null;
    
    const carbInsulin = carbs ? Number(carbs) / profile.carbRatio! : 0;
    
    let correctionInsulin = 0;
    if (currentGlucose) {
      const targetMid = ((profile.targetGlucoseMin || 70) + (profile.targetGlucoseMax || 140)) / 2;
      correctionInsulin = (Number(currentGlucose) - targetMid) / profile.correctionFactor!;
    }
    
    // We only add correction insulin if it's positive, but we allow negative correction 
    // to reduce meal bolus if they are low (standard practice for some pumps).
    // Math.max for total ensures we don't suggest a negative dose.
    const total = Math.max(0, carbInsulin + correctionInsulin);
    
    return {
      carbInsulin: carbInsulin.toFixed(1),
      correctionInsulin: correctionInsulin.toFixed(1),
      total: total.toFixed(1)
    };
  }, [carbs, currentGlucose, profile, hasSettings]);

  if (!hasSettings) {
    return (
      <div className="space-y-6">
        <div className="p-6 bg-amber-50 rounded-3xl border border-amber-100 flex flex-col items-center text-center gap-4">
          <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
            <AlertCircle size={24} />
          </div>
          <div className="space-y-1">
            <p className="font-bold text-amber-900">Missing Settings</p>
            <p className="text-sm text-amber-700">Please configure your Carb Ratio and Correction Factor in Settings to use the calculator.</p>
          </div>
          <button 
            onClick={onOpenSettings}
            className="w-full bg-amber-600 text-white font-bold py-3 rounded-xl shadow-lg shadow-amber-100 hover:bg-amber-700 transition-all"
          >
            Go to Settings
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Carbs to cover (g)</label>
          <input 
            type="number"
            value={carbs}
            onChange={e => setCarbs(e.target.value)}
            className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 text-2xl font-black text-gray-900 focus:ring-2 focus:ring-indigo-600"
            placeholder="0"
          />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Current Blood Sugar ({profile.unit})</label>
          <input 
            type="number"
            value={currentGlucose}
            onChange={e => setCurrentGlucose(e.target.value)}
            className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 text-2xl font-black text-gray-900 focus:ring-2 focus:ring-indigo-600"
            placeholder="0"
          />
        </div>
      </div>

      {!currentGlucose && !carbs && (
        <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100 flex gap-3 items-center">
          <AlertCircle size={20} className="text-indigo-400" />
          <p className="text-xs text-indigo-900 font-medium">Enter your carbs or blood sugar to calculate dose.</p>
        </div>
      )}

      {calculation && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-indigo-600 rounded-3xl p-6 text-white shadow-xl shadow-indigo-100"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold uppercase tracking-widest text-indigo-100">Recommended Dose</span>
            <Calculator size={16} className="text-indigo-200" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-black">{calculation.total}</span>
            <span className="text-lg font-medium opacity-70">units</span>
          </div>
          <div className="mt-4 pt-4 border-t border-indigo-500/50 grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] font-bold text-indigo-200 uppercase tracking-wider">Meal Bolus</p>
              <p className="font-bold">{calculation.carbInsulin}u</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-indigo-200 uppercase tracking-wider">Correction</p>
              <p className="font-bold">{calculation.correctionInsulin}u</p>
            </div>
          </div>
        </motion.div>
      )}

      <div className="p-4 bg-gray-50 rounded-2xl">
         <p className="text-[10px] text-gray-500 leading-relaxed italic text-center">
           Calculations are based on your personal settings. Always consult your doctor before making insulin decisions.
         </p>
      </div>
    </div>
  );
}
