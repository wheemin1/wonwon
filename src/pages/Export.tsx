import { useState, useRef, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getSettings } from '../db';
import { format, eachDayOfInterval, startOfMonth, endOfMonth, getDay, differenceInMonths } from 'date-fns';
import { ko } from 'date-fns/locale';
import html2canvas from 'html2canvas';
import { Download, Copy, Check, Eye, EyeOff } from 'lucide-react';
import { useToast } from '../components/Toast';

interface LocationSummary {
  location: string;
  days: number;
  amount: number;
}

interface MonthlyData {
  month: Date;
  logs: any[];
  summary: LocationSummary[];
  totalDays: number;
  totalAmount: number;
  taxAmount: number;
}

function groupLogsByLocation(logs: any[]): LocationSummary[] {
  const grouped = logs.reduce((acc, log) => {
    if (log.isDayOff) return acc; // 휴무는 제외
    if (!acc[log.location]) {
      acc[log.location] = { location: log.location, days: 0, amount: 0 };
    }
    acc[log.location].days += 1;
    acc[log.location].amount += log.amount;
    return acc;
  }, {} as Record<string, LocationSummary>);

  return Object.values(grouped);
}

function groupLogsByMonth(logs: any[]): MonthlyData[] {
  const monthMap = new Map<string, any[]>();
  
  logs.forEach(log => {
    const monthKey = format(new Date(log.date), 'yyyy-MM');
    if (!monthMap.has(monthKey)) {
      monthMap.set(monthKey, []);
    }
    monthMap.get(monthKey)!.push(log);
  });

  return Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([monthKey, monthLogs]) => {
      const summary = groupLogsByLocation(monthLogs);
      const totalDays = summary.reduce((sum, s) => sum + s.days, 0);
      const totalAmount = summary.reduce((sum, s) => sum + s.amount, 0);
      const taxAmount = Math.floor(totalAmount * 0.033);
      
      return {
        month: new Date(monthKey + '-01'),
        logs: monthLogs,
        summary,
        totalDays,
        totalAmount,
        taxAmount,
      };
    });
}

