import React, { useState, useEffect } from 'react';

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
      const res = await fetch(`/api/disclosures?start=${startDate}&end=${endDate}&company=${selectedCompany || 'all'}`);
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
    try {
      const res = await fetch('/api/history');
      const data = await res.json();
      setHistory(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetch('/api/status')
      .then(res => res.json())
      .then(setStatus)
      .catch(console.error);

    fetch('/api/companies')
      .then(res => res.json())
      .then(setCompanies)
      .catch(console.error);

    fetchHistory();
  }, []);

  // Fetch disclosures whenever date filters change (or when requested)
  useEffect(() => {
    fetchDisclosures();
  }, [selectedCompany, startDate, endDate]);

  const handleSendReport = async () => {
    setIsSending(true);
    try {
      const res = await fetch('/api/send-report', {
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
    <div className="flex bg-[#F1F5F9] min-h-screen text-on-background font-sans relative overflow-x-hidden">
      {/* Sidebar Navigation */}
      <aside className="flex flex-col h-screen fixed left-0 top-0 w-sidebar-width z-40 bg-primary shadow-md">
        <div className="py-gutter px-4 flex flex-col items-center">
          <h1 className="text-headline-md font-headline-md text-on-primary text-center whitespace-nowrap mt-4">
            주요 건설사 수주 현황
          </h1>
        </div>
        
        <nav className="flex-1 px-4 mt-4 overflow-y-auto custom-scrollbar space-y-1">
          {/* 전체 보기 */}
          <div 
            onClick={() => setSelectedCompany(null)}
            className={`flex items-center gap-3 px-4 py-3 cursor-pointer duration-200 rounded-lg group ${!selectedCompany ? 'sidebar-active' : 'text-on-primary/70 hover:text-white hover:bg-white/5'}`}
          >
            <span className="material-symbols-outlined">dashboard</span>
            <span className="text-body-md font-body-md font-semibold">전체 보기</span>
          </div>

          {/* 기업 목록 */}
          {companies.map((name, idx) => (
            <div 
              key={idx}
              onClick={() => setSelectedCompany(name)}
              className={`flex items-center gap-3 px-4 py-3 cursor-pointer duration-200 rounded-lg group ${selectedCompany === name ? 'sidebar-active' : 'text-on-primary/70 hover:text-white hover:bg-white/5'}`}
            >
              <span className="material-symbols-outlined text-sm">corporate_fare</span>
              <span className="text-body-md font-body-md">{name}</span>
            </div>
          ))}

          {/* 신규 건설사 추가 (데모용 디자인) */}
          <div className="mt-8 px-2">
            <button 
              onClick={() => alert("설정된 수집 대상 건설사 외 추가 기능은 추후 업데이트 예정입니다.")}
              className="w-full py-2 bg-secondary text-white text-body-md font-semibold rounded-lg hover:opacity-90 transition-all flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              신규 건설사 추가
            </button>
          </div>
        </nav>

        <div className="p-4 border-t border-white/10">
          <div 
            onClick={() => alert("설정 메뉴는 준비 중입니다.")}
            className="flex items-center gap-3 px-4 py-3 text-on-primary/70 hover:text-white hover:bg-white/5 cursor-pointer duration-200 rounded-lg"
          >
            <span className="material-symbols-outlined">settings</span>
            <span className="text-body-md font-body-md">설정</span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="ml-sidebar-width min-h-screen flex flex-col flex-1">
        {/* Top Navigation Bar */}
        <header className="flex justify-between items-center w-[calc(100%-var(--spacing-sidebar-width))] px-gutter h-16 fixed top-0 right-0 z-30 bg-surface-container-lowest border-b border-outline-variant">
          <div className="flex items-center gap-8">
            <span className="text-title-lg font-title-lg font-bold text-primary">DART 건설 공시 모니터링 시스템</span>
            
            {/* 조회 기간 */}
            <div className="flex items-center gap-4 bg-surface-container-low px-4 py-1.5 rounded-lg border border-outline-variant/30">
              <label className="text-label-bold font-label-bold text-on-surface-variant flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">calendar_month</span> 조회 기간
              </label>
              <div className="flex items-center gap-2">
                <input 
                  type="date" 
                  value={startDate} 
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-transparent border-none text-body-sm p-0 focus:ring-0 text-on-surface cursor-pointer font-semibold outline-none"
                />
                <span className="text-outline">~</span>
                <input 
                  type="date" 
                  value={endDate} 
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-transparent border-none text-body-sm p-0 focus:ring-0 text-on-surface cursor-pointer font-semibold outline-none"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-body-sm font-semibold text-outline">
              {status.version || 'Ver. 1.0.0'}
            </span>
            <div className="flex gap-2">
              <button className="p-2 hover:bg-surface-container-low transition-colors rounded-full cursor-pointer">
                <span className="material-symbols-outlined text-on-surface-variant">notifications</span>
              </button>
              <button 
                onClick={() => alert("설정 메뉴는 준비 중입니다.")}
                className="p-2 hover:bg-surface-container-low transition-colors rounded-full cursor-pointer"
              >
                <span className="material-symbols-outlined text-on-surface-variant">settings</span>
              </button>
            </div>
            <div className="w-8 h-8 rounded-full bg-surface-dim overflow-hidden ml-2 border border-outline-variant">
              <img 
                className="object-cover w-full h-full" 
                alt="Profile" 
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuBHyUnOfkJl8-jNrR6WbWywSNLTMAYtSjoeJDKLOF9r9L1tvJImoq3luu40WBh8qf1f6pve04XBhF6QKlWj4i0QMnV-ThquUZ8Q3S8VcyVMYjAxCvWcUiElf8zv9PND_5a-Jidn6hTY0ltiFk_bvWF6evbovbjkgd6lE5roxt4KETpOziefjtlStZwF4osOw1ibXRXOz01STwxDkElE0nLT7P8GC6ZOfcp-Uezru3ypltGttDN2IovPMcNPHDmdGQO4dMlhzv8_3gI"
              />
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <div className="mt-16 p-gutter flex-1 flex flex-col">
          {/* Action Header */}
          <div className="flex justify-between items-end mb-8 mt-4">
            <div>
              <h2 className="text-headline-md font-headline-md text-primary mb-1">현황 대시보드</h2>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 text-label-bold font-semibold text-secondary">
                  <span className="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
                  실시간 모니터링 중
                </span>
                <span className="text-body-sm text-on-surface-variant">
                  | 필터: <strong className="text-secondary">{selectedCompany || '전체 건설사'}</strong>
                </span>
              </div>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => fetchDisclosures()}
                disabled={isLoading}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-secondary text-secondary rounded-lg font-semibold hover:bg-secondary/5 transition-all disabled:opacity-50"
              >
                <span className={`material-symbols-outlined text-[18px] ${isLoading ? 'animate-spin' : ''}`}>sync</span>
                {isLoading ? '데이터 갱신 중' : '데이터 갱신'}
              </button>
              <button 
                onClick={() => setShowHistoryModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-secondary text-secondary rounded-lg font-semibold hover:bg-secondary/5 transition-all"
              >
                <span className="material-symbols-outlined text-[18px]">history</span>
                발송 이력
              </button>
              <button 
                onClick={() => {
                  if (filteredDisclosures.length === 0) {
                    alert('발송할 공시 데이터가 없습니다.');
                    return;
                  }
                  setShowModal(true);
                }}
                className="flex items-center gap-2 px-6 py-2 bg-secondary text-white rounded-lg font-semibold hover:opacity-90 shadow-sm transition-all"
              >
                <span className="material-symbols-outlined text-[18px]">send</span>
                보고서 발송
              </button>
            </div>
          </div>

          {/* Bento Grid Stats Section */}
          <div className="grid grid-cols-12 gap-gutter mb-gutter">
            {/* Summary Card */}
            <div className="col-span-12 md:col-span-4 bg-white p-card-padding rounded-xl border border-outline-variant flex flex-col justify-between shadow-sm">
              <div>
                <p className="text-label-bold font-bold text-on-surface-variant uppercase mb-2">검색 결과 공시</p>
                <h3 className="text-display-lg font-bold text-primary">
                  {filteredDisclosures.length}
                  <span className="text-title-lg ml-1 font-bold">건</span>
                </h3>
              </div>
              <div className="mt-4 flex items-center gap-2 text-secondary">
                <span className="material-symbols-outlined">trending_up</span>
                <span className="text-body-sm font-bold">
                  {selectedCompany ? `${selectedCompany} 맞춤 필터 적용` : '전체 건설사 데이터 수집'}
                </span>
              </div>
            </div>

            {/* Quick Stats Cards */}
            <div className="col-span-12 md:col-span-8 grid grid-cols-1 md:grid-cols-3 gap-gutter">
              <div className="bg-white p-card-padding rounded-xl border border-outline-variant shadow-sm flex flex-col justify-between">
                <p className="text-label-bold font-bold text-on-surface-variant mb-2">모니터링 건설사</p>
                <div className="flex items-center justify-between">
                  <span className="text-display-lg font-bold text-on-surface">{companies.length}</span>
                  <span className="p-2 bg-surface-container rounded-lg text-secondary">
                    <span className="material-symbols-outlined">corporate_fare</span>
                  </span>
                </div>
              </div>
              
              <div className="bg-white p-card-padding rounded-xl border border-outline-variant shadow-sm flex flex-col justify-between">
                <p className="text-label-bold font-bold text-on-surface-variant mb-2">발송 완료 리포트</p>
                <div className="flex items-center justify-between">
                  <span className="text-display-lg font-bold text-on-surface">{history.length}</span>
                  <span className="p-2 bg-secondary-container rounded-lg text-secondary">
                    <span className="material-symbols-outlined">description</span>
                  </span>
                </div>
              </div>

              <div className="bg-white p-card-padding rounded-xl border border-outline-variant shadow-sm flex flex-col justify-between">
                <p className="text-label-bold font-bold text-on-surface-variant mb-2">최종 업데이트 버전</p>
                <div className="flex items-center justify-between">
                  <span className="text-display-lg font-bold text-secondary">1.0</span>
                  <span className="p-2 bg-surface-container rounded-lg text-secondary">
                    <span className="material-symbols-outlined">verified</span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Content Area: Search Result Table Card */}
          <div className="bg-white rounded-xl border border-outline-variant overflow-hidden shadow-sm flex-1 flex flex-col">
            <div className="px-gutter py-4 border-b border-outline-variant flex justify-between items-center bg-surface-bright">
              <h3 className="text-title-lg font-title-lg text-primary">검색 결과 공시 목록</h3>
              <div className="flex gap-4">
                <div className="flex items-center gap-2 text-body-sm font-semibold text-on-surface-variant">
                  <span className="w-2 h-2 rounded-full bg-outline"></span>
                  전체 {filteredDisclosures.length}건
                </div>
              </div>
            </div>
            
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low/30 border-b border-outline-variant">
                    <th className="px-gutter py-4 text-label-bold font-bold text-on-surface-variant uppercase tracking-wider">공시 일자</th>
                    <th className="px-gutter py-4 text-label-bold font-bold text-on-surface-variant uppercase tracking-wider">기업명</th>
                    <th className="px-gutter py-4 text-label-bold font-bold text-on-surface-variant uppercase tracking-wider">공시 제목</th>
                    <th className="px-gutter py-4 text-label-bold font-bold text-on-surface-variant uppercase tracking-wider">주요 내용</th>
                    <th className="px-gutter py-4 text-label-bold font-bold text-on-surface-variant uppercase tracking-wider text-right">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/30">
                  {filteredDisclosures.length > 0 ? (
                    filteredDisclosures.map((item) => (
                      <tr key={item.id} className="hover:bg-surface-container-low transition-colors group">
                        <td className="px-gutter py-5 whitespace-nowrap">
                          <span className="text-body-md font-semibold text-on-surface">{item.date}</span>
                        </td>
                        <td className="px-gutter py-5 whitespace-nowrap">
                          <span className="px-3 py-1 bg-surface-container rounded-full text-label-bold font-bold text-primary">
                            {item.company}
                          </span>
                        </td>
                        <td className="px-gutter py-5">
                          <div className="flex flex-col">
                            <span className="text-body-md font-bold text-on-surface group-hover:text-secondary transition-colors line-clamp-2">
                              {item.title}
                            </span>
                          </div>
                        </td>
                        <td className="px-gutter py-5">
                          <p className="text-body-md text-on-surface-variant line-clamp-1">
                            {item.description}
                          </p>
                        </td>
                        <td className="px-gutter py-5 text-right whitespace-nowrap">
                          <a 
                            className="inline-flex items-center gap-1 text-label-bold font-bold text-secondary hover:underline" 
                            href={`https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${item.rcept_no}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            원문보기
                            <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                          </a>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-20 text-center text-on-surface-variant">
                        <div className="flex flex-col items-center justify-center">
                          <span className="material-symbols-outlined text-5xl text-outline mb-2">info</span>
                          <p className="text-body-md font-semibold">해당 조건에 맞는 공시 데이터가 존재하지 않습니다.</p>
                          <p className="text-body-sm text-outline mt-1">상단의 데이터 갱신 버튼을 눌러보거나 조회 기간을 늘려주세요.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination / Summary footer */}
            <div className="px-gutter py-4 border-t border-outline-variant flex items-center justify-between">
              <span className="text-body-sm text-on-surface-variant">
                조회된 결과: {filteredDisclosures.length}건
              </span>
            </div>
          </div>
        </div>

        {/* Floating Action Component */}
        <div className="fixed bottom-8 right-8 z-40">
          <button 
            onClick={() => alert("AI 리포트 분석 기능은 준비 중입니다.")}
            className="w-14 h-14 bg-secondary text-white rounded-full shadow-lg flex items-center justify-center hover:scale-105 transition-transform active:scale-95 group relative"
          >
            <span className="material-symbols-outlined">analytics</span>
            <div className="absolute right-16 bg-primary text-white text-body-sm py-2 px-4 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              AI 리포트 분석
            </div>
          </button>
        </div>

        <footer className="mt-auto px-gutter py-6 text-center border-t border-outline-variant bg-white">
          <p className="text-body-sm text-outline">
            © 2026 DART Monitoring System. All rights reserved. 본 서비스에서 제공하는 공시 정보는 투자 참고용이며, 정확한 정보는 금융감독원 DART 시스템을 확인하시기 바랍니다.
          </p>
        </footer>
      </main>

      {/* HISTORY MODAL */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowHistoryModal(false)} />
          <div className="relative w-full max-w-2xl bg-white border border-outline-variant rounded-xl shadow-2xl overflow-hidden z-10">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6 border-b pb-4">
                <h3 className="text-title-lg font-bold text-primary flex items-center gap-2">
                  <span className="material-symbols-outlined">history</span>
                  메일 발송 이력 확인
                </h3>
                <button onClick={() => setShowHistoryModal(false)} className="text-outline hover:text-on-surface">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {history.length > 0 ? (
                  history.map((item) => (
                    <div key={item.id} className="p-4 bg-surface-container-low border border-outline-variant/50 rounded-lg">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className="text-xs text-secondary font-bold block mb-1">건설사 필터</span>
                          <h4 className="text-body-md font-bold text-primary">{item.company}</h4>
                        </div>
                        <span className="bg-secondary-container text-secondary text-xs px-2.5 py-1 rounded-full font-bold">
                          SENT SUCCESS
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-body-sm text-on-surface-variant">
                        <div>
                          <span className="text-outline text-xs block">수신 이메일</span>
                          <span className="font-semibold text-on-surface">{item.email}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-outline text-xs block">발송 시각</span>
                          <span className="font-semibold text-on-surface">{item.date}</span>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-10 text-outline italic">
                    발송된 리포트 이력이 존재하지 않습니다.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SEND REPORT MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !showConfirm && setShowModal(false)} />
          <div className="relative w-full max-w-lg bg-white border border-outline-variant rounded-xl shadow-2xl overflow-hidden z-10">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6 border-b pb-4">
                <h3 className="text-title-lg font-bold text-primary flex items-center gap-2">
                  <span className="material-symbols-outlined">send</span>
                  보고서 이메일 발송
                </h3>
                {!showConfirm && (
                  <button onClick={() => setShowModal(false)} className="text-outline hover:text-on-surface">
                    <span className="material-symbols-outlined">close</span>
                  </button>
                )}
              </div>

              {!showConfirm ? (
                <div className="space-y-6">
                  <div className="p-4 bg-surface-container-low border border-outline-variant/50 rounded-lg">
                    <p className="text-xs text-secondary font-bold uppercase mb-2 tracking-wider">발송 내용 요약 (Summary)</p>
                    <div className="space-y-2 text-body-sm text-on-surface-variant">
                      <div className="flex justify-between border-b border-outline-variant/30 pb-1.5">
                        <span>필터 대상</span>
                        <span className="text-on-surface font-bold">{selectedCompany || '전체 건설사'}</span>
                      </div>
                      <div className="flex justify-between border-b border-outline-variant/30 pb-1.5">
                        <span>조회 기간</span>
                        <span className="text-on-surface font-bold">{startDate} ~ {endDate}</span>
                      </div>
                      <div className="flex justify-between pt-1">
                        <span>추출 데이터</span>
                        <span className="text-secondary font-bold">{filteredDisclosures.length}건의 공시</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-body-sm font-bold text-on-surface-variant mb-2">수신 이메일 주소</label>
                    <input 
                      type="email" 
                      placeholder="example@email.com"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      className="w-full bg-white border border-outline-variant rounded-lg p-3 text-body-md text-on-surface outline-none focus:border-secondary transition-all"
                    />
                  </div>

                  <button 
                    disabled={!emailInput || filteredDisclosures.length === 0}
                    onClick={() => setShowConfirm(true)}
                    className="w-full bg-secondary disabled:opacity-35 disabled:cursor-not-allowed hover:opacity-90 text-white font-bold py-3.5 rounded-lg transition-all text-body-md shadow-sm"
                  >
                    발송 확인 단계로
                  </button>
                </div>
              ) : (
                <div className="text-center space-y-6 py-2">
                  <div className="w-16 h-16 bg-secondary-container text-secondary rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                    <span className="material-symbols-outlined text-3xl">send</span>
                  </div>
                  <h4 className="text-title-lg font-bold text-primary">이메일을 보내시겠습니까?</h4>
                  <p className="text-body-sm text-on-surface-variant">
                    입력하신 <strong className="text-secondary">{emailInput}</strong> 주소로<br/>
                    검색된 수주 보고서 요약본이 즉시 발송됩니다.
                  </p>
                  <div className="flex gap-3 pt-2">
                    <button 
                      onClick={() => setShowConfirm(false)}
                      className="flex-1 bg-white hover:bg-surface-container-low text-on-surface-variant font-bold py-3 rounded-lg text-body-sm transition-colors border border-outline-variant"
                    >
                      취소하기
                    </button>
                    <button 
                      disabled={isSending}
                      onClick={handleSendReport}
                      className="flex-1 bg-secondary hover:opacity-90 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 text-body-sm shadow-sm transition-all"
                    >
                      {isSending ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          보내는 중...
                        </>
                      ) : '확인, 발송합니다'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Loading Progress Bar */}
      <div 
        className="fixed bottom-6 left-6 w-64 bg-white/95 backdrop-blur-sm p-4 rounded-xl border border-outline-variant shadow-2xl z-50 transition-all duration-500"
        style={{ 
          opacity: loadProgress > 0 && loadProgress < 100 ? 1 : 0,
          transform: loadProgress > 0 && loadProgress < 100 ? 'translateY(0)' : 'translateY(20px)',
          pointerEvents: loadProgress > 0 && loadProgress < 100 ? 'auto' : 'none'
        }}
      >
        <div className="flex justify-between items-center text-xs text-on-surface-variant mb-2 font-bold tracking-wide">
          <span className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-xs animate-spin text-secondary">sync</span>
            데이터 연동 중...
          </span>
          <span className="text-secondary">{Math.floor(loadProgress)}%</span>
        </div>
        <div className="w-full bg-surface-container rounded-full h-1 overflow-hidden">
          <div 
            className="bg-secondary h-full transition-all duration-300 ease-out" 
            style={{ width: `${loadProgress}%` }} 
          />
        </div>
      </div>
    </div>
  );
}
