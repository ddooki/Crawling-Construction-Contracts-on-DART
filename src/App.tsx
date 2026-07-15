import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Settings, 
  RefreshCw, 
  History, 
  Send, 
  Info, 
  HelpCircle, 
  CheckCircle2, 
  X, 
  ExternalLink, 
  Bell 
} from 'lucide-react';

const UNLISTED_OR_SPECIAL_COMPANIES: Record<string, string> = {
  '현대엔지니어링': '비상장사로 일반적인 상장사와 달리 주요사항보고(수주 공시) 제출 의무 범위가 다르며, 2025년 기준 계약 공시를 올리지 않았습니다.',
  '포스코이앤씨': '비상장사로 DART 수시공시(단일판매 공급계약) 대상에서 제외되거나 자체 등록하지 않았습니다.',
  '롯데건설': '비상장 기업으로 주식시장에 상장되어 있지 않아 직접 공시 의무가 없습니다.',
  '에스케이에코플랜트': '비상장 기업으로 주요 수주 공시가 대외적으로 공개 등록되지 않았습니다.',
  '호반건설': '비상장사로 수주 계약에 관한 DART 공시 의무가 존재하지 않습니다.',
  '디엘건설': '디엘이앤씨와 합병되면서 상장 폐지되었고, 독립된 수주 공시를 등록하지 않습니다.',
  '제일건설': '비상장 기업으로 대외 공시 의무가 없어 DART에서 수주 내역을 찾을 수 없습니다.',
  '대방건설': '비상장 기업으로 수주 관련 공정공시 및 주요사항 보고서를 제출하지 않습니다.',
  '중흥토건': '비상장 기업으로 수주 계약에 대한 DART 의무 공시가 없습니다.',
  '쌍용건설': '비상장사로 대외 수주 공시 의무가 없습니다.',
  '우미건설': '비상장사로 DART 수주 공시를 직접 제출하지 않는 법인입니다.'
};

// Korean grammatical postposition helper (은/는)
const getTopicMarker = (word: string) => {
  if (!word) return '';
  const lastChar = word.charCodeAt(word.length - 1);
  if (lastChar >= 0xAC00 && lastChar <= 0xD7A3) {
    const hasJongseong = (lastChar - 0xAC00) % 28 > 0;
    return hasJongseong ? '은' : '는';
  }
  return '은/는';
};

