
import React, { useState, useEffect, useMemo } from 'react';
import { DESIGN_STYLES, LOADING_MESSAGES } from './constants';
import { DesignStyle, ChatMessage } from './types';
import { generateDesign, editDesign, chatWithDesigner } from './services/geminiService';
import ComparisonSlider from './components/ComparisonSlider';
import ChatInterface from './components/ChatInterface';

const App: React.FC = () => {
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [reimaginedImage, setReimaginedImage] = useState<string | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<DesignStyle | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState(LOADING_MESSAGES[0]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  
  // Style filtering states
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('All');

  const categories = useMemo(() => {
    const cats = new Set(DESIGN_STYLES.map(s => s.category));
    return ['All', ...Array.from(cats)];
  }, []);

  const filteredStyles = useMemo(() => {
    return DESIGN_STYLES.filter(style => {
      const matchesSearch = style.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           style.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = activeCategory === 'All' || style.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, activeCategory]);

  // Rotation for loading messages
  useEffect(() => {
    let interval: any;
    if (loading) {
      let idx = 0;
      interval = setInterval(() => {
        idx = (idx + 1) % LOADING_MESSAGES.length;
        setLoadingMsg(LOADING_MESSAGES[idx]);
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [loading]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setOriginalImage(reader.result as string);
        setReimaginedImage(null);
        setSelectedStyle(null);
        setMessages([]);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleStyleSelect = async (style: DesignStyle) => {
    if (!originalImage || loading) return;
    setSelectedStyle(style);
    setLoading(true);

    try {
      const base64Data = originalImage.split(',')[1];
      const result = await generateDesign(base64Data, style.prompt);
      setReimaginedImage(result);
      
      const introMsg: ChatMessage = {
        role: 'model',
        text: `Voila! I've reimagined your space in a ${style.name} style. How do you like the transformation? Feel free to ask me to adjust details or find matching furniture!`,
        timestamp: Date.now()
      };
      setMessages([introMsg]);
    } catch (error) {
      console.error(error);
      alert("Oops! Design generation failed. Please check your API key and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (text: string) => {
    if (chatLoading) return;

    const userMsg: ChatMessage = { role: 'user', text, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setChatLoading(true);

    try {
      const chatHistory = messages.map(m => ({ role: m.role, text: m.text }));
      const response = await chatWithDesigner(text, chatHistory);
      
      const modelMsg: ChatMessage = {
        role: 'model',
        text: response.text,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, modelMsg]);

      if (response.grounding && response.grounding.length > 0) {
        const linkTexts = response.grounding
          .filter(g => g.web)
          .map(g => `• [${g.web?.title}](${g.web?.uri})`)
          .join('\n');
        
        if (linkTexts) {
          setMessages(prev => [...prev, {
            role: 'model',
            text: `Here are some shoppable resources for you:\n${linkTexts}`,
            timestamp: Date.now()
          }]);
        }
      }

      if (response.shouldUpdateImage && reimaginedImage) {
        setLoading(true);
        setLoadingMsg("Updating visualization...");
        try {
          const refinedImage = await editDesign(reimaginedImage, text);
          setReimaginedImage(refinedImage);
          
          setMessages(prev => [...prev, {
            role: 'model',
            text: `I've updated the room for you! Does this look like what you had in mind?`,
            timestamp: Date.now()
          }]);
        } catch (e) {
          console.error("Image edit failed", e);
          setMessages(prev => [...prev, {
            role: 'model',
            text: "I tried to update the image but encountered an error. However, I've noted your preference!",
            timestamp: Date.now()
          }]);
        } finally {
          setLoading(false);
        }
      }
    } catch (error) {
      console.error(error);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="min-h-screen pb-20">
      <header className="bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-200">
              D
            </div>
            <h1 className="text-xl font-serif text-gray-900 tracking-tight">DreamSpace <span className="text-indigo-600">AI</span></h1>
          </div>
          <label className="cursor-pointer bg-gray-900 text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-gray-800 transition-colors shadow-lg shadow-gray-200">
            Upload Photo
            <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
          </label>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 mt-8">
        {!originalImage ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-24 h-24 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 mb-6">
              <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="text-3xl font-serif text-gray-900 mb-3">Reimagine Your Space</h2>
            <p className="text-gray-500 max-w-md mx-auto mb-8">
              Choose from over 100 styles. From Scandinavian to Cyberpunk, transform your room instantly.
            </p>
            <label className="cursor-pointer bg-indigo-600 text-white px-8 py-4 rounded-full text-lg font-semibold hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 flex items-center gap-3">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Start Your Makeover
              <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
            </label>
          </div>
        ) : (
          <div className="space-y-12">
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-serif text-gray-900">Transformation</h2>
                  {reimaginedImage && (
                    <div className="text-xs text-gray-400 font-medium bg-gray-100 px-3 py-1 rounded-full uppercase tracking-widest">
                      Drag to Compare
                    </div>
                  )}
                </div>
                
                <div className="relative group">
                  {reimaginedImage ? (
                    <ComparisonSlider original={originalImage} reimagined={reimaginedImage} />
                  ) : (
                    <div className="relative aspect-video md:aspect-[16/9] rounded-2xl overflow-hidden shadow-xl bg-gray-100">
                      <img src={originalImage} alt="Room" className="w-full h-full object-cover" />
                    </div>
                  )}
                  {loading && (
                    <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-10 flex flex-col items-center justify-center transition-all rounded-2xl">
                      <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                      <p className="text-indigo-900 font-medium animate-pulse">{loadingMsg}</p>
                    </div>
                  )}
                </div>

                {/* Style Explorer */}
                <div className="space-y-6 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-widest">Explore 100+ Styles</h3>
                    <input 
                      type="text" 
                      placeholder="Search styles..." 
                      className="text-sm border border-gray-200 rounded-full px-4 py-2 w-full md:w-64 focus:ring-2 focus:ring-indigo-500 outline-none"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>

                  {/* Categories */}
                  <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                    {categories.map(cat => (
                      <button
                        key={cat}
                        onClick={() => setActiveCategory(cat)}
                        className={`px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${activeCategory === cat ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>

                  {/* Styles Grid/Carousel */}
                  <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
                    {filteredStyles.length > 0 ? filteredStyles.map((style) => (
                      <button
                        key={style.id}
                        onClick={() => handleStyleSelect(style)}
                        disabled={loading}
                        className={`flex-shrink-0 w-40 group text-left transition-all ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <div className={`relative aspect-[4/3] rounded-xl overflow-hidden mb-2 transition-all ring-offset-2 ${selectedStyle?.id === style.id ? 'ring-2 ring-indigo-600' : 'hover:scale-[1.02]'}`}>
                          <img src={style.thumbnail} alt={style.name} className="w-full h-full object-cover grayscale-[0.2] group-hover:grayscale-0" />
                          <div className={`absolute inset-0 transition-all ${selectedStyle?.id === style.id ? 'bg-indigo-600/20' : 'bg-black/10 group-hover:bg-black/0'}`}></div>
                        </div>
                        <p className={`text-sm font-semibold truncate ${selectedStyle?.id === style.id ? 'text-indigo-600' : 'text-gray-800'}`}>{style.name}</p>
                        <p className="text-[10px] text-gray-500 line-clamp-1">{style.description}</p>
                      </button>
                    )) : (
                      <div className="py-10 text-center w-full text-gray-400 text-sm">
                        No styles matching your search.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="lg:col-span-1">
                <div className="sticky top-24">
                  <div className="mb-6">
                    <h2 className="text-2xl font-serif text-gray-900 mb-2">Design Advice</h2>
                    <p className="text-sm text-gray-500">Your AI consultant is ready. Ask for tweaks or product links.</p>
                  </div>
                  <ChatInterface 
                    messages={messages} 
                    onSendMessage={handleSendMessage} 
                    isLoading={chatLoading} 
                  />
                </div>
              </div>
            </section>
          </div>
        )}
      </main>

      <footer className="mt-20 border-t border-gray-100 pt-12 text-center text-gray-400 text-sm">
        <p>&copy; {new Date().getFullYear()} DreamSpace AI. Driven by Gemini Generative AI.</p>
      </footer>
    </div>
  );
};

export default App;
