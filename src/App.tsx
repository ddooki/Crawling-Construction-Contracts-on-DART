import React, { useState, useEffect } from 'react';
import { Activity, Bell, Building2, Code2, Database, ExternalLink, Mail, Zap, Terminal, CheckCircle2, Calendar, FileText, Send, X, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [companies, setCompanies] = useState<string[]>([]);
  const [disclosures, setDisclosures] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [status, setStatus] = useState<any>({});
  
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
  
  const [isLoading, setIsLoading] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [isSending, setIsSending] = useState(false);

  const fetchDisclosures = async () => {
    setIsLoading(true);
    setLoadProgress(0);
    // Fake progress interval
    const progressInterval = setInterval(() => {
      setLoadProgress((prev) => {
        if (prev < 90) return prev + 5;
        return prev;
      });
    }, 150);

    try {
      const res = await fetch(`/api/disclosures?start=${startDate}&end=${endDate}&company=all`);
      const data = await res.json();
      setDisclosures(data);
    } catch (err) {
      console.error(err);
    } finally {
      clearInterval(progressInterval);
      setLoadProgress(100);
      setTimeout(() => setLoadProgress(0), 1000); // fade out after completion
      setIsLoading(false);
    }
  };

  const filteredDisclosures = selectedCompany 
    ? disclosures.filter(d => d.company === selectedCompany) 
    : disclosures;

  const fetchHistory = async () => {
    const res = await fetch('/api/history');
    const data = await res.json();
    setHistory(data);
  };

  useEffect(() => {
    fetch('/api/status').then(res => res.json()).then(setStatus);
    fetch('/api/companies').then(res => res.json()).then(setCompanies);
    fetchHistory();
    fetchDisclosures();
  }, []);

  const handleSendReport = async () => {
    setIsSending(true);
    try {
      await fetch('/api/send-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailInput,
          company: selectedCompany,
          disclosures: filteredDisclosures
        })
      });
      await fetchHistory();
      setShowModal(false);
      setShowConfirm(false);
      alert('보고서가 이메일로 발송되었습니다.');
    } catch (err) {
      alert('발송 실패');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#0A0A0C] border border-[#1F2937] overflow-hidden font-sans relative">
      {/* Header */}
      <header className="h-20 border-b border-[#1F2937] px-10 flex items-center justify-between bg-[#111827]/50">
        <div className="flex items-center gap-4">
          <div className="w-4 h-4 rounded-full bg-cyan-500 shadow-[0_0_12px_#06b6d4]"></div>
          <h1 className="text-xl font-bold tracking-[0.2em] text-white uppercase">
            DART 건설 공시 모니터링 시스템
          </h1>
        </div>
        <div className="flex gap-10 text-base uppercase tracking-wider items-center">
          <div className="flex items-center bg-cyan-950/40 p-2 px-6 rounded-full border border-cyan-500/30 gap-4">
            <span className="flex items-center gap-2 text-cyan-400 text-sm font-bold shrink-0">
              <Calendar className="w-5 h-5" /> 조회 기간:
            </span>
            <div className="flex items-center gap-3">
              <input 
                type="date" 
                value={startDate} 
                max="9999-12-31"
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent border-none text-white text-base outline-none cursor-pointer font-bold focus:text-cyan-400 transition-colors w-[140px]"
              />
              <span className="text-cyan-600 font-bold px-1">~</span>
              <input 
                type="date" 
                value={endDate} 
                max="9999-12-31"
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent border-none text-white text-base outline-none cursor-pointer font-bold focus:text-cyan-400 transition-colors w-[140px]"
              />
            </div>
          </div>
          <span className="text-white px-4 py-2 bg-cyan-900/40 rounded border border-cyan-800/50 font-bold shrink-0">
            {status.version || 'Ver. 1.0.0'}
          </span>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-[380px] border-r border-[#1F2937] p-8 flex flex-col bg-[#0F172A]/30">
          <div className="mb-0 overflow-hidden flex flex-col flex-1">
            <div className="flex justify-between items-center mb-6">
              <p className="text-sm text-slate-400 uppercase tracking-widest font-bold flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                모니터링 건설사 ({companies.length})
              </p>
            </div>
            <div className="space-y-3 overflow-y-auto pr-3 custom-scrollbar flex-1">
              {/* 전체 항목 추가 */}
              <div 
                onClick={() => setSelectedCompany(null)}
                className={`flex justify-between py-3.5 border-b border-cyan-500/30 items-center group cursor-pointer transition-all px-3 rounded-lg ${!selectedCompany ? 'bg-cyan-500/20' : 'hover:bg-white/5'}`}
              >
                <span className={`text-lg transition-colors uppercase ${!selectedCompany ? 'text-cyan-400 font-bold' : 'group-hover:text-cyan-400'}`}>
                  전체보기
                </span>
                <span className={`text-xs font-bold tracking-tight ${!selectedCompany ? 'text-cyan-600' : 'text-slate-600'}`}>
                  ALL
                </span>
              </div>

              {companies.map((name, i) => (
                <div 
                  key={i} 
                  onClick={() => setSelectedCompany(name)}
                  className={`flex justify-between py-3.5 border-b border-white/5 items-center group cursor-pointer transition-all px-3 rounded-lg ${selectedCompany === name ? 'bg-cyan-500/15' : 'hover:bg-white/5'}`}
                >
                  <span className={`text-lg transition-colors uppercase ${selectedCompany === name ? 'text-cyan-400 font-bold' : 'group-hover:text-cyan-400'}`}>
                    {name}
                  </span>
                  <span className={`text-xs font-bold tracking-tight ${selectedCompany === name ? 'text-cyan-600' : 'text-slate-600'}`}>
                    {100000 + i * 231}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Top Section */}
          <section className="p-10 bg-gradient-to-br from-[#0F172A] to-transparent border-b border-[#1F2937]">
            <div className="flex justify-between items-end mb-4">
              <div className="flex flex-col gap-3">
                <h2 className="text-5xl font-serif font-light text-white italic">
                  현황 <span className="text-cyan-500 not-italic">대시보드</span>
                </h2>
                <div className="flex items-center gap-3 text-slate-400 text-base">
                   필터: <span className="text-cyan-400 font-bold">{selectedCompany || '전체 건설사'}</span> 
                   &nbsp;|&nbsp; 
                   기간: <span className="text-white font-medium">{startDate} ~ {endDate}</span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-3">
                {/* Small Status Indicator */}
                <div className="flex items-center gap-4 text-xs font-bold uppercase tracking-widest text-slate-400 bg-cyan-950/20 px-4 py-2.5 rounded-lg border border-cyan-500/10">
                  <div className="flex items-center gap-2">
                    <span className="text-cyan-400 text-sm">{filteredDisclosures.length}건</span>의 추출 데이터
                  </div>
                  <div className="w-1 h-1 rounded-full bg-slate-600" />
                  <div className="flex items-center gap-2 text-cyan-600">
                    <CheckCircle2 className="w-3.5 h-3.5 text-cyan-500" /> API 연동 됨
                  </div>
                </div>

                <div className="flex gap-4">
                  <button 
                    onClick={() => fetchDisclosures()}
                    disabled={isLoading}
                    className="flex items-center gap-3 bg-white/5 hover:bg-white/10 text-white font-bold py-4 px-6 rounded-xl border border-white/10 transition-all active:scale-95 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Zap className={isLoading ? "w-5 h-5 text-cyan-400 animate-pulse" : "w-5 h-5 text-cyan-400"} />
                    {isLoading ? "데이터 연동 중..." : "데이터 갱신"}
                  </button>
                  <button 
                    onClick={() => setShowHistoryModal(true)}
                    className="flex items-center gap-3 bg-white/5 hover:bg-white/10 text-white font-bold py-4 px-6 rounded-xl border border-white/10 transition-all active:scale-95 text-lg"
                  >
                    <Database className="w-5 h-5 text-cyan-400" />
                    발송 이력
                  </button>
                  <button 
                    onClick={() => setShowModal(true)}
                    className="flex items-center gap-3 bg-cyan-500 hover:bg-cyan-400 text-black font-bold py-4 px-8 rounded-xl transition-all active:scale-95 shadow-[0_0_20px_rgba(6,182,212,0.4)] text-lg"
                  >
                    <Send className="w-5 h-5" />
                    보고서 발송
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Bottom Section: Result Queue */}
          <section className="flex-1 p-10 overflow-y-auto custom-scrollbar">
            <p className="text-sm text-slate-500 uppercase tracking-widest mb-8 font-bold flex items-center gap-2">
              <FileText className="w-5 h-5" />
              검색 결과 공시 목록 (단일판매·공급계약체결 관련)
            </p>
            <div className="space-y-6">
              {filteredDisclosures.length > 0 ? (
                <motion.div 
                  key={selectedCompany || 'all'}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.15 }}
                  className="space-y-6"
                >
                  {filteredDisclosures.map((item, i) => (
                    <div 
                      key={item.id} 
                      className="flex items-center gap-10 p-6 bg-white/[0.04] border border-white/10 rounded-2xl hover:bg-white/[0.07] transition-all group"
                    >
                      <div className="w-[72px] h-[72px] rounded-full border-2 border-cyan-500/30 flex flex-col items-center justify-center text-cyan-400 group-hover:border-cyan-500 group-hover:bg-cyan-500/10 transition-all shrink-0 shadow-inner">
                        <div className="flex flex-col items-center justify-center -mt-0.5">
                          <span className="text-[11px] font-bold text-cyan-600 leading-none mb-1">{item.date.split('-')[0]}</span>
                          <span className="text-[22px] font-black tracking-tight leading-none">{item.date.split('-').slice(1).join('/')}</span>
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-4 mb-2">
                          <h3 className="text-xl font-bold text-white leading-none">
                            {item.company}
                          </h3>
                          <span className="text-xs bg-cyan-900/40 text-cyan-400 px-3 py-1 rounded-full border border-cyan-500/30 uppercase font-bold tracking-wide">
                            {item.title}
                          </span>
                        </div>
                        <p className="text-base text-slate-300 leading-relaxed">
                          {item.description}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold text-slate-600 block mb-2 uppercase tracking-widest">DART LINK</span>
                        <a 
                          href={`https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${item.rcept_no}`} 
                          target="_blank" 
                          rel="noreferrer"
                          className="text-base text-cyan-400 font-bold hover:text-cyan-300 flex items-center gap-1.5 justify-end group/link"
                        >
                          원문보기 <ExternalLink className="w-4 h-4 group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5 transition-transform" />
                        </a>
                      </div>
                    </div>
                  ))}
                </motion.div>
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-slate-600 border border-dashed border-white/10 rounded-2xl bg-white/[0.01]">
                  <AlertCircle className="w-12 h-12 mb-6 opacity-20" />
                  <p className="text-lg mb-2">해당 조건에 맞는 공시 데이터가 존재하지 않습니다.</p>
                  <p className="text-slate-500">우측 상단의 <strong className="text-cyan-500">데이터 갱신</strong> 버튼을 눌러 데이터를 불러오세요.</p>
                </div>
              )}
            </div>
          </section>
        </main>
      </div>

      {/* HISTORY MODAL */}
      <AnimatePresence>
        {showHistoryModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowHistoryModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-2xl bg-[#111827] border border-[#1F2937] rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-10">
                <div className="flex justify-between items-center mb-8">
                  <h3 className="text-2xl font-bold text-white flex items-center gap-3">
                    <Database className="w-6 h-6 text-cyan-400" />
                    메일 발송 이력 확인
                  </h3>
                  <button onClick={() => setShowHistoryModal(false)} className="text-slate-500 hover:text-white transition-colors">
                    <X className="w-8 h-8" />
                  </button>
                </div>

                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-4 custom-scrollbar">
                  {history.length > 0 ? history.map((item) => (
                    <div key={item.id} className="p-6 bg-white/[0.03] border border-white/5 rounded-2xl">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <span className="text-xs text-cyan-500 font-bold uppercase tracking-widest block mb-1">건설사 / 발송 일시</span>
                          <h4 className="text-lg font-bold text-white">{item.company}</h4>
                        </div>
                        <span className="bg-cyan-500/10 text-cyan-400 text-xs px-3 py-1 rounded-full border border-cyan-500/20 font-bold">SENT SUCCESS</span>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-slate-500 block mb-1">수신 이메일</span>
                          <span className="text-slate-300 font-medium">{item.email}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-slate-500 block mb-1">발송 시각</span>
                          <span className="text-slate-300 font-medium">{item.date}</span>
                        </div>
                      </div>
                    </div>
                  )) : (
                    <div className="text-center py-20 text-slate-500 italic">
                      발송된 리포트 이력이 존재하지 않습니다.
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* SEND REPORT MODAL */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !showConfirm && setShowModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-lg bg-[#111827] border border-[#1F2937] rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-10">
                <div className="flex justify-between items-center mb-8">
                  <h3 className="text-2xl font-bold text-white flex items-center gap-3">
                    <FileText className="w-6 h-6 text-cyan-400" />
                    보고서 이메일 발송
                  </h3>
                  {!showConfirm && (
                    <button onClick={() => setShowModal(false)} className="text-slate-500 hover:text-white transition-colors">
                      <X className="w-8 h-8" />
                    </button>
                  )}
                </div>

                {!showConfirm ? (
                  <div className="space-y-8">
                    <div className="p-6 bg-cyan-500/5 border border-cyan-500/20 rounded-2xl">
                      <p className="text-sm text-cyan-500 uppercase font-bold mb-3 tracking-widest font-mono">발송 내용 요약 (Report Summary)</p>
                      <div className="space-y-2 text-base text-slate-300">
                        <div className="flex justify-between border-b border-white/5 pb-2">
                          <span className="text-slate-500">필터 대상</span>
                          <span className="text-white font-bold">{selectedCompany || '전체 건설사'}</span>
                        </div>
                        <div className="flex justify-between border-b border-white/5 pb-2">
                          <span className="text-slate-500">조회 기간</span>
                          <span className="text-white font-bold">{startDate} ~ {endDate}</span>
                        </div>
                        <div className="flex justify-between pt-1">
                          <span className="text-slate-500">추출 데이터</span>
                          <span className="text-cyan-400 font-bold underline decoration-cyan-500/30 underline-offset-4">{filteredDisclosures.length}건의 공시</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm text-slate-400 uppercase font-bold mb-3 tracking-widest">수신 이메일 주소</label>
                      <input 
                        type="email" 
                        placeholder="example@email.com"
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        className="w-full bg-black/50 border border-white/10 rounded-2xl p-5 text-xl text-white outline-none focus:border-cyan-500 transition-all shadow-inner"
                      />
                    </div>

                    <button 
                      disabled={!emailInput || filteredDisclosures.length === 0}
                      onClick={() => setShowConfirm(true)}
                      className="w-full bg-cyan-500 disabled:opacity-20 disabled:cursor-not-allowed hover:bg-cyan-400 text-black font-bold py-5 rounded-2xl transition-all text-xl shadow-[0_0_20px_rgba(6,182,212,0.3)]"
                    >
                      발송 확인 단계로
                    </button>
                  </div>
                ) : (
                  <div className="text-center space-y-8 py-4">
                    <div className="w-20 h-20 bg-cyan-500/20 text-cyan-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(6,182,212,0.2)] animate-pulse">
                      <Send className="w-10 h-10" />
                    </div>
                    <h4 className="text-3xl font-bold text-white leading-tight">이메일을 보내시겠습니까?</h4>
                    <p className="text-lg text-slate-400 leading-relaxed">
                      입력하신 <span className="text-cyan-400 font-bold underline decoration-cyan-400/30 underline-offset-4">{emailInput}</span> 주소로<br/>
                      <span className="text-white font-medium">검색된 수주 보고서 요약본</span>이 즉시 발송됩니다.
                    </p>
                    <div className="flex gap-4">
                      <button 
                        onClick={() => setShowConfirm(false)}
                        className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-bold py-5 rounded-2xl text-lg transition-colors border border-white/5"
                      >
                        취소하기
                      </button>
                      <button 
                        disabled={isSending}
                        onClick={handleSendReport}
                        className="flex-1 bg-cyan-500 hover:bg-cyan-400 text-black font-bold py-5 rounded-2xl flex items-center justify-center gap-3 text-lg shadow-[0_0_20px_rgba(6,182,212,0.4)] transition-all"
                      >
                        {isSending ? (
                          <>
                            <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                             보내는 중...
                          </>
                        ) : '확인, 발송합니다'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Loading Progress Bar */}
      <div 
        className="fixed bottom-6 left-6 w-64 bg-slate-900/90 backdrop-blur-sm p-4 rounded-xl border border-slate-700 shadow-2xl z-[100] transition-all duration-500"
        style={{ 
          opacity: loadProgress > 0 && loadProgress < 100 ? 1 : 0,
          transform: loadProgress > 0 && loadProgress < 100 ? 'translateY(0)' : 'translateY(20px)',
          pointerEvents: loadProgress > 0 && loadProgress < 100 ? 'auto' : 'none'
        }}
      >
        <div className="flex justify-between items-center text-xs text-slate-400 mb-2.5 font-bold tracking-wide">
          <span className="flex items-center gap-2">
            <Zap className="w-3 h-3 text-cyan-400 animate-pulse" />
            데이터 연동 중...
          </span>
          <span className="text-cyan-400">{Math.floor(loadProgress)}%</span>
        </div>
        <div className="w-full bg-slate-800 rounded-full h-1 overflow-hidden">
          <div 
            className="bg-cyan-400 h-full transition-all duration-300 ease-out" 
            style={{ width: `${loadProgress}%` }} 
          />
        </div>
      </div>
    </div>
  );
}