export default function App() {
  const [defaultCompanies, setDefaultCompanies] = useState<string[]>([
    '삼성물산', '현대건설', '대우건설', '디엘이앤씨', '지에스건설',
    '현대엔지니어링', '포스코이앤씨', '롯데건설', '에스케이에코플랜트', '에이치디씨현대산업개발',
    '한화', '호반건설', '디엘건설', '두산에너빌리티', '계룡건설산업',
    '서희건설', '제일건설', '코오롱글로벌', '태영건설', '케이씨씨건설'
  ]);
  const [customCompanies, setCustomCompanies] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('custom_companies');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [disclosures, setDisclosures] = useState<any[]>([]);
  const [apiError, setApiError] = useState<string | null>(null);
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
  const [showAddCompanyModal, setShowAddCompanyModal] = useState(false);
  
  // Inputs
  const [emailInput, setEmailInput] = useState('');
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyCode, setNewCompanyCode] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Combine default and custom companies
  const companies = Array.from(new Set([...defaultCompanies, ...Object.keys(customCompanies)]));

  const fetchDisclosures = async () => {
    setIsLoading(true);
    setLoadProgress(0);
    const progressInterval = setInterval(() => {
      setLoadProgress((prev) => (prev < 90 ? prev + 5 : prev));
    }, 150);

    try {
      setApiError(null);
      const queryParams = new URLSearchParams({
        start: startDate,
        end: endDate,
        company: 'all',
        custom_companies: JSON.stringify(customCompanies)
      });
      const res = await fetch(`/api/disclosures?${queryParams.toString()}`);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'DART API 연동 중 오류가 발생했습니다.');
      }
      const data = await res.json();
      setDisclosures(data);
    } catch (err: any) {
      console.error("API Error:", err);
      setApiError(err.message || '오픈 API 연동에 실패했습니다.');
      setDisclosures([]);
    } finally {
      clearInterval(progressInterval);
      setLoadProgress(100);
      setTimeout(() => setLoadProgress(0), 1000);
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
      .then(setDefaultCompanies)
      .catch(console.error);

    fetchHistory();
  }, []);

  useEffect(() => {
    fetchDisclosures();
  }, [startDate, endDate, customCompanies]);

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

  const handleAddCompany = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanyName.trim() || !newCompanyCode.trim()) {
      alert('건설사 이름과 DART 고유번호(8자리)를 입력해 주세요.');
      return;
    }
    if (newCompanyCode.length !== 8 || isNaN(Number(newCompanyCode))) {
      alert('DART 고유번호는 8자리 숫자여야 합니다.');
      return;
    }

    const updated = { ...customCompanies, [newCompanyName.trim()]: newCompanyCode.trim() };
    setCustomCompanies(updated);
    localStorage.setItem('custom_companies', JSON.stringify(updated));
    
    setNewCompanyName('');
    setNewCompanyCode('');
    setShowAddCompanyModal(false);
    alert(`${newCompanyName}가 모니터링 대상으로 추가되었습니다.`);
  };

  return (
    <div className="flex bg-[#F1F5F9] min-h-screen text-on-background font-sans relative overflow-x-hidden text-body-md">
      {/* Sidebar Navigation */}
      <aside className="flex flex-col h-screen fixed left-0 top-0 w-sidebar-width z-40 bg-primary shadow-md">
        <div className="py-gutter px-2 flex flex-col items-center">
          <h1 className="text-[22px] font-bold text-on-primary text-center tracking-wide leading-tight mt-6 mb-2 whitespace-nowrap">
            주요 건설사 수주 현황
          </h1>
        </div>
        
        <nav className="flex-1 px-4 mt-4 overflow-y-auto custom-scrollbar space-y-2">
          {/* 전체 보기 */}
          <div 
            onClick={() => setSelectedCompany(null)}
            className={`flex items-center gap-3 px-4 py-3.5 cursor-pointer duration-200 rounded-lg group ${!selectedCompany ? 'sidebar-active' : 'text-on-primary/70 hover:text-white hover:bg-white/5'}`}
          >
            <span className="text-[14px] font-bold">전체 보기</span>
          </div>

          {/* 기업 목록 */}
          <div className="space-y-1.5 max-h-[50vh] overflow-y-auto custom-scrollbar pr-1">
            {companies.map((name, idx) => (
              <div 
                key={idx}
                onClick={() => setSelectedCompany(name)}
                className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer duration-200 rounded-lg group ${selectedCompany === name ? 'sidebar-active' : 'text-on-primary/70 hover:text-white hover:bg-white/5'}`}
              >
                <span className="text-[13px] font-medium leading-none">{name}</span>
              </div>
            ))}
          </div>

          {/* 신규 건설사 추가 */}
          <div className="pt-4 border-t border-white/10">
            <button 
              onClick={() => setShowAddCompanyModal(true)}
              className="w-full py-3 bg-secondary text-white text-[13px] font-bold rounded-lg hover:opacity-90 transition-all flex items-center justify-center gap-2 px-4 shadow-sm"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span>신규 건설사 추가</span>
            </button>
          </div>
        </nav>

        <div className="p-4 border-t border-white/10">
          <div 
            onClick={() => alert("설정 메뉴는 준비 중입니다.")}
            className="flex items-center gap-3 px-4 py-3 text-on-primary/70 hover:text-white hover:bg-white/5 cursor-pointer duration-200 rounded-lg"
          >
            <Settings className="w-4 h-4 shrink-0" />
            <span className="text-[13px] font-medium leading-none">설정</span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="ml-sidebar-width min-h-screen flex flex-col flex-1">
        {/* Top Navigation Bar */}
        <header className="flex justify-between items-center w-[calc(100%-var(--spacing-sidebar-width))] px-gutter h-16 fixed top-0 right-0 z-30 bg-surface-container-lowest border-b border-outline-variant">
          <div className="flex items-center gap-8">
            <span className="text-[17px] font-bold text-primary tracking-tight">DART 건설 공시 모니터링 시스템</span>
            
            {/* 조회 기간 */}
            <div className="flex items-center gap-4 bg-surface-container-low px-4 py-1.5 rounded-lg border border-outline-variant/30">
              <label className="text-label-bold font-bold text-on-surface-variant flex items-center gap-1.5 text-xs">
                <span className="material-symbols-outlined text-base">calendar_month</span> 조회 기간
              </label>
              <div className="flex items-center gap-2">
                <input 
                  type="date" 
                  value={startDate} 
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-transparent border-none text-xs p-0 focus:ring-0 text-on-surface cursor-pointer font-bold outline-none"
                />
                <span className="text-outline text-xs">~</span>
                <input 
                  type="date" 
                  value={endDate} 
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-transparent border-none text-xs p-0 focus:ring-0 text-on-surface cursor-pointer font-bold outline-none"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button className="p-2.5 hover:bg-surface-container-low transition-colors rounded-full cursor-pointer">
              <Bell className="w-5 h-5 text-on-surface-variant" />
            </button>
          </div>
        </header>

        {/* Dashboard Content */}
        <div className="mt-16 p-gutter flex-1 flex flex-col">
          {/* Action Header */}
          <div className="flex justify-between items-end mb-8 mt-4">
            <div>
              <h2 className="text-[17px] font-bold text-primary mb-1">현황 대시보드</h2>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 text-[13px] font-bold text-secondary">
                  <span className="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
                  실시간 모니터링 중
                </span>
                <span className="text-xs text-on-surface-variant">
                  | 필터: <strong className="text-secondary font-bold">{selectedCompany || '전체 건설사'}</strong>
                </span>
              </div>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => fetchDisclosures()}
                disabled={isLoading}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-secondary text-secondary rounded-lg font-bold hover:bg-secondary/5 transition-all disabled:opacity-50 text-sm"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                {isLoading ? '데이터 갱신 중' : '데이터 갱신'}
              </button>
              <button 
                onClick={() => setShowHistoryModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-secondary text-secondary rounded-lg font-bold hover:bg-secondary/5 transition-all text-sm"
              >
                <History className="w-4 h-4" />
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
                className="flex items-center gap-2 px-6 py-2 bg-secondary text-white rounded-lg font-bold hover:opacity-90 shadow-sm transition-all text-sm"
              >
                <Send className="w-4 h-4" />
                보고서 발송
              </button>
            </div>
          </div>

          {/* Bento Grid Stats Section */}
          <div className="grid grid-cols-12 gap-gutter mb-gutter">
            {/* Summary Card */}
            <div className="col-span-12 md:col-span-4 bg-white p-card-padding rounded-xl border border-outline-variant flex flex-col justify-between shadow-sm">
              <div>
                <p className="text-xs font-bold text-on-surface-variant uppercase mb-2">검색 결과 공시</p>
                <h3 className="text-4xl font-extrabold text-primary">
                  {filteredDisclosures.length}
                  <span className="text-lg ml-1 font-bold">건</span>
                </h3>
              </div>
              <div className="mt-4 flex items-center gap-2 text-secondary">
                <span className="material-symbols-outlined text-[18px]">trending_up</span>
                <span className="text-xs font-bold">
                  {selectedCompany ? `${selectedCompany} 맞춤 필터 적용` : '전체 건설사 데이터 수집'}
                </span>
              </div>
            </div>

            {/* Quick Stats Cards */}
            <div className="col-span-12 md:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-gutter">
              <div className="bg-white p-card-padding rounded-xl border border-outline-variant shadow-sm flex flex-col justify-between">
                <p className="text-xs font-bold text-on-surface-variant mb-2">모니터링 건설사</p>
                <div className="flex items-center justify-between">
                  <span className="text-4xl font-extrabold text-on-surface">{companies.length}</span>
                  <span className="p-2 bg-surface-container rounded-lg text-secondary">
                    <span className="material-symbols-outlined text-[22px]">corporate_fare</span>
                  </span>
                </div>
              </div>
              
              <div className="bg-white p-card-padding rounded-xl border border-outline-variant shadow-sm flex flex-col justify-between">
                <p className="text-xs font-bold text-on-surface-variant mb-2">발송 완료 리포트</p>
                <div className="flex items-center justify-between">
                  <span className="text-4xl font-extrabold text-on-surface">{history.length}</span>
                  <span className="p-2 bg-secondary-container rounded-lg text-secondary">
                    <span className="material-symbols-outlined text-[22px]">description</span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Content Area: Search Result Table Card */}
          <div className="bg-white rounded-xl border border-outline-variant overflow-hidden shadow-sm flex-1 flex flex-col">
            <div className="px-gutter py-4.5 border-b border-outline-variant flex justify-between items-center bg-surface-bright">
              <h3 className="text-lg font-bold text-primary">검색 결과 공시 목록</h3>
              <div className="flex gap-4">
                <div className="flex items-center gap-2 text-xs font-bold text-on-surface-variant">
                  <span className="w-2 h-2 rounded-full bg-outline"></span>
                  전체 {filteredDisclosures.length}건
                </div>
              </div>
            </div>
            
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low/30 border-b border-outline-variant">
                    <th className="px-gutter py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider">공시 일자</th>
                    <th className="px-gutter py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider">기업명</th>
                    <th className="px-gutter py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider">공시 제목</th>
                    <th className="px-gutter py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider">주요 내용</th>
                    <th className="px-gutter py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider text-right">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/30">
                  {filteredDisclosures.length > 0 ? (
                    filteredDisclosures.map((item) => (
                      <tr key={item.id} className="hover:bg-surface-container-low transition-colors group">
                        <td className="px-gutter py-5 whitespace-nowrap">
                          <span className="text-[14px] font-semibold text-on-surface">{item.date}</span>
                        </td>
                        <td className="px-gutter py-5 whitespace-nowrap">
                          <span className="px-3 py-1 bg-surface-container rounded-full text-xs font-bold text-primary">
                            {item.company}
                          </span>
                        </td>
                        <td className="px-gutter py-5">
                          <div className="flex flex-col">
                            <span className="text-[14px] font-bold text-on-surface group-hover:text-secondary transition-colors line-clamp-2">
                              {item.title}
                            </span>
                          </div>
                        </td>
                        <td className="px-gutter py-5">
                          <p className="text-[14px] text-on-surface-variant line-clamp-1">
                            {item.description}
                          </p>
                        </td>
                        <td className="px-gutter py-5 text-right whitespace-nowrap">
                          <a 
                            className="inline-flex items-center gap-1 text-[13px] font-bold text-secondary hover:underline" 
                            href={`https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${item.rcept_no}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <span>원문보기</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-12 px-6 text-center text-on-surface-variant">
                        <div className="flex flex-col items-center justify-center max-w-2xl mx-auto">
                          {apiError ? (
                            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-left flex gap-3 items-start w-full">
                              <Info className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
                              <div>
                                <h4 className="text-xs font-bold text-red-800 uppercase tracking-wide mb-1">
                                  DART 연동 에러 안내
                                </h4>
                                <p className="text-xs text-red-600 leading-relaxed font-semibold">
                                  {apiError}
                                </p>
                              </div>
                            </div>
                          ) : (
                            <>
                              <Info className="w-10 h-10 text-slate-300 mb-3" />
                              <p className="text-[15px] font-bold text-primary">해당 조건에 맞는 공시 데이터가 존재하지 않습니다.</p>
                              <p className="text-xs text-outline mt-1 mb-6">상단의 데이터 갱신 버튼을 눌러보거나 조회 기간을 늘려주세요.</p>
                            </>
                          )}
                          
                          {selectedCompany ? (
                            UNLISTED_OR_SPECIAL_COMPANIES[selectedCompany] ? (
                              <div className="w-full p-5 bg-slate-50 border border-slate-200 rounded-xl text-left shadow-sm flex gap-3 items-start">
                                <HelpCircle className="w-5 h-5 text-slate-400 mt-0.5 shrink-0" />
                                <div>
                                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                                    공시 미수집 안내
                                  </h4>
                                  <p className="text-xs text-slate-500 leading-relaxed">
                                    <strong>{selectedCompany}</strong>{getTopicMarker(selectedCompany)} {UNLISTED_OR_SPECIAL_COMPANIES[selectedCompany]}
                                  </p>
                                </div>
                              </div>
                            ) : (
                              <div className="w-full p-5 bg-slate-50 border border-slate-200 rounded-xl text-left shadow-sm flex gap-3 items-start">
                                <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 shrink-0" />
                                <div>
                                  <h4 className="text-xs font-bold text-emerald-800 uppercase tracking-wide mb-1">
                                    공시 확인 안내
                                  </h4>
                                  <p className="text-xs text-slate-500 leading-relaxed">
                                    <strong>{selectedCompany}</strong>{getTopicMarker(selectedCompany)} 상장 회사이나, 설정된 조회 기간 내에 DART에 공시된 수주 계약(단일판매ㆍ공급계약체결) 내역이 존재하지 않습니다.
                                  </p>
                                </div>
                              </div>
                            )
                          ) : (
                            <div className="w-full p-5 bg-slate-50 border border-slate-200 rounded-xl text-left shadow-sm">
                              <div className="flex gap-3 items-start mb-3">
                                <HelpCircle className="w-5 h-5 text-slate-400 mt-0.5 shrink-0" />
                                <div>
                                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                                    일부 건설사 공시 미표시 안내
                                  </h4>
                                  <p className="text-xs text-slate-500 leading-relaxed">
                                    아래와 같은 비상장 기업들은 주식시장에 상장되어 있지 않아 DART에 수주 관련 주요사항보고서(수시공시)를 직접 제출하지 않으므로 검색 리스트에 나타나지 않을 수 있습니다.
                                  </p>
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-1.5 pl-8">
                                {Object.keys(UNLISTED_OR_SPECIAL_COMPANIES).map((name, i) => (
                                  <span key={i} className="text-[11px] bg-white border border-slate-200 px-2 py-0.5 rounded text-slate-600 font-semibold shadow-sm">
                                    {name}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination / Summary footer */}
            <div className="px-gutter py-4.5 border-t border-outline-variant flex items-center justify-between">
              <span className="text-xs text-on-surface-variant font-medium">
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
            <span className="material-symbols-outlined text-2xl">analytics</span>
            <div className="absolute right-16 bg-primary text-white text-xs py-2 px-4 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              AI 리포트 분석
            </div>
          </button>
        </div>

        <footer className="mt-auto px-gutter py-6 text-center border-t border-outline-variant bg-white">
          <p className="text-xs text-outline">
            © 2026 DART Monitoring System. All rights reserved. 본 서비스에서 제공하는 공시 정보는 투자 참고용이며, 정확한 정보는 금융감독원 DART 시스템을 확인하시기 바랍니다.
          </p>
        </footer>
      </main>

      {/* ADD COMPANY MODAL */}
      {showAddCompanyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowAddCompanyModal(false)} />
          <div className="relative w-full max-w-md bg-white border border-outline-variant rounded-xl shadow-2xl overflow-hidden z-10">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6 border-b pb-4">
                <h3 className="text-lg font-bold text-primary flex items-center gap-2">
                  <span className="material-symbols-outlined">add_business</span>
                  신규 건설사 추가
                </h3>
                <button onClick={() => setShowAddCompanyModal(false)} className="text-outline hover:text-on-surface flex items-center justify-center">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAddCompany} className="space-y-5">
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant mb-2">건설사 이름</label>
                  <input 
                    type="text" 
                    placeholder="예: 금호건설"
                    value={newCompanyName}
                    onChange={(e) => setNewCompanyName(e.target.value)}
                    className="w-full bg-white border border-outline-variant rounded-lg p-3 text-sm text-on-surface outline-none focus:border-secondary transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant mb-2">DART 고유번호 (8자리 숫자)</label>
                  <input 
                    type="text" 
                    maxLength={8}
                    placeholder="예: 00115719"
                    value={newCompanyCode}
                    onChange={(e) => setNewCompanyCode(e.target.value)}
                    className="w-full bg-white border border-outline-variant rounded-lg p-3 text-sm text-on-surface outline-none focus:border-secondary transition-all"
                  />
                  <span className="text-[11px] text-outline mt-1 block leading-tight">
                    * 금융감독원 Open DART에서 확인할 수 있는 8자리 기업 고유코드 번호입니다.
                  </span>
                </div>

                <button 
                  type="submit"
                  className="w-full bg-secondary hover:opacity-90 text-white font-bold py-3.5 rounded-lg transition-all text-sm shadow-sm"
                >
                  수집 목록에 추가
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* HISTORY MODAL */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowHistoryModal(false)} />
          <div className="relative w-full max-w-2xl bg-white border border-outline-variant rounded-xl shadow-2xl overflow-hidden z-10">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6 border-b pb-4">
                <h3 className="text-lg font-bold text-primary flex items-center gap-2">
                  <History className="w-5 h-5 text-secondary" />
                  <span>메일 발송 이력 확인</span>
                </h3>
                <button onClick={() => setShowHistoryModal(false)} className="text-outline hover:text-on-surface flex items-center justify-center">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {history.length > 0 ? (
                  history.map((item) => (
                    <div key={item.id} className="p-4 bg-surface-container-low border border-outline-variant/50 rounded-lg">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className="text-[11px] text-secondary font-bold block mb-1">건설사 필터</span>
                          <h4 className="text-sm font-bold text-primary">{item.company}</h4>
                        </div>
                        <span className="bg-secondary-container text-secondary text-[11px] px-2.5 py-1 rounded-full font-bold">
                          SENT SUCCESS
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-xs text-on-surface-variant">
                        <div>
                          <span className="text-outline text-[11px] block">수신 이메일</span>
                          <span className="font-semibold text-on-surface">{item.email}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-outline text-[11px] block">발송 시각</span>
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
                <h3 className="text-lg font-bold text-primary flex items-center gap-2">
                  <Send className="w-5 h-5 text-secondary" />
                  <span>보고서 이메일 발송</span>
                </h3>
                {!showConfirm && (
                  <button onClick={() => setShowModal(false)} className="text-outline hover:text-on-surface flex items-center justify-center">
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>

              {!showConfirm ? (
                <div className="space-y-6">
                  <div className="p-4 bg-surface-container-low border border-outline-variant/50 rounded-lg">
                    <p className="text-[11px] text-secondary font-bold uppercase mb-2 tracking-wider">발송 내용 요약 (Summary)</p>
                    <div className="space-y-2 text-xs text-on-surface-variant">
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
                    <label className="block text-xs font-bold text-on-surface-variant mb-2">수신 이메일 주소</label>
                    <input 
                      type="email" 
                      placeholder="example@email.com"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      className="w-full bg-white border border-outline-variant rounded-lg p-3 text-sm text-on-surface outline-none focus:border-secondary transition-all"
                    />
                  </div>

                  <button 
                    disabled={!emailInput || filteredDisclosures.length === 0}
                    onClick={() => setShowConfirm(true)}
                    className="w-full bg-secondary disabled:opacity-35 disabled:cursor-not-allowed hover:opacity-90 text-white font-bold py-3.5 rounded-lg transition-all text-sm shadow-sm"
                  >
                    발송 확인 단계로
                  </button>
                </div>
              ) : (
                <div className="text-center space-y-6 py-2">
                  <div className="w-16 h-16 bg-secondary-container text-secondary rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                    <Send className="w-8 h-8" />
                  </div>
                  <h4 className="text-lg font-bold text-primary">이메일을 보내시겠습니까?</h4>
                  <p className="text-xs text-on-surface-variant leading-relaxed">
                    입력하신 <strong className="text-secondary">{emailInput}</strong> 주소로<br/>
                    검색된 수주 보고서 요약본이 즉시 발송됩니다.
                  </p>
                  <div className="flex gap-3 pt-2">
                    <button 
                      onClick={() => setShowConfirm(false)}
                      className="flex-1 bg-white hover:bg-surface-container-low text-on-surface-variant font-bold py-3 rounded-lg text-xs transition-colors border border-outline-variant"
                    >
                      취소하기
                    </button>
                    <button 
                      disabled={isSending}
                      onClick={handleSendReport}
                      className="flex-1 bg-secondary hover:opacity-90 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 text-xs shadow-sm transition-all"
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
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-secondary" />
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