export function Export() {
  const { showToast } = useToast();
  const currentDate = new Date();
  
  // localStorage에서 저장된 값 불러오기
  const getSavedDate = (key: string, defaultValue: string) => {
    const saved = localStorage.getItem(key);
    return saved || defaultValue;
  };
  
  const getSavedBoolean = (key: string, defaultValue: boolean) => {
    const saved = localStorage.getItem(key);
    return saved === null ? defaultValue : saved === 'true';
  };

  const [startDate, setStartDate] = useState(() => 
    getSavedDate('export_startDate', format(startOfMonth(currentDate), 'yyyy-MM-dd'))
  );
  const [endDate, setEndDate] = useState(() => 
    getSavedDate('export_endDate', format(endOfMonth(currentDate), 'yyyy-MM-dd'))
  );
  const [copied, setCopied] = useState(false);
  const [showAmount, setShowAmount] = useState(() => 
    getSavedBoolean('export_showAmount', true)
  );
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string>('');
  const reportRef = useRef<HTMLDivElement>(null);

  // 상태가 변경될 때마다 localStorage에 저장
  useEffect(() => {
    localStorage.setItem('export_startDate', startDate);
  }, [startDate]);

  useEffect(() => {
    localStorage.setItem('export_endDate', endDate);
  }, [endDate]);

  useEffect(() => {
    localStorage.setItem('export_showAmount', String(showAmount));
  }, [showAmount]);

  // 날짜 변경 핸들러
  const handleDateChange = (type: 'start' | 'end', value: string) => {
    if (type === 'start') {
      setStartDate(value);
      if (value > endDate) {
        setEndDate(value);
      }
    } else {
      setEndDate(value);
      if (value < startDate) {
        setStartDate(value);
      }
    }
    
    const start = new Date(type === 'start' ? value : startDate);
    const end = new Date(type === 'end' ? value : endDate);
    const months = differenceInMonths(end, start) + 1;
    
    showToast(
      `기간 변경: ${format(start, 'M/d', { locale: ko })} ~ ${format(end, 'M/d', { locale: ko })} (${months}개월)`,
      'success'
    );
  };

  // 날짜 범위의 로그 가져오기
  const logs = useLiveQuery(
    async () => {
      return await db.logs
        .where('date')
        .between(startDate, endDate, true, true)
        .sortBy('date');
    },
    [startDate, endDate]
  );

  // 설정 가져오기
  const settings = useLiveQuery(() => getSettings());

  if (!logs || !settings) {
    return <div className="p-4">로딩 중...</div>;
  }

  // 월별로 데이터 그룹핑
  const monthlyDataList = groupLogsByMonth(logs);
  
  // 전체 합계
  const grandTotalDays = monthlyDataList.reduce((sum, m) => sum + m.totalDays, 0);
  const grandTotalAmount = monthlyDataList.reduce((sum, m) => sum + m.totalAmount, 0);
  const grandTaxAmount = Math.floor(grandTotalAmount * 0.033);

  // 텍스트 복사
  const copyToClipboard = async () => {
    const userName = settings.userName || '홍길동';
    const periodText = monthlyDataList.length === 1 
      ? format(monthlyDataList[0].month, 'M월', { locale: ko })
      : `${format(monthlyDataList[0].month, 'M월', { locale: ko })}~${format(monthlyDataList[monthlyDataList.length - 1].month, 'M월', { locale: ko })}`;

    let text = `[${periodText} 노임 청구서 - ${userName}]\n\n`;
    
    monthlyDataList.forEach(monthData => {
      const monthStr = format(monthData.month, 'M월', { locale: ko });
      text += `■ ${monthStr} 현장별 요약\n`;
      monthData.summary.forEach((s, i) => {
        text += `${i + 1}. ${s.location} : ${s.days}일 / ${s.amount.toLocaleString()}원\n`;
      });
      text += `${monthStr} 소계: ${monthData.totalDays}일 / ${monthData.totalAmount.toLocaleString()}원\n`;
      text += `세금 3.3%: ${monthData.taxAmount.toLocaleString()}원\n`;
      text += `실수령: ${(monthData.totalAmount - monthData.taxAmount).toLocaleString()}원\n\n`;
    });

    text += `--------------------\n`;
    text += `총 근무: ${grandTotalDays}일\n`;
    text += `총 청구: ${grandTotalAmount.toLocaleString()}원\n`;
    text += `세금 공제: ${grandTaxAmount.toLocaleString()}원\n`;
    text += `실수령 합계: ${(grandTotalAmount - grandTaxAmount).toLocaleString()}원\n\n`;

    if (settings.bankName && settings.bankAccount) {
      text += `[입금 계좌]\n`;
      text += `${settings.bankName} ${settings.bankAccount}\n`;
      if (settings.accountHolder) {
        text += `${settings.accountHolder}\n`;
      }
    }

    await navigator.clipboard.writeText(text);
    setCopied(true);
    showToast('📋 텍스트가 복사되었습니다!', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  // 이미지로 저장 - 1단계: 이미지 생성 및 모달 표시
  const saveAsImage = async () => {
    if (!reportRef.current) return;

    try {
      showToast('📸 이미지 생성 중...', 'info');
      
      // 약간의 지연을 두어 브라우저가 렌더링을 완료하도록 함
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
        allowTaint: true,
        foreignObjectRendering: false,
        imageTimeout: 0,
        removeContainer: true,
      });

      const dataUrl = canvas.toDataURL('image/png', 1.0);
      
      // PWA standalone 모드 감지
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                           (window.navigator as any).standalone === true;

      // PWA 모드이거나 모바일: 모달로 표시
      if (isStandalone || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
        setGeneratedImageUrl(dataUrl);
        setImageModalOpen(true);
        showToast('✅ 이미지 생성 완료!', 'success');
        return;
      }

      // 일반 브라우저: 즉시 다운로드
      const fileName = `노임청구서_${format(new Date(), 'yyyy-MM-dd')}.png`;
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      showToast('✅ 이미지가 저장되었습니다!', 'success');
    } catch (error) {
      console.error('이미지 저장 실패:', error);
      showToast('❌ 이미지 저장에 실패했습니다.', 'error');
    }
  };

  // 이미지 공유 - 2단계: 모달에서 공유 버튼 클릭
  const shareImage = async () => {
    if (!generatedImageUrl) return;

    try {
      const fileName = `노임청구서_${format(new Date(), 'yyyy-MM-dd')}.png`;
      
      // Web Share API 시도
      if (navigator.share && navigator.canShare) {
        const response = await fetch(generatedImageUrl);
        const blob = await response.blob();
        const file = new File([blob], fileName, { type: 'image/png' });
        
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: '노임 청구서',
          });
          showToast('✅ 이미지가 공유되었습니다!', 'success');
          setImageModalOpen(false);
          return;
        }
      }

      // 공유 실패 시 안내
      showToast('💡 이미지를 길게 눌러 저장하세요', 'info');
    } catch (error: any) {
      if (error.name === 'AbortError') {
        showToast('공유가 취소되었습니다', 'info');
      } else {
        console.error('공유 실패:', error);
        showToast('💡 이미지를 길게 눌러 저장하세요', 'info');
      }
    }
  };

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-2xl font-bold">정산 내보내기</h1>

      {/* 기간 선택 */}
      <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-base font-bold">기간 설정</h3>
          <button
            onClick={() => {
              setShowAmount(!showAmount);
              showToast(showAmount ? '💰 금액 숨김' : '💰 금액 표시', 'info');
            }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-semibold text-sm transition-all ${
              showAmount 
                ? 'bg-brand text-white' 
                : 'bg-gray-200 text-gray-600'
            }`}
          >
            {showAmount ? <Eye size={18} /> : <EyeOff size={18} />}
            {showAmount ? '금액 표시' : '금액 숨김'}
          </button>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            시작일
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => handleDateChange('start', e.target.value)}
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-brand"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            종료일
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => handleDateChange('end', e.target.value)}
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-brand"
          />
        </div>
      </div>

      {logs.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm p-8 text-center text-gray-500">
          선택한 기간에 기록이 없습니다
        </div>
      ) : (
        <>
          {/* 리포트 카드 (캡처용) */}
          <div ref={reportRef} className="bg-white rounded-2xl shadow-lg p-6 space-y-6">
            {/* 전체 헤더 */}
            <div className="text-center border-b-2 pb-4">
              <h2 className="text-2xl font-bold">
                {monthlyDataList.length === 1 
                  ? `${format(monthlyDataList[0].month, 'M월', { locale: ko })} 노임 청구서`
                  : `${format(monthlyDataList[0].month, 'M월', { locale: ko })}~${format(monthlyDataList[monthlyDataList.length - 1].month, 'M월', { locale: ko })} 노임 청구서`
                }
              </h2>
              {settings.userName && (
                <p className="text-lg text-gray-600 mt-1">{settings.userName}</p>
              )}
              <p className="text-sm text-gray-500 mt-2">
                {format(new Date(startDate), 'yyyy.MM.dd', { locale: ko })} ~ {format(new Date(endDate), 'yyyy.MM.dd', { locale: ko })}
              </p>
            </div>

            {/* 월별 청구서 */}
            {monthlyDataList.map((monthData, idx) => {
              const monthStart = startOfMonth(monthData.month);
              const monthEnd = endOfMonth(monthData.month);
              const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
              const startDayOfWeek = getDay(monthStart);
              const emptyDays = Array(startDayOfWeek).fill(null);
              const workedDates = new Set(monthData.logs.map(log => log.date));

              return (
                <div key={idx} className="space-y-4 pb-6 border-b-2 last:border-0">
                  {/* 월 타이틀 */}
                  <h3 className="text-xl font-bold text-brand">
                    {format(monthData.month, 'M월', { locale: ko })}
                  </h3>

                  {/* 현장별 요약 */}
                  <div className="bg-blue-50 rounded-xl p-4 border-2 border-brand">
                    <h4 className="text-base font-bold mb-3 text-brand">■ 현장별 요약</h4>
                    <div className="space-y-2">
                      {monthData.summary.map((s, i) => (
                        <div key={i} className="flex justify-between items-center py-2 border-b border-blue-200 last:border-0">
                          <span className="font-medium">
                            {i + 1}. {s.location}
                          </span>
                          <span className="font-bold">
                            {s.days}일{showAmount && ` | ${s.amount.toLocaleString()}원`}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 pt-4 border-t-2 border-brand space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-lg font-bold text-brand">소계</span>
                        <span className="text-xl font-bold text-brand">
                          {monthData.totalDays}일{showAmount && ` | ${monthData.totalAmount.toLocaleString()}원`}
                        </span>
                      </div>
                      {showAmount && (
                        <>
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-600">세금 3.3%</span>
                            <span className="text-red-600 font-bold">-{monthData.taxAmount.toLocaleString()}원</span>
                          </div>
                          <div className="flex justify-between items-center pt-2 border-t border-blue-300">
                            <span className="text-lg font-bold text-sky-600">실수령액</span>
                            <span className="text-2xl font-bold text-sky-600">
                              {(monthData.totalAmount - monthData.taxAmount).toLocaleString()}원
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* 달력 */}
                  <div>
                    <h4 className="text-base font-bold mb-2">■ 근무 달력</h4>
                    <div className="bg-gray-50 rounded-xl p-3">
                      <div className="grid grid-cols-7 gap-1 mb-2">
                        {['일', '월', '화', '수', '목', '금', '토'].map((day, i) => (
                          <div key={day} className={`text-center text-xs font-medium ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : ''}`}>
                            {day}
                          </div>
                        ))}
                      </div>
                      <div className="grid grid-cols-7 gap-1">
                        {emptyDays.map((_, i) => (
                          <div key={`empty-${i}`} />
                        ))}
                        {daysInMonth.map(date => {
                          const dateStr = format(date, 'yyyy-MM-dd');
                          const isWorked = workedDates.has(dateStr);
                          
                          return (
                            <div
                              key={date.toISOString()}
                              className={`aspect-square flex items-center justify-center text-sm rounded ${
                                isWorked ? 'bg-brand text-white font-bold' : 'text-gray-400'
                              }`}
                            >
                              {format(date, 'd')}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* 상세 내역 */}
                  <div>
                    <h4 className="text-base font-bold mb-2">■ 상세 내역</h4>
                    <div className="space-y-1">
                      {monthData.logs.map((log, i) => (
                        <div key={i} className="flex justify-between items-center py-1.5 border-b border-gray-200 last:border-0 text-sm">
                          <span className="text-gray-700">
                            {format(new Date(log.date), 'M/d(EEE)', { locale: ko })} {log.location}
                          </span>
                          {showAmount && (
                            <span className="font-bold">{log.amount.toLocaleString()}원</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* 전체 합계 */}
            {monthlyDataList.length > 1 && (
              <div className="bg-gradient-to-r from-blue-500 to-sky-500 rounded-xl p-5 text-white">
                <h3 className="text-xl font-bold mb-3">■ 전체 합계</h3>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-lg">총 근무일</span>
                    <span className="text-2xl font-bold">{grandTotalDays}일</span>
                  </div>
                  {showAmount && (
                    <>
                      <div className="flex justify-between items-center">
                        <span className="text-lg">총 청구액</span>
                        <span className="text-2xl font-bold">{grandTotalAmount.toLocaleString()}원</span>
                      </div>
                      <div className="flex justify-between items-center text-sm opacity-90">
                        <span>세금 3.3% 공제</span>
                        <span className="font-bold">-{grandTaxAmount.toLocaleString()}원</span>
                      </div>
                      <div className="pt-3 border-t-2 border-white/30">
                        <div className="flex justify-between items-center">
                          <span className="text-xl font-bold">실수령 합계</span>
                          <span className="text-3xl font-extrabold">
                            {(grandTotalAmount - grandTaxAmount).toLocaleString()}원
                          </span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Section D: 계좌 정보 */}
            {settings.bankName && settings.bankAccount && (
              <div className="bg-gray-50 rounded-xl p-4">
                <h3 className="text-lg font-bold mb-2">■ 입금 계좌</h3>
                <p className="font-medium">
                  {settings.bankName} {settings.bankAccount}
                </p>
                {settings.accountHolder && (
                  <p className="text-gray-600">{settings.accountHolder}</p>
                )}
              </div>
            )}
          </div>

          {/* 액션 버튼 */}
          <div className="space-y-3 pb-4">
            {/* 메인: 텍스트 복사 (파란색, 크게) */}
            <button
              onClick={copyToClipboard}
              className="w-full min-h-[60px] bg-brand text-white text-xl font-bold rounded-xl hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
            >
              {copied ? (
                <>
                  <Check size={24} />
                  복사 완료!
                </>
              ) : (
                <>
                  <Copy size={24} />
                  카톡 텍스트 복사
                </>
              )}
            </button>

            {/* 서브: 이미지 저장 (회색) */}
            <button
              onClick={saveAsImage}
              className="w-full min-h-[60px] bg-gray-100 text-gray-700 text-lg font-bold rounded-xl hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
            >
              <Download size={24} />
              이미지로 저장 (증빙용)
            </button>
          </div>
        </>
      )}

      {/* 이미지 모달 (PWA 모드용) */}
      {imageModalOpen && (
        <div 
          className="fixed inset-0 z-[100] bg-black/90 flex flex-col items-center justify-center p-4"
        >
          <div className="w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
            <div className="bg-white rounded-t-2xl p-4 text-center">
              <h3 className="text-lg font-bold mb-2">📱 이미지 저장</h3>
              <p className="text-sm text-gray-600 mb-1">
                아래 <span className="font-bold text-brand">[공유하기]</span> 버튼을 눌러 저장하세요
              </p>
              <p className="text-xs text-gray-500">또는 이미지를 길게 눌러 저장</p>
            </div>
            <div className="bg-white p-4 overflow-auto max-h-[60vh]">
              <img 
                src={generatedImageUrl} 
                alt="노임 청구서" 
                className="w-full h-auto"
                onContextMenu={(e) => e.stopPropagation()}
              />
            </div>
            <div className="grid grid-cols-2 gap-2 bg-white p-4 rounded-b-2xl">
              <button
                onClick={shareImage}
                className="bg-brand text-white py-4 rounded-xl font-bold hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
              >
                <Download size={20} />
                공유하기
              </button>
              <button
                onClick={() => setImageModalOpen(false)}
                className="bg-gray-200 text-gray-800 py-4 rounded-xl font-bold hover:bg-gray-300 transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
