import React, { useState } from 'react';
import { User, Subject, Chapter, MCQItem } from '../types';
import { fetchChapters } from '../services/gemini';
import { getSubjectsList } from '../constants';
import { ArrowLeft, CheckCircle, RefreshCw, X, Play, AlertCircle, Lock, Crown } from 'lucide-react';
import { PurchaseModal } from './PurchaseModal';

interface Props {
  user: User;
  onUnlock: (cost: number, contentId: string) => void;
}

export const McqLibrary: React.FC<Props> = ({ user, onUnlock }) => {
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeMcqSet, setActiveMcqSet] = useState<MCQItem[] | null>(null);
  const [chapterPrices, setChapterPrices] = useState<Record<string, number>>({});
  const [purchaseModal, setPurchaseModal] = useState<{title: string, price: number, id: string} | null>(null);
  
  // MCQ Game State
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);

  const subjects = getSubjectsList(user.classLevel || '10', user.stream || 'Science');

  const handleSubjectSelect = async (subject: Subject) => {
    setSelectedSubject(subject);
    setLoading(true);
    try {
      const ch = await fetchChapters(user.board || 'CBSE', user.classLevel || '10', user.stream || 'Science', subject, 'English');
      setChapters(ch);
      
      // Load prices
      const prices: Record<string, number> = {};
      const streamKey = (user.classLevel === '11' || user.classLevel === '12') ? `-${user.stream}` : '';
      for (const c of ch) {
          const key = `nst_content_${user.board}_${user.classLevel}${streamKey}_${subject.name}_${c.id}`;
          const localData = localStorage.getItem(key);
          if (localData) {
              try {
                  const parsed = JSON.parse(localData);
                  if (parsed.price) prices[c.id] = parsed.price;
              } catch (e) {
                  console.warn("Corrupted price data:", key);
              }
          }
      }
      setChapterPrices(prices);

    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const startMcq = (chapter: Chapter, forceOpen = false) => {
      const price = chapterPrices[chapter.id] || 0;
      const contentId = `${chapter.id}_MCQ`;
      const isPurchased = user.purchasedContent?.includes(contentId);

      if (price > 0 && !isPurchased && !forceOpen) {
          setPurchaseModal({
              title: `${chapter.title} (MCQ Practice)`,
              price: price,
              id: contentId
          });
          return;
      }

      // Load MCQs for this chapter
      const streamKey = (user.classLevel === '11' || user.classLevel === '12') ? `-${user.stream}` : '';
      const key = `nst_content_${user.board}_${user.classLevel}${streamKey}_${selectedSubject?.name}_${chapter.id}`;
      const data = localStorage.getItem(key);
      
      if (data) {
          try {
              const parsed = JSON.parse(data);
              if (parsed.manualMcqData && parsed.manualMcqData.length > 0) {
                  setActiveMcqSet(parsed.manualMcqData);
                  setCurrentQIndex(0);
                  setScore(0);
                  setShowResult(false);
                  setSelectedOption(null);
                  setIsAnswered(false);
              } else {
                  alert("No MCQs added for this chapter yet.");
              }
          } catch (e) {
              console.error("Failed to parse MCQ data", e);
              alert("Error loading MCQ data.");
          }
      } else {
          alert("No content data found.");
      }
  };

  const confirmPurchase = () => {
      if (!purchaseModal) return;
      onUnlock(purchaseModal.price, purchaseModal.id);
      // Try open again
      // We need to find the chapter object. For simplicity, we just close and let user tap again or we can store pending chapter.
      // Re-fetch logic to check purchased status might be needed or just force open if we had chapter ref.
      setPurchaseModal(null);
      alert("Unlocked! Tap again to start.");
  };

  const handleOptionSelect = (idx: number) => {
      if (isAnswered || !activeMcqSet) return;
      setSelectedOption(idx);
      setIsAnswered(true);
      if (idx === activeMcqSet[currentQIndex].correctAnswer) {
          setScore(s => s + 1);
      }
  };

  const nextQuestion = () => {
      if (!activeMcqSet) return;
      if (currentQIndex < activeMcqSet.length - 1) {
          setCurrentQIndex(prev => prev + 1);
          setSelectedOption(null);
          setIsAnswered(false);
      } else {
          setShowResult(true);
      }
  };

  if (activeMcqSet) {
      // --- MCQ GAME UI ---
      if (showResult) {
          return (
              <div className="animate-in fade-in zoom-in p-6 bg-white rounded-3xl shadow-lg text-center border border-slate-200">
                  <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 text-4xl">🏆</div>
                  <h2 className="text-2xl font-black text-slate-800 mb-2">Practice Complete!</h2>
                  <p className="text-slate-500 mb-6">You scored <span className="text-green-600 font-bold">{score}</span> out of <span className="font-bold">{activeMcqSet.length}</span></p>
                  <button onClick={() => setActiveMcqSet(null)} className="w-full py-3 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-900">Back to Chapters</button>
              </div>
          );
      }

      const q = activeMcqSet[currentQIndex];

      return (
          <div className="fixed inset-0 z-50 bg-slate-50 flex flex-col animate-in slide-in-from-bottom">
              {/* HEADER */}
              <div className="bg-white p-4 shadow-sm flex justify-between items-center">
                  <div className="flex items-center gap-2">
                      <button onClick={() => { if(confirm("Quit Practice?")) setActiveMcqSet(null); }} className="p-2 hover:bg-slate-100 rounded-full"><X size={20} /></button>
                      <span className="font-bold text-slate-700">Q{currentQIndex + 1}/{activeMcqSet.length}</span>
                  </div>
                  <div className="text-xs font-bold bg-green-100 text-green-700 px-3 py-1 rounded-full">Score: {score}</div>
              </div>

              {/* QUESTION BODY */}
              <div className="flex-1 overflow-y-auto p-6">
                  <h3 className="text-lg font-bold text-slate-800 mb-6 leading-relaxed">{q.question}</h3>
                  <div className="space-y-3">
                      {q.options.map((opt, idx) => {
                          let stateClass = 'bg-white border-slate-200 hover:border-blue-300';
                          if (isAnswered) {
                              if (idx === q.correctAnswer) stateClass = 'bg-green-100 border-green-500 text-green-800';
                              else if (idx === selectedOption) stateClass = 'bg-red-50 border-red-300 text-red-800';
                              else stateClass = 'bg-slate-50 border-slate-200 opacity-50';
                          } else if (selectedOption === idx) {
                              stateClass = 'bg-blue-50 border-blue-500';
                          }

                          return (
                              <button 
                                  key={idx} 
                                  onClick={() => handleOptionSelect(idx)}
                                  disabled={isAnswered}
                                  className={`w-full p-4 rounded-xl border-2 text-left font-medium text-sm transition-all ${stateClass}`}
                              >
                                  <span className="mr-2 font-bold opacity-60">{String.fromCharCode(65 + idx)}.</span> {opt}
                              </button>
                          );
                      })}
                  </div>
                  
                  {isAnswered && (
                      <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-100 animate-in fade-in">
                          <p className="font-bold text-blue-800 text-xs mb-1 uppercase">Explanation</p>
                          <p className="text-sm text-blue-900 leading-relaxed">{q.explanation || "No explanation provided."}</p>
                      </div>
                  )}
              </div>

              {/* FOOTER */}
              <div className="p-4 bg-white border-t border-slate-200">
                  <button 
                      onClick={nextQuestion} 
                      disabled={!isAnswered}
                      className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-2 ${isAnswered ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-slate-200 text-slate-400'}`}
                  >
                      {currentQIndex === activeMcqSet.length - 1 ? 'Finish' : 'Next Question'} <ArrowLeft size={20} className="rotate-180" />
                  </button>
              </div>
          </div>
      );
  }

  // --- MAIN LIBRARY UI ---
  return (
    <div className="animate-in fade-in slide-in-from-right duration-300">
      {/* HEADER */}
      <div className="mb-6 p-6 rounded-3xl text-white shadow-lg bg-gradient-to-r from-teal-500 to-emerald-500">
        <div className="flex items-center gap-3 mb-2">
            <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm">
                <CheckCircle size={24} className="text-white" />
            </div>
            <h2 className="text-2xl font-black">MCQ Practice</h2>
        </div>
        <p className="text-white/80 text-sm font-medium">Test your knowledge with chapter-wise practice sets.</p>
      </div>

      {!selectedSubject ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {subjects.map(sub => (
                  <button 
                      key={sub.id}
                      onClick={() => handleSubjectSelect(sub)}
                      className="p-4 bg-white border border-slate-200 rounded-2xl hover:shadow-lg hover:scale-105 transition-all flex flex-col items-center justify-center gap-3 group"
                  >
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold shadow-sm ${sub.color} group-hover:scale-110 transition-transform`}>
                          {sub.name.charAt(0)}
                      </div>
                      <span className="font-bold text-slate-700 text-sm text-center">{sub.name}</span>
                  </button>
              ))}
          </div>
      ) : (
          <div>
              <button onClick={() => setSelectedSubject(null)} className="mb-4 flex items-center gap-2 text-slate-500 font-bold text-xs hover:text-slate-800 transition-colors bg-white px-3 py-2 rounded-lg border border-slate-200 shadow-sm">
                  <ArrowLeft size={14} /> Back to Subjects
              </button>

              <div className="flex items-center justify-between mb-4">
                  <h3 className="font-black text-xl text-slate-800 flex items-center gap-2">
                      <span className="w-2 h-8 rounded-full bg-emerald-500"></span>
                      {selectedSubject.name}
                  </h3>
                  {loading && <RefreshCw className="animate-spin text-slate-400" size={18} />}
              </div>

              <div className="space-y-3">
                  {purchaseModal && (
                      <PurchaseModal 
                          title={purchaseModal.title}
                          price={purchaseModal.price}
                          userBalance={user.credits}
                          onConfirm={confirmPurchase}
                          onCancel={() => setPurchaseModal(null)}
                      />
                  )}

                  {chapters.map((ch, idx) => {
                      const price = chapterPrices[ch.id] || 0;
                      const contentId = `${ch.id}_MCQ`;
                      const isPurchased = user.purchasedContent?.includes(contentId);
                      const isLocked = price > 0 && !isPurchased;

                      return (
                          <div key={ch.id} className={`flex justify-between items-center p-4 rounded-xl border transition-all cursor-pointer group ${isLocked ? 'bg-slate-50 border-slate-200' : 'bg-white border-slate-200 hover:border-emerald-300 hover:shadow-md'}`} onClick={() => startMcq(ch)}>
                              <div className="flex items-center gap-4">
                                  <span className={`font-bold w-8 h-8 flex items-center justify-center rounded-full text-xs transition-colors ${isLocked ? 'bg-slate-200 text-slate-400' : 'bg-slate-100 text-slate-500 group-hover:bg-emerald-100 group-hover:text-emerald-600'}`}>{idx + 1}</span>
                                  <div>
                                      <span className={`font-bold text-sm ${isLocked ? 'text-slate-500' : 'text-slate-700'}`}>{ch.title}</span>
                                      {isLocked && <div className="flex items-center gap-1 mt-1 text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded w-fit"><Crown size={10} /> {price} Coins</div>}
                                  </div>
                              </div>
                              <button className={`p-2 rounded-full transition-opacity ${isLocked ? 'bg-slate-100 text-slate-400' : 'bg-emerald-50 text-emerald-600 opacity-0 group-hover:opacity-100'}`}>
                                  {isLocked ? <Lock size={16} /> : <Play size={16} fill="currentColor" />}
                              </button>
                          </div>
                      );
                  })}
                  {!loading && chapters.length === 0 && (
                      <div className="text-center py-10 text-slate-400">
                          <p>No chapters found.</p>
                      </div>
                  )}
              </div>
          </div>
      )}
    </div>
  );
};
