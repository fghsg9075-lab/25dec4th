import React, { useState, useEffect } from 'react';
import { User, Subject, Chapter } from '../types';
import { fetchChapters } from '../services/gemini';
import { getSubjectsList } from '../constants';
import { ArrowLeft, BookOpen, Lock, FileText, CheckCircle, Search, RefreshCw, X, Crown } from 'lucide-react';
import { getChapterData } from '../firebase';
import { PurchaseModal } from './PurchaseModal';

interface Props {
  user: User;
  mode: 'FREE' | 'PREMIUM' | 'ULTRA';
  onUnlock: (cost: number, contentId: string) => void;
}

export const PdfLibrary: React.FC<Props> = ({ user, mode, onUnlock }) => {
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(false);
  const [pdfData, setPdfData] = useState<Record<string, {url: string, price: number}>>({});
  const [viewingPdf, setViewingPdf] = useState<string | null>(null);
  const [purchaseModal, setPurchaseModal] = useState<{title: string, price: number, id: string} | null>(null);

  const subjects = getSubjectsList(user.classLevel || '10', user.stream || 'Science');

  const handleSubjectSelect = async (subject: Subject) => {
    setSelectedSubject(subject);
    setLoading(true);
    try {
      const ch = await fetchChapters(user.board || 'CBSE', user.classLevel || '10', user.stream || 'Science', subject, 'English');
      setChapters(ch);
      
      const dataMap: Record<string, {url: string, price: number}> = {};
      const streamKey = (user.classLevel === '11' || user.classLevel === '12') ? `-${user.stream}` : '';
      
      for (const c of ch) {
          const key = `nst_content_${user.board}_${user.classLevel}${streamKey}_${subject.name}_${c.id}`;
          const localData = localStorage.getItem(key);
          if (localData) {
              try {
                  const parsed = JSON.parse(localData);
                  const price = parsed.price || 0;
                  if (mode === 'FREE' && parsed.freeLink) dataMap[c.id] = { url: parsed.freeLink, price };
                  else if (mode === 'PREMIUM' && parsed.premiumLink) dataMap[c.id] = { url: parsed.premiumLink, price };
                  else if (mode === 'ULTRA' && parsed.ultraLink) dataMap[c.id] = { url: parsed.ultraLink, price };
              } catch (e) {
                  console.warn("Corrupted chapter data:", key);
              }
          }
      }
      setPdfData(dataMap);

    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const handleItemClick = (chapter: Chapter) => {
      const item = pdfData[chapter.id];
      if (!item) return;

      const contentId = `${chapter.id}_${mode}`; // Unique ID per mode
      const isPurchased = user.purchasedContent?.includes(contentId);
      
      // If free or already purchased
      if (item.price === 0 || isPurchased) {
          setViewingPdf(item.url);
      } else {
          // Trigger Purchase Flow
          setPurchaseModal({
              title: `${chapter.title} (${mode === 'FREE' ? 'Notes' : mode === 'PREMIUM' ? 'Premium PDF' : 'Ultra PDF'})`,
              price: item.price,
              id: contentId
          });
      }
  };

  const confirmPurchase = () => {
      if (!purchaseModal) return;
      onUnlock(purchaseModal.price, purchaseModal.id);
      setPurchaseModal(null);
      // Determine URL again to open immediately (optional, or wait for re-render)
      // For smoother UX, we just close modal. The parent update will re-render this component with 'isPurchased' true.
      alert("Unlocked! Tap again to view."); 
  };

  const title = mode === 'FREE' ? 'Free Notes' : mode === 'PREMIUM' ? 'Premium PDFs' : 'Ultra PDF Collection';
  const themeColor = mode === 'FREE' ? 'blue' : mode === 'PREMIUM' ? 'purple' : 'amber';

  if (viewingPdf) {
      return (
          <div className="fixed inset-0 z-50 bg-black flex flex-col animate-in fade-in">
              <div className="bg-slate-900 text-white p-4 flex justify-between items-center">
                  <h3 className="font-bold truncate max-w-[80%]">PDF Viewer</h3>
                  <button onClick={() => setViewingPdf(null)} className="p-2 bg-slate-800 rounded-full hover:bg-slate-700"><X size={20} /></button>
              </div>
              <iframe src={viewingPdf} className="flex-1 w-full bg-slate-100" title="PDF Viewer" />
          </div>
      );
  }

  return (
    <div className="animate-in fade-in slide-in-from-right duration-300">
      {purchaseModal && (
          <PurchaseModal 
              title={purchaseModal.title}
              price={purchaseModal.price}
              userBalance={user.credits}
              onConfirm={confirmPurchase}
              onCancel={() => setPurchaseModal(null)}
          />
      )}

      {/* HEADER */}
      <div className={`mb-6 p-6 rounded-3xl text-white shadow-lg bg-gradient-to-r ${mode === 'FREE' ? 'from-blue-500 to-cyan-500' : mode === 'PREMIUM' ? 'from-purple-600 to-pink-600' : 'from-amber-500 to-orange-600'}`}>
        <div className="flex items-center gap-3 mb-2">
            <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm">
                <FileText size={24} className="text-white" />
            </div>
            <h2 className="text-2xl font-black">{title}</h2>
        </div>
        <p className="text-white/80 text-sm font-medium">
            {mode === 'FREE' ? 'Access high-quality study notes.' : mode === 'PREMIUM' ? 'Exclusive detailed notes.' : 'Top-tier comprehensive material.'}
        </p>
      </div>

      {/* SUBJECT SELECTION */}
      {!selectedSubject ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {subjects.map(sub => (
                  <button 
                      key={sub.id}
                      onClick={() => handleSubjectSelect(sub)}
                      className="p-4 bg-white border border-slate-200 rounded-2xl hover:shadow-lg hover:scale-105 transition-all flex flex-col items-center justify-center gap-3 group relative overflow-hidden"
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
                      <span className={`w-2 h-8 rounded-full bg-${themeColor}-500`}></span>
                      {selectedSubject.name}
                  </h3>
                  {loading && <RefreshCw className="animate-spin text-slate-400" size={18} />}
              </div>

              <div className="space-y-3">
                  {chapters.map((ch, idx) => {
                      const item = pdfData[ch.id];
                      const hasLink = !!item;
                      const contentId = `${ch.id}_${mode}`;
                      const isPurchased = user.purchasedContent?.includes(contentId);
                      const isLocked = item && item.price > 0 && !isPurchased;

                      return (
                          <button 
                              key={ch.id} 
                              onClick={() => hasLink && handleItemClick(ch)}
                              className={`w-full p-4 rounded-xl border flex items-center justify-between group transition-all text-left ${hasLink ? 'bg-white border-slate-200 hover:border-blue-300 hover:shadow-md' : 'bg-slate-50 border-slate-100 opacity-70 cursor-not-allowed'}`}
                          >
                              <div className="flex items-center gap-4">
                                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${hasLink ? `bg-${themeColor}-100 text-${themeColor}-600` : 'bg-slate-200 text-slate-400'}`}>
                                      {idx + 1}
                                  </div>
                                  <div>
                                      <h4 className={`font-bold text-sm ${hasLink ? 'text-slate-800' : 'text-slate-500'}`}>{ch.title}</h4>
                                      <p className="text-[10px] text-slate-400">
                                          {hasLink ? (isLocked ? `Unlock for ${item.price} Coins` : 'Tap to view PDF') : 'Coming Soon'}
                                      </p>
                                  </div>
                              </div>
                              <div className="pr-2">
                                  {hasLink ? (
                                      isLocked ? <Lock size={16} className="text-red-400" /> : <ArrowRightIcon color={themeColor} />
                                  ) : <Lock size={16} className="text-slate-300" />}
                              </div>
                          </button>
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

const ArrowRightIcon = ({color}: {color: string}) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`text-${color}-500`}>
        <path d="M5 12h14" />
        <path d="m12 5 7 7-7 7" />
    </svg>
);
