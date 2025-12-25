
import React, { useState, useEffect } from 'react';
import { User, Subject, Chapter, LessonContent } from '../types';
import { getSubjectsList } from '../constants';
import { fetchChapters } from '../services/gemini';
import { getChapterData } from '../firebase';
import { LessonView } from './LessonView';
import { BookOpen, PlayCircle, ArrowLeft, Clock, Lock, CheckCircle, Crown } from 'lucide-react';
import { PurchaseModal } from './PurchaseModal';

interface Props {
  user: User;
  onUnlock: (cost: number, contentId: string) => void;
}

type VideoViewMode = 'SUBJECT_LIST' | 'CHAPTER_LIST' | 'PLAYER';

export const VideoLibrary: React.FC<Props> = ({ user, onUnlock }) => {
  const [view, setView] = useState<VideoViewMode>('SUBJECT_LIST');
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  const [loading, setLoading] = useState(false);
  const [videoContent, setVideoContent] = useState<LessonContent | null>(null);
  const [chapterPrices, setChapterPrices] = useState<Record<string, number>>({});
  const [purchaseModal, setPurchaseModal] = useState<{title: string, price: number, id: string} | null>(null);

  // Load Chapters when Subject is selected
  useEffect(() => {
    const loadChapters = async () => {
      if (selectedSubject && user.classLevel) {
        setLoading(true);
        try {
          const fetchedChapters = await fetchChapters(
            user.board || 'CBSE',
            user.classLevel,
            user.stream || null,
            selectedSubject,
            'English' 
          );
          setChapters(fetchedChapters);
          
          // Pre-fetch prices (optional optimization)
          const prices: Record<string, number> = {};
          const streamKey = (user.classLevel === '11' || user.classLevel === '12') ? `-${user.stream}` : '';
          
          for (const ch of fetchedChapters) {
              const key = `nst_content_${user.board}_${user.classLevel}${streamKey}_${selectedSubject.name}_${ch.id}`;
              const data = localStorage.getItem(key);
              if (data) {
                  try {
                      const p = JSON.parse(data);
                      if (p.price) prices[ch.id] = p.price;
                  } catch(e) {
                      console.warn("Corrupted video price data:", key);
                  }
              }
          }
          setChapterPrices(prices);

        } catch (err) {
          console.error("Failed to load chapters", err);
          setChapters([]);
        } finally {
          setLoading(false);
        }
      }
    };

    if (view === 'CHAPTER_LIST') {
      loadChapters();
    }
  }, [selectedSubject, view, user]);

  const handleSubjectSelect = (subject: Subject) => {
    setSelectedSubject(subject);
    setView('CHAPTER_LIST');
  };

  const confirmPurchase = () => {
      if (!purchaseModal) return;
      onUnlock(purchaseModal.price, purchaseModal.id);
      setPurchaseModal(null);
      // Automatically proceed to open chapter after purchase (via re-render effect or direct call)
      if (selectedChapter) handleChapterSelect(selectedChapter, true);
  };

  const handleChapterSelect = async (chapter: Chapter, forceOpen = false) => {
    setSelectedChapter(chapter);
    
    // Check Price/Unlock Status
    const price = chapterPrices[chapter.id] || 0;
    const contentId = `${chapter.id}_VIDEO`;
    const isPurchased = user.purchasedContent?.includes(contentId);

    if (price > 0 && !isPurchased && !forceOpen) {
        setPurchaseModal({
            title: `${chapter.title} (Video Class)`,
            price: price,
            id: contentId
        });
        return;
    }

    setLoading(true);
    
    // Fetch Video Content
    try {
        const streamKey = (user.classLevel === '11' || user.classLevel === '12') ? `-${user.stream}` : '';
        const mainKey = `nst_content_${user.board}_${user.classLevel}${streamKey}_${selectedSubject?.name}_${chapter.id}`;
        
        // Fetch from Admin Data
        const onlineContent = await getChapterData(mainKey);
        
        let content: LessonContent | null = null;

        if (onlineContent && (onlineContent.videoPlaylist?.length > 0 || onlineContent.freeVideoLink || onlineContent.premiumVideoLink)) {
             const videoUrl = onlineContent.premiumVideoLink || onlineContent.freeVideoLink || '';
             content = {
                id: Date.now().toString(),
                title: chapter.title,
                subtitle: "Video Lecture",
                content: videoUrl,
                type: 'VIDEO_LECTURE',
                dateCreated: new Date().toISOString(),
                subjectName: selectedSubject?.name || '',
                videoPlaylist: onlineContent.videoPlaylist,
                isComingSoon: false
            };
        } else {
            content = {
                id: Date.now().toString(),
                title: chapter.title,
                subtitle: "Video Lecture",
                content: "",
                type: 'VIDEO_LECTURE',
                dateCreated: new Date().toISOString(),
                subjectName: selectedSubject?.name || '',
                isComingSoon: true
            };
        }
        
        setVideoContent(content);
        setView('PLAYER');

    } catch (err) {
        console.error("Error fetching video content", err);
    } finally {
        setLoading(false);
    }
  };

  const handleBack = () => {
    if (view === 'PLAYER') {
        setView('CHAPTER_LIST');
        setVideoContent(null);
        setSelectedChapter(null);
    } else if (view === 'CHAPTER_LIST') {
        setView('SUBJECT_LIST');
        setSelectedSubject(null);
        setChapters([]);
    }
  };

  if (view === 'PLAYER' && videoContent && selectedSubject && selectedChapter && user.classLevel) {
      return (
          <LessonView 
              content={videoContent}
              subject={selectedSubject}
              classLevel={user.classLevel}
              chapter={selectedChapter}
              loading={loading}
              onBack={handleBack}
          />
      );
  }

  if (view === 'CHAPTER_LIST' && selectedSubject) {
      return (
        <div className="animate-in fade-in slide-in-from-right-8 duration-500 max-w-4xl mx-auto pb-20">
            {purchaseModal && (
              <PurchaseModal 
                  title={purchaseModal.title}
                  price={purchaseModal.price}
                  userBalance={user.credits}
                  onConfirm={confirmPurchase}
                  onCancel={() => setPurchaseModal(null)}
              />
            )}

            <div className="flex items-center mb-6 sticky top-0 bg-white z-10 py-4 border-b border-slate-100">
                <button onClick={handleBack} className="bg-slate-100 p-2 rounded-full hover:bg-slate-200 mr-4">
                    <ArrowLeft size={20} className="text-slate-600" />
                </button>
                <div>
                    <h2 className="text-xl font-bold text-slate-800">{selectedSubject.name} Videos</h2>
                    <p className="text-xs text-slate-500">Select a chapter to watch</p>
                </div>
            </div>

            {loading ? (
                <div className="space-y-4 p-4">
                    {[1, 2, 3, 4].map(i => <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse"></div>)}
                </div>
            ) : (
                <div className="space-y-4 px-1">
                    {chapters.map((chapter, index) => {
                        const price = chapterPrices[chapter.id] || 0;
                        const contentId = `${chapter.id}_VIDEO`;
                        const isPurchased = user.purchasedContent?.includes(contentId);
                        const isLocked = price > 0 && !isPurchased;

                        return (
                            <button
                                key={chapter.id}
                                onClick={() => handleChapterSelect(chapter)}
                                className="w-full p-5 rounded-xl border border-slate-200 bg-white hover:border-red-300 hover:shadow-md transition-all text-left flex items-center group relative overflow-hidden"
                            >
                                {/* Status Indicator Bar (Red for Video) */}
                                <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${isLocked ? 'bg-slate-300' : 'bg-red-500'}`}></div>

                                <div className="mr-5 ml-2 min-w-[3.5rem] flex flex-col items-center">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">CH</span>
                                    <span className="text-2xl font-bold text-slate-700">
                                        {(index + 1).toString().padStart(2, '0')}
                                    </span>
                                </div>

                                <div className="flex-1 pr-4">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className="font-bold text-lg text-slate-800 group-hover:text-red-700 transition-colors">
                                            {chapter.title}
                                        </h3>
                                        {isLocked && <span className="bg-yellow-100 text-yellow-700 text-[10px] font-black px-2 py-0.5 rounded flex items-center gap-1"><Crown size={10} fill="currentColor"/> {price} CR</span>}
                                    </div>
                                    <div className="flex items-center gap-1 text-xs text-slate-500 font-medium">
                                        <Clock size={12} />
                                        <span>{isLocked ? 'Tap to Unlock' : 'Watch Video Lecture'}</span>
                                    </div>
                                </div>

                                <div className="ml-2">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${isLocked ? 'bg-slate-100 text-slate-400' : 'bg-red-50 text-red-600 group-hover:bg-red-600 group-hover:text-white'}`}>
                                        {isLocked ? <Lock size={20} /> : <PlayCircle size={20} />}
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                    {chapters.length === 0 && (
                         <div className="text-center py-20 text-slate-400">
                            <BookOpen size={48} className="mx-auto mb-4 opacity-50"/>
                            <p>No chapters found.</p>
                         </div>
                    )}
                </div>
            )}
        </div>
      );
  }

  // SUBJECT LIST VIEW
  const subjects = getSubjectsList(user.classLevel || '10', user.stream || null);

  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-300 pb-20">
        <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center text-red-600">
                <PlayCircle size={28} />
            </div>
            <div>
                <h2 className="text-2xl font-black text-slate-800">Video Library</h2>
                <p className="text-xs text-slate-500 font-medium">Watch lectures for your class</p>
            </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {subjects.map((subj) => (
                <button 
                    key={subj.id} 
                    onClick={() => handleSubjectSelect(subj)}
                    className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-red-400 transition-all text-left flex items-center gap-4 group"
                >
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg ${subj.color.replace('text-slate-600', '').replace('bg-slate-50', '')} bg-gradient-to-br from-slate-700 to-slate-900 group-hover:scale-110 transition-transform`}>
                        <span className="text-xl font-bold">{subj.name.charAt(0)}</span>
                    </div>
                    <div>
                        <h3 className="font-bold text-lg text-slate-800 group-hover:text-red-600 transition-colors">{subj.name}</h3>
                        <p className="text-xs text-slate-400 font-medium mt-1">Tap to view chapters</p>
                    </div>
                </button>
            ))}
        </div>
    </div>
  );
};
